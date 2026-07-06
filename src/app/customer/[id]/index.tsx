// Customer detail — hero balance + append-only running ledger. Corrections go
// through storno (long-press → reverse entry), never edit/delete.
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import {
  BellRing,
  Camera,
  FileDown,
  History,
  Images,
  MoreVertical,
  Pencil,
  Phone,
  Send,
  Undo2,
  X,
} from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { BalanceBadge } from '@/components/BalanceBadge';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { EmptyState, ErrorState } from '@/components/EmptyState';
import { IconButton } from '@/components/IconButton';
import { List, type ListRenderItemInfo } from '@/components/List';
import { ScreenHeader } from '@/components/ScreenHeader';
import { BottomSheetView, Sheet, dismissSheet, presentSheet, useSheetRef } from '@/components/Sheet';
import { SkeletonHeader, SkeletonRow } from '@/components/Skeleton';
import { TxRow } from '@/components/TxRow';
import { useAuth, useRequireAuth } from '@/context/auth';
import { useLang } from '@/context/lang';
import { useTenant } from '@/context/tenant';
import { useToast } from '@/context/toast';
import { usePendingTransactions } from '@/hooks/useOutbox';
import { usePermissions } from '@/hooks/usePermissions';
import { flushOutbox, removeOutboxEntry } from '@/lib/outbox';
import {
  apiGet,
  apiPost,
  apiUpload,
  apiUrl,
  getErrorMessage,
  unwrapList,
  type Customer,
  type LedgerTransaction,
  type Paginated,
} from '@/lib/api';
import { relativeDate } from '@/lib/dates';
import { haptics } from '@/lib/haptics';
import { fromCents, toCents } from '@/lib/money';
import { pickFromCamera, pickFromGallery, type PickedPhoto } from '@/lib/photo-picker';
import { downloadAndShare } from '@/lib/share-file';
import { badge, surface, text } from '@/lib/ui-tokens';

type Status = 'loading' | 'error' | 'success';

interface DetailRow {
  tx: LedgerTransaction;
  runningBalance?: string;
  dateHeader: string | null;
  syncState?: 'pending' | 'failed';
}

const dayOf = (iso: string) => iso.slice(0, 10);

export default function CustomerDetailScreen() {
  const { user, loading: authLoading } = useRequireAuth();
  const { t, lang } = useLang();
  const { activeTenant } = useTenant();
  const { token } = useAuth();
  const { hasPerm } = usePermissions();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { colorScheme } = useColorScheme();
  const params = useLocalSearchParams<{ id: string }>();
  const id = params.id;

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [txs, setTxs] = useState<LedgerTransaction[]>([]);
  const [nextUrl, setNextUrl] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [status, setStatus] = useState<Status>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTx, setSelectedTx] = useState<LedgerTransaction | null>(null);
  const hasLoadedRef = useRef(false);
  const toast = useToast();
  const pendingEntries = usePendingTransactions(id);

  const menuSheetRef = useSheetRef();
  const txSheetRef = useSheetRef();

  const isDark = colorScheme === 'dark';
  const headerIconColor = isDark ? '#f9fafb' : '#111827'; // gray-50 / gray-900
  const mutedIconColor = isDark ? '#9ca3af' : '#4b5563'; // gray-400 / gray-600

  const load = useCallback(async () => {
    // API returns transactions newest-first; the customer carries the server balance.
    // Loads page one and resets the cursor — older pages arrive via loadMore.
    const [cust, txResp] = await Promise.all([
      apiGet<Customer>(`/customers/${id}/`, token ?? undefined),
      apiGet<LedgerTransaction[] | Paginated<LedgerTransaction>>(
        `/transactions/?customer=${id}`,
        token ?? undefined,
      ),
    ]);
    setCustomer(cust);
    setTxs(unwrapList(txResp));
    setNextUrl(Array.isArray(txResp) ? null : txResp.next);
  }, [id, token]);

  const refetch = useCallback(() => {
    setStatus('loading');
    load()
      .then(() => setStatus('success'))
      .catch((err: unknown) => {
        setErrorMsg(getErrorMessage(err, t));
        setStatus('error');
      });
  }, [load, t]);

  // First focus shows the skeleton; later focuses (e.g. returning from the entry
  // modal) reload silently over the stale data so the fresh balance appears
  // without a flash.
  useFocusEffect(
    useCallback(() => {
      if (!token) return;
      void flushOutbox(); // reentering the screen is a natural sync moment
      if (!hasLoadedRef.current) {
        hasLoadedRef.current = true;
        refetch();
        return;
      }
      load()
        .then(() => setStatus('success'))
        .catch((err: unknown) => {
          toast.show({ message: getErrorMessage(err, t), intent: 'error' });
        });
    }, [token, refetch, load, toast, t]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load()
      .then(() => setStatus('success'))
      .catch((err: unknown) => {
        setErrorMsg(getErrorMessage(err, t));
        setStatus('error');
      })
      .finally(() => setRefreshing(false));
  }, [load, t]);

  const loadMore = useCallback(() => {
    if (!nextUrl || loadingMore) return;
    setLoadingMore(true);
    apiGet<Paginated<LedgerTransaction>>(nextUrl, token ?? undefined)
      .then((page) => {
        setTxs((prev) => [...prev, ...page.results]);
        setNextUrl(page.next);
      })
      .catch((err: unknown) => {
        toast.show({ message: getErrorMessage(err, t), intent: 'error' });
      })
      .finally(() => setLoadingMore(false));
  }, [nextUrl, loadingMore, token, toast, t]);

  // Running balance is folded client-side oldest→newest (integer cents, never
  // stored): borc grows the receivable, odeme shrinks it. Recomputed over ALL
  // loaded pages whenever an older page is appended. A row shows a date header
  // when its day differs from the previous (newer) row's day.
  const rows = useMemo<DetailRow[]>(() => {
    const running: string[] = new Array<string>(txs.length);
    let acc = 0;
    for (let i = txs.length - 1; i >= 0; i--) {
      const tx = txs[i];
      acc += (tx.type === 'borc' ? 1 : -1) * toCents(tx.amount);
      running[i] = fromCents(acc);
    }
    const serverRows = txs.map((tx, i) => {
      const prev = i > 0 ? txs[i - 1] : null;
      const dateHeader =
        !prev || dayOf(prev.created_at) !== dayOf(tx.created_at)
          ? relativeDate(tx.created_at, lang)
          : null;
      return { tx, runningBalance: running[i], dateHeader };
    });
    // Optimistic UI: queued (offline) entries render on top with a sync badge
    // and no running balance — the server stays the balance source of truth.
    const pendingRows: DetailRow[] = pendingEntries.map((entry) => ({
      tx: {
        id: entry.key,
        tenant: entry.tenant,
        customer: entry.customer,
        type: entry.type,
        amount: entry.amount,
        note: entry.note,
        due_date: entry.due_date ?? null,
        attachments: [],
        created_at: entry.queuedAt,
      } as LedgerTransaction,
      dateHeader: null,
      syncState: entry.failedError ? 'failed' : 'pending',
    }));
    return [...pendingRows, ...serverRows];
  }, [txs, lang, pendingEntries]);

  const handleLongPress = useCallback(
    (tx: LedgerTransaction) => {
      haptics.selection(); // felt confirmation that the long-press registered
      setSelectedTx(tx);
      presentSheet(txSheetRef);
    },
    [txSheetRef],
  );

  // A failed (permanently rejected) queued entry is removable by long-press —
  // never silently dropped. Still-pending entries have no actions.
  const removeFailedEntry = useCallback(
    (tx: LedgerTransaction) => {
      haptics.warning();
      void removeOutboxEntry(tx.id).then(() => {
        toast.show({ message: t('ledger_sync_removed'), intent: 'success' });
      });
    },
    [toast, t],
  );

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<DetailRow>) => (
      <View>
        {item.dateHeader !== null && (
          <Text className={`px-4 pb-1 pt-4 text-sm font-medium ${text.muted}`}>
            {item.dateHeader}
          </Text>
        )}
        <TxRow
          tx={item.tx}
          runningBalance={item.runningBalance}
          syncState={item.syncState}
          onLongPress={
            item.syncState === 'failed'
              ? removeFailedEntry
              : item.syncState === 'pending'
                ? undefined
                : handleLongPress
          }
        />
      </View>
    ),
    [handleLongPress, removeFailedEntry],
  );

  const keyExtractor = useCallback((item: DetailRow) => item.tx.id, []);

  const openEntry = useCallback(
    (type: 'borc' | 'odeme') => {
      router.push({ pathname: '/entry', params: { customer: id, type } });
    },
    [id],
  );

  const openStatement = useCallback(() => {
    dismissSheet(menuSheetRef);
    router.push(`/customer/${id}/statement`);
  }, [menuSheetRef, id]);

  const openEdit = useCallback(() => {
    dismissSheet(menuSheetRef);
    router.push(`/customer/${id}/edit`);
  }, [menuSheetRef, id]);

  const sendReminder = useCallback(() => {
    dismissSheet(menuSheetRef);
    apiPost(`/customers/${id}/send-reminder/`, {}, token ?? undefined)
      .then(() => {
        haptics.success();
        toast.show({ message: t('ledger_reminder_sent'), intent: 'success' });
      })
      .catch((err: unknown) => {
        haptics.error();
        toast.show({ message: getErrorMessage(err, t), intent: 'error' });
      });
  }, [menuSheetRef, id, token, toast, t]);

  const shareExport = useCallback(
    (kind: 'csv' | 'pdf') => {
      dismissSheet(menuSheetRef);
      if (!token) return;
      toast.show({ message: t('share_preparing'), intent: 'success' });
      const url = apiUrl(`/customers/${id}/export/${kind === 'pdf' ? '?as=pdf' : ''}`);
      void downloadAndShare(url, token, `statement-${id}.${kind}`).then((ok) => {
        if (!ok) {
          haptics.error();
          toast.show({ message: t('share_export_error'), intent: 'error' });
        }
      });
    },
    [menuSheetRef, id, token, toast, t],
  );

  const attachReceipt = useCallback(
    (source: 'camera' | 'gallery') => {
      const tx = selectedTx;
      dismissSheet(txSheetRef);
      if (!tx || !token) return;
      const pick = source === 'camera' ? pickFromCamera : pickFromGallery;
      void pick().then(async (photo: PickedPhoto | null) => {
        if (!photo) return; // cancelled, denied, or module missing (guarded lib warns)
        // Upload takes seconds on mobile data — immediate feedback, then result.
        toast.show({ message: t('photo_uploading'), intent: 'info' });
        const form = new FormData();
        // RN FormData file part: {uri, name, type} object, not a Blob.
        form.append('image', {
          uri: photo.uri,
          name: photo.fileName,
          type: photo.mimeType,
        } as unknown as Blob);
        try {
          await apiUpload(`/transactions/${tx.id}/attachments/`, form, token);
          haptics.success();
          toast.show({ message: t('photo_uploaded'), intent: 'success' });
          void load().then(() => setStatus('success'));
        } catch (err) {
          haptics.error();
          toast.show({ message: getErrorMessage(err, t), intent: 'error' });
        }
      });
    },
    [selectedTx, txSheetRef, token, toast, t, load],
  );

  const [photoViewer, setPhotoViewer] = useState<string[] | null>(null);

  const viewReceipts = useCallback(() => {
    const tx = selectedTx;
    dismissSheet(txSheetRef);
    if (tx?.attachments?.length) {
      setPhotoViewer(tx.attachments.map((a) => a.image));
    }
  }, [selectedTx, txSheetRef]);

  const reverseSelectedTx = useCallback(() => {
    if (!selectedTx) return;
    dismissSheet(txSheetRef);
    router.push({
      pathname: '/entry',
      params: {
        customer: id,
        type: selectedTx.type === 'borc' ? 'odeme' : 'borc',
        amount: selectedTx.amount,
        note: 'Storno',
      },
    });
  }, [selectedTx, txSheetRef, id]);

  if (authLoading || !user) return null;
  // Detail endpoints are customer-scoped (no ?tenant= param) — activeTenant is
  // resolved here only to keep the provider warm for the entry/statement modals.
  void activeTenant;

  const canSendStatement = hasPerm('ledger.send_statement');
  const canEditCustomer = hasPerm('ledger.add_customer');
  const canViewTransactions = hasPerm('ledger.view_transaction');
  const canSendReminder =
    hasPerm('ledger.send_reminder') && !!customer?.phone && toCents(customer.balance) > 0;
  const hasMenu = canSendStatement || canEditCustomer || canSendReminder;

  const heroHeader = customer ? (
    <View className="px-4 pb-2 pt-2">
      <Card className="items-center gap-3">
        <View className="flex-row items-center gap-2">
          <BalanceBadge balance={customer.balance} size="lg" />
          {customer.has_dispute ? (
            <View className={`rounded-full px-3 py-1 ${badge.rose}`}>
              <Text className="text-xs font-semibold text-rose-700 dark:text-rose-300">
                {t('ledger_dispute_badge')}
              </Text>
            </View>
          ) : null}
          {customer.has_overdue ? (
            <View className={`flex-row items-center gap-1 rounded-full px-3 py-1 ${badge.amber}`}>
              <BellRing size={12} color={isDark ? '#fcd34d' : '#b45309'} />
              <Text className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                {t('ledger_overdue_badge')}
              </Text>
            </View>
          ) : null}
        </View>
        {customer.phone ? (
          <Pressable
            onPress={() => void Linking.openURL(`tel:${customer.phone}`)}
            accessibilityRole="button"
            accessibilityLabel={`${t('ledger_customer_phone')}: ${customer.phone}`}
            className="min-h-11 flex-row items-center justify-center gap-2"
          >
            <Phone size={16} color={mutedIconColor} />
            <Text className={`text-base ${text.secondary}`}>{customer.phone}</Text>
          </Pressable>
        ) : null}
      </Card>
    </View>
  ) : null;

  const actionBarHeight = 64 + insets.bottom;

  return (
    <View className={`flex-1 ${surface.base}`}>
      <ScreenHeader
        title={customer?.name ?? ''}
        onBack={() => router.back()}
        right={
          hasMenu ? (
            <IconButton
              icon={<MoreVertical size={22} color={headerIconColor} />}
              onPress={() => presentSheet(menuSheetRef)}
              accessibilityLabel={t('ledger_customer_menu')}
            />
          ) : undefined
        }
      />

      {status === 'loading' && (
        <View className="flex-1">
          <View className="px-4 pb-2 pt-2">
            <SkeletonHeader />
          </View>
          {Array.from({ length: 6 }, (_, i) => (
            <SkeletonRow key={i} />
          ))}
        </View>
      )}

      {status === 'error' && (
        <ErrorState message={errorMsg} onRetry={refetch} retryLabel={t('ledger_retry')} />
      )}

      {status === 'success' && (
        <List
          data={rows}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          ListHeaderComponent={heroHeader}
          ListEmptyComponent={<EmptyState title={t('ledger_empty_transactions')} />}
          ListFooterComponent={
            loadingMore ? (
              <View className="items-center py-4">
                <ActivityIndicator color={mutedIconColor} />
              </View>
            ) : null
          }
          refreshing={refreshing}
          onRefresh={onRefresh}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          contentContainerStyle={{ paddingBottom: actionBarHeight + 16 }}
          extraData={lang}
        />
      )}

      {/* Pinned thumb-zone action bar: the two most frequent actions, color-
          differentiated (amber=add debt, emerald=take payment — button fills,
          distinct from the balance-badge rule). */}
      <View
        className={`absolute bottom-0 left-0 right-0 flex-row gap-3 border-t border-gray-200 px-4 pt-3 dark:border-gray-700 ${surface.base}`}
        style={{ paddingBottom: Math.max(insets.bottom, 12) }}
      >
        <View className="flex-1">
          <Button
            label={t('ledger_action_add_debt')}
            intent="warning"
            size="lg"
            onPress={() => openEntry('borc')}
          />
        </View>
        <View className="flex-1">
          <Button
            label={t('ledger_action_add_payment')}
            intent="success"
            size="lg"
            onPress={() => openEntry('odeme')}
          />
        </View>
      </View>

      {/* Overflow menu — each item permission-gated on its own codename. */}
      <Sheet ref={menuSheetRef} snapPoints={['35%']}>
        <BottomSheetView className="gap-1 px-4 pb-8">
          {canEditCustomer ? (
            <Pressable
              onPress={openEdit}
              accessibilityRole="button"
              accessibilityLabel={t('ledger_edit_customer')}
              className="min-h-12 flex-row items-center gap-3 rounded-lg px-3 active:bg-gray-100 dark:active:bg-gray-700"
            >
              <Pencil size={20} color={mutedIconColor} />
              <Text className={`text-base ${text.primary}`}>{t('ledger_edit_customer')}</Text>
            </Pressable>
          ) : null}
          {canSendReminder ? (
            <Pressable
              onPress={sendReminder}
              accessibilityRole="button"
              accessibilityLabel={t('ledger_send_reminder')}
              className="min-h-12 flex-row items-center gap-3 rounded-lg px-3 active:bg-gray-100 dark:active:bg-gray-700"
            >
              <BellRing size={20} color={mutedIconColor} />
              <Text className={`text-base ${text.primary}`}>{t('ledger_send_reminder')}</Text>
            </Pressable>
          ) : null}
          {canSendStatement ? (
            <>
              <Pressable
                onPress={openStatement}
                accessibilityRole="button"
                accessibilityLabel={t('ledger_send_statement')}
                className="min-h-12 flex-row items-center gap-3 rounded-lg px-3 active:bg-gray-100 dark:active:bg-gray-700"
              >
                <Send size={20} color={mutedIconColor} />
                <Text className={`text-base ${text.primary}`}>{t('ledger_send_statement')}</Text>
              </Pressable>
              <Pressable
                onPress={openStatement}
                accessibilityRole="button"
                accessibilityLabel={t('ledger_link_history')}
                className="min-h-12 flex-row items-center gap-3 rounded-lg px-3 active:bg-gray-100 dark:active:bg-gray-700"
              >
                <History size={20} color={mutedIconColor} />
                <Text className={`text-base ${text.primary}`}>{t('ledger_link_history')}</Text>
              </Pressable>
            </>
          ) : null}
          {canViewTransactions ? (
            <>
              <Pressable
                onPress={() => shareExport('pdf')}
                accessibilityRole="button"
                accessibilityLabel={t('share_export_pdf')}
                className="min-h-12 flex-row items-center gap-3 rounded-lg px-3 active:bg-gray-100 dark:active:bg-gray-700"
              >
                <FileDown size={20} color={mutedIconColor} />
                <Text className={`text-base ${text.primary}`}>{t('share_export_pdf')}</Text>
              </Pressable>
              <Pressable
                onPress={() => shareExport('csv')}
                accessibilityRole="button"
                accessibilityLabel={t('share_export_csv')}
                className="min-h-12 flex-row items-center gap-3 rounded-lg px-3 active:bg-gray-100 dark:active:bg-gray-700"
              >
                <FileDown size={20} color={mutedIconColor} />
                <Text className={`text-base ${text.primary}`}>{t('share_export_csv')}</Text>
              </Pressable>
            </>
          ) : null}
        </BottomSheetView>
      </Sheet>

      {/* Long-press menu: storno is the ONLY correction path (append-only
          ledger); receipts are additive evidence, never edits. */}
      <Sheet ref={txSheetRef} snapPoints={['40%']} onDismiss={() => setSelectedTx(null)}>
        <BottomSheetView className="gap-1 px-4 pb-8">
          <Pressable
            onPress={reverseSelectedTx}
            accessibilityRole="button"
            accessibilityLabel={t('ledger_tx_reverse')}
            className="min-h-12 flex-row items-center gap-3 rounded-lg px-3 active:bg-gray-100 dark:active:bg-gray-700"
          >
            <Undo2 size={20} color={mutedIconColor} />
            <Text className={`text-base ${text.primary}`}>{t('ledger_tx_reverse')}</Text>
          </Pressable>
          <Pressable
            onPress={() => attachReceipt('camera')}
            accessibilityRole="button"
            accessibilityLabel={t('photo_camera')}
            className="min-h-12 flex-row items-center gap-3 rounded-lg px-3 active:bg-gray-100 dark:active:bg-gray-700"
          >
            <Camera size={20} color={mutedIconColor} />
            <Text className={`text-base ${text.primary}`}>{t('photo_camera')}</Text>
          </Pressable>
          <Pressable
            onPress={() => attachReceipt('gallery')}
            accessibilityRole="button"
            accessibilityLabel={t('photo_gallery')}
            className="min-h-12 flex-row items-center gap-3 rounded-lg px-3 active:bg-gray-100 dark:active:bg-gray-700"
          >
            <Images size={20} color={mutedIconColor} />
            <Text className={`text-base ${text.primary}`}>{t('photo_gallery')}</Text>
          </Pressable>
          {selectedTx?.attachments?.length ? (
            <Pressable
              onPress={viewReceipts}
              accessibilityRole="button"
              accessibilityLabel={t('photo_view')}
              className="min-h-12 flex-row items-center gap-3 rounded-lg px-3 active:bg-gray-100 dark:active:bg-gray-700"
            >
              <Images size={20} color={mutedIconColor} />
              <Text className={`text-base ${text.primary}`}>
                {`${t('photo_view')} (${selectedTx.attachments.length})`}
              </Text>
            </Pressable>
          ) : null}
        </BottomSheetView>
      </Sheet>

      {/* Receipt viewer — plain full-screen swipe-through, nothing fancy. */}
      <Modal
        visible={photoViewer !== null}
        animationType="fade"
        onRequestClose={() => setPhotoViewer(null)}
      >
        <SafeAreaView className="flex-1 bg-black">
          <View className="flex-row justify-end px-4 py-2">
            <IconButton
              icon={<X size={26} color="#ffffff" />}
              onPress={() => setPhotoViewer(null)}
              accessibilityLabel={t('cancel')}
            />
          </View>
          <ScrollView horizontal pagingEnabled>
            {(photoViewer ?? []).map((uri) => (
              <Image
                key={uri}
                source={{ uri }}
                resizeMode="contain"
                style={{ width: windowWidth, height: '100%' }}
                accessibilityLabel={t('photo_view')}
              />
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}
