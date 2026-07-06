// Customer list (home) — hero total receivable + searchable customer list.
// Full state matrix: loading → skeletons, error → retry, empty → CTA, success.
// Server-driven list: ordering + has_debt + search are query params; pages are
// cursor-followed via Paginated.next (apiGet accepts absolute URLs).
import { useFocusEffect, useRouter } from 'expo-router';
import { ArrowUpDown, Check, Settings, Users } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, Switch, Text, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { BalanceBadge } from '@/components/BalanceBadge';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { EmptyState, ErrorState } from '@/components/EmptyState';
import { Fab } from '@/components/Fab';
import { IconButton } from '@/components/IconButton';
import { List, type ListRenderItemInfo } from '@/components/List';
import { ListRow } from '@/components/ListRow';
import { MoneyText } from '@/components/MoneyText';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SegmentedControl } from '@/components/SegmentedControl';
import {
  BottomSheetView,
  Sheet,
  dismissSheet,
  presentSheet,
  useSheetRef,
} from '@/components/Sheet';
import { SkeletonHeader, SkeletonRow } from '@/components/Skeleton';
import { TextField } from '@/components/TextField';
import { PinSetupModal, type PinSetupMode } from '@/components/PinSetupModal';
import { useRequireAuth } from '@/context/auth';
import { useLang } from '@/context/lang';
import { useTenant } from '@/context/tenant';
import { useToast } from '@/context/toast';
import { usePermissions } from '@/hooks/usePermissions';
import {
  apiGet,
  getErrorMessage,
  type Customer,
  type CustomerTotals,
  type Paginated,
  type TenantStats,
} from '@/lib/api';
import { isLockEnabled } from '@/lib/app-lock';
import { relativeDate } from '@/lib/dates';
import { haptics } from '@/lib/haptics';
import type { TranslationKey } from '@/lib/i18n';
import { badge, borderTok, surface, text } from '@/lib/ui-tokens';

const SEARCH_VISIBLE_THRESHOLD = 5;
const SEARCH_DEBOUNCE_MS = 300;

type SortKey = 'name' | '-balance' | '-last_transaction_at';
type DebtFilter = 'all' | 'debtors';

const SORT_OPTIONS: { value: SortKey; labelKey: TranslationKey }[] = [
  { value: 'name', labelKey: 'ledger_sort_name' },
  { value: '-balance', labelKey: 'ledger_sort_balance' },
  { value: '-last_transaction_at', labelKey: 'ledger_sort_recent' },
];

interface LedgerHome {
  customers: Customer[];
  next: string | null;
  count: number;
  totals: CustomerTotals;
  stats: TenantStats | null; // null when the user lacks ledger.view_transaction
}

type ScreenState =
  | { status: 'loading' }
  | { status: 'error'; error: unknown }
  | { status: 'success'; data: LedgerHome };

export default function CustomerListScreen() {
  const { user, token, loading: authLoading, logout } = useRequireAuth();
  const { t, lang, setLang } = useLang();
  const { activeTenant, loading: tenantLoading } = useTenant();
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === 'dark';
  const toast = useToast();
  const settingsSheetRef = useSheetRef();
  const sortSheetRef = useSheetRef();

  const { hasPerm } = usePermissions();
  const canViewStats = hasPerm('ledger.view_transaction');

  const [state, setState] = useState<ScreenState>({ status: 'loading' });
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('name');
  const [debtFilter, setDebtFilter] = useState<DebtFilter>('all');
  const [lockEnabled, setLockEnabledState] = useState(false);
  const [pinModal, setPinModal] = useState<PinSetupMode | null>(null);

  // Monotonic sequence: any new full load invalidates in-flight responses
  // (stale search pages / late page-appends must not clobber fresh results).
  const reqSeq = useRef(0);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [query]);

  // Single refetch shared by focus, pull-to-refresh, error Retry and any
  // sort/filter/search change. Always resets pagination to page 1.
  const load = useCallback(async (): Promise<void> => {
    if (!token || !activeTenant) return;
    const seq = ++reqSeq.current;
    let path = `/customers/?tenant=${activeTenant.id}&ordering=${sort}`;
    if (debtFilter === 'debtors') path += '&has_debt=true';
    if (debouncedQuery) path += `&search=${encodeURIComponent(debouncedQuery)}`;
    try {
      const [page, totals, stats] = await Promise.all([
        apiGet<Paginated<Customer>>(path, token),
        apiGet<CustomerTotals>(`/customers/totals/?tenant=${activeTenant.id}`, token),
        canViewStats
          ? apiGet<TenantStats>(`/customers/stats/?tenant=${activeTenant.id}`, token)
          : Promise.resolve(null),
      ]);
      if (seq !== reqSeq.current) return;
      setState({
        status: 'success',
        data: { customers: page.results, next: page.next, count: page.count, totals, stats },
      });
    } catch (error) {
      if (seq !== reqSeq.current) return;
      setState({ status: 'error', error });
    }
  }, [token, activeTenant, sort, debtFilter, debouncedQuery, canViewStats]);

  // Covers mount, returning from any pushed screen (P0-4) and — because the
  // callback identity changes with load's deps — sort/filter/search re-query.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void load().finally(() => setRefreshing(false));
  }, [load]);

  const onRetry = useCallback(() => {
    setState({ status: 'loading' });
    void load();
  }, [load]);

  const loadMore = useCallback(() => {
    if (state.status !== 'success' || state.data.next === null || loadingMore || !token) return;
    const seq = reqSeq.current;
    setLoadingMore(true);
    apiGet<Paginated<Customer>>(state.data.next, token)
      .then((page) => {
        if (seq !== reqSeq.current) return;
        setState((prev) =>
          prev.status === 'success'
            ? {
                status: 'success',
                data: {
                  ...prev.data,
                  customers: [...prev.data.customers, ...page.results],
                  next: page.next,
                },
              }
            : prev,
        );
      })
      .catch((error: unknown) => {
        if (seq === reqSeq.current) {
          toast.show({ message: getErrorMessage(error, t), intent: 'error' });
        }
      })
      .finally(() => setLoadingMore(false));
  }, [state, loadingMore, token, toast, t]);

  const customers = state.status === 'success' ? state.data.customers : [];
  const totalCount = state.status === 'success' ? state.data.count : 0;
  const showSearch = query.length > 0 || totalCount > SEARCH_VISIBLE_THRESHOLD;

  // Optimistic name filter only while the 300ms debounce is pending; once the
  // server answered for this exact query, trust its results (it may match on
  // fields other than name, e.g. phone).
  const displayedCustomers = useMemo(() => {
    const q = query.trim();
    if (!q || q === debouncedQuery) return customers;
    const lower = q.toLocaleLowerCase(lang);
    return customers.filter((c) => c.name.toLocaleLowerCase(lang).includes(lower));
  }, [customers, query, debouncedQuery, lang]);

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<Customer>) => (
      <ListRow
        left={<Avatar name={item.name} />}
        title={item.name}
        subtitle={relativeDate(item.updated_at, lang)}
        right={
          <View className="flex-row items-center gap-2">
            {item.has_dispute ? (
              // Rose is correct here: an open dispute is a merchant problem state.
              <View className={`rounded-full px-2 py-0.5 ${badge.rose}`}>
                <Text className="text-xs font-semibold text-rose-700 dark:text-rose-300">
                  {t('ledger_dispute_badge')}
                </Text>
              </View>
            ) : null}
            {item.has_overdue ? (
              <View className={`rounded-full px-2 py-0.5 ${badge.amber}`}>
                <Text className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                  {t('ledger_overdue_badge')}
                </Text>
              </View>
            ) : null}
            <BalanceBadge balance={item.balance} size="sm" />
          </View>
        }
        onPress={() => router.push({ pathname: '/customer/[id]', params: { id: item.id } })}
      />
    ),
    [lang, router, t],
  );

  const keyExtractor = useCallback((item: Customer) => item.id, []);

  if (authLoading || !user) return null;

  const isDark = colorScheme === 'dark';
  const headerIconColor = isDark ? '#f9fafb' : '#111827'; // gray-50 / gray-900
  const mutedIconColor = isDark ? '#9ca3af' : '#4b5563'; // gray-400 / gray-600
  const primaryIconColor = isDark ? '#60a5fa' : '#2563eb'; // blue-400 / blue-600

  const activeSortLabel = t(
    (SORT_OPTIONS.find((o) => o.value === sort) ?? SORT_OPTIONS[0]).labelKey,
  );

  const onLogout = () => {
    dismissSheet(settingsSheetRef);
    void logout();
  };

  const onSelectSort = (value: SortKey) => {
    dismissSheet(sortSheetRef);
    if (value === sort) return;
    haptics.selection();
    setSort(value);
  };

  let body: ReactNode;
  if (tenantLoading || state.status === 'loading') {
    body = (
      <View className="gap-2 pt-2">
        <View className="px-4 pb-2">
          <SkeletonHeader />
        </View>
        {Array.from({ length: 6 }, (_, i) => (
          <SkeletonRow key={i} />
        ))}
      </View>
    );
  } else if (state.status === 'error') {
    body = (
      <ErrorState
        message={getErrorMessage(state.error, t)}
        onRetry={onRetry}
        retryLabel={t('ledger_retry')}
      />
    );
  } else {
    body = (
      <List
        data={displayedCustomers}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        extraData={lang}
        refreshing={refreshing}
        onRefresh={onRefresh}
        onEndReached={loadMore}
        onEndReachedThreshold={0.4}
        contentContainerStyle={{ paddingBottom: 96 }}
        ListHeaderComponent={
          <View className="gap-4 px-4 pb-2 pt-2">
            <Card className="gap-1">
              <Text className={`text-sm ${text.muted}`}>{t('ledger_total_receivable')}</Text>
              <MoneyText value={state.data.totals.total_receivable} size="hero" />
              <Pressable
                onPress={() => router.push('/aging')}
                accessibilityRole="link"
                accessibilityLabel={t('aging_title')}
                className="mt-1 min-h-11 flex-row items-center justify-center rounded-lg active:opacity-80"
              >
                <Text className="text-sm font-medium text-blue-600 dark:text-blue-400">
                  {t('aging_link')}
                </Text>
              </Pressable>
            </Card>

            {/* KPI tiles — permission-gated server stats; 2-col wrap grid. */}
            {state.data.stats ? (
              <View className="flex-row flex-wrap gap-3">
                {(
                  [
                    { key: 'stats_today_debt', value: state.data.stats.periods.today.borc, tone: 'amber' },
                    { key: 'stats_today_payment', value: state.data.stats.periods.today.odeme, tone: 'emerald' },
                    { key: 'stats_month_debt', value: state.data.stats.periods.month.borc, tone: 'amber' },
                    { key: 'stats_month_payment', value: state.data.stats.periods.month.odeme, tone: 'emerald' },
                  ] as const
                ).map((tile) => (
                  <View
                    key={tile.key}
                    className={`min-w-[47%] flex-1 gap-0.5 rounded-xl p-3 ${surface.raised} ${borderTok}`}
                  >
                    <Text className={`text-xs ${text.muted}`}>{t(tile.key)}</Text>
                    <MoneyText
                      value={tile.value}
                      className={`text-lg font-bold ${
                        tile.tone === 'amber'
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-emerald-600 dark:text-emerald-400'
                      }`}
                    />
                  </View>
                ))}
                <Pressable
                  onPress={() => router.push('/aging')}
                  accessibilityRole="link"
                  accessibilityLabel={t('stats_overdue')}
                  className={`min-w-[47%] flex-1 gap-0.5 rounded-xl p-3 ${surface.raised} ${borderTok} active:opacity-80`}
                >
                  <Text className={`text-xs ${text.muted}`}>{t('stats_overdue')}</Text>
                  <MoneyText
                    value={state.data.stats.total_overdue}
                    className="text-lg font-bold text-amber-600 dark:text-amber-400"
                  />
                </Pressable>
                <View
                  className={`min-w-[47%] flex-1 gap-0.5 rounded-xl p-3 ${surface.raised} ${borderTok}`}
                >
                  <Text className={`text-xs ${text.muted}`}>{t('stats_debtor_count')}</Text>
                  <Text className={`text-lg font-bold ${text.primary}`}>
                    {state.data.stats.debtor_count}
                  </Text>
                </View>
              </View>
            ) : null}
            <View className="flex-row items-center gap-3">
              <Pressable
                onPress={() => presentSheet(sortSheetRef)}
                accessibilityRole="button"
                accessibilityLabel={`${t('ledger_sort')}: ${activeSortLabel}`}
                className={`min-h-11 flex-row items-center gap-1.5 rounded-lg px-3 active:opacity-80 ${surface.raised} ${borderTok}`}
              >
                <ArrowUpDown size={16} color={mutedIconColor} />
                <Text className={`text-sm font-medium ${text.secondary}`} numberOfLines={1}>
                  {activeSortLabel}
                </Text>
              </Pressable>
              <View className="flex-1">
                <SegmentedControl
                  options={[
                    { value: 'all', label: t('ledger_filter_all') },
                    { value: 'debtors', label: t('ledger_filter_debtors') },
                  ]}
                  value={debtFilter}
                  onChange={(value) => setDebtFilter(value === 'debtors' ? 'debtors' : 'all')}
                />
              </View>
            </View>
            {showSearch ? (
              <TextField
                label={t('ledger_search_placeholder')}
                value={query}
                onChangeText={setQuery}
                placeholder={t('ledger_search_placeholder')}
              />
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon={<Users size={40} color={mutedIconColor} />}
            title={t('ledger_empty_customers')}
            subtitle={t('ledger_empty_customers_sub')}
            ctaLabel={t('ledger_new_customer')}
            onCta={() => router.push('/customer/new')}
          />
        }
        ListFooterComponent={
          loadingMore ? (
            <View className="items-center py-4">
              <ActivityIndicator color={primaryIconColor} />
            </View>
          ) : null
        }
      />
    );
  }

  return (
    <View className={`flex-1 ${surface.base}`}>
      <ScreenHeader
        title={t('ledger_customers_title')}
        large
        right={
          <IconButton
            icon={<Settings size={24} color={headerIconColor} />}
            onPress={() => {
              // refresh the persisted flag as the sheet opens (event handler,
              // not an effect — keeps react-hooks/set-state-in-effect happy)
              void isLockEnabled().then(setLockEnabledState);
              presentSheet(settingsSheetRef);
            }}
            accessibilityLabel={t('ledger_settings')}
          />
        }
      />
      {body}
      <Fab onPress={() => router.push('/entry')} accessibilityLabel={t('ledger_entry_title')} />

      <Sheet ref={sortSheetRef} snapPoints={['35%']}>
        <BottomSheetView className="gap-2 px-4 pb-8">
          <Text className={`text-lg font-semibold ${text.primary}`}>{t('ledger_sort')}</Text>
          {SORT_OPTIONS.map((option) => {
            const selected = option.value === sort;
            return (
              <Pressable
                key={option.value}
                onPress={() => onSelectSort(option.value)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={t(option.labelKey)}
                className="min-h-12 flex-row items-center justify-between rounded-lg px-3 active:bg-gray-100 dark:active:bg-gray-700"
                // selected via STYLE (runtime className toggles freeze-loop on RN 0.86)
                style={selected ? { backgroundColor: dark ? '#374151' : '#f3f4f6' } : undefined}
              >
                <Text
                  className="text-base"
                  style={{
                    color: selected
                      ? dark ? '#f9fafb' : '#111827'
                      : dark ? '#d1d5db' : '#4b5563',
                    fontWeight: selected ? '700' : '400',
                  }}
                >
                  {t(option.labelKey)}
                </Text>
                {selected ? <Check size={18} color={primaryIconColor} /> : null}
              </Pressable>
            );
          })}
        </BottomSheetView>
      </Sheet>

      <Sheet ref={settingsSheetRef} snapPoints={['55%']}>
        <BottomSheetView className="gap-6 px-4 pb-8">
          <Text className={`text-lg font-semibold ${text.primary}`}>{t('ledger_settings')}</Text>
          <View className="gap-2">
            <Text className={`text-xs font-medium ${text.secondary}`}>{t('ledger_language')}</Text>
            {/* Language endonyms are locale-invariant proper names — shown in their own language by convention, not translated. */}
            <SegmentedControl
              options={[
                { value: 'tr', label: 'Türkçe' },
                { value: 'en', label: 'English' },
              ]}
              value={lang}
              onChange={(value) => setLang(value === 'en' ? 'en' : 'tr')}
            />
          </View>
          <View className="flex-row items-center justify-between gap-3">
            <View className="flex-1 gap-0.5">
              <Text className={`text-base font-medium ${text.primary}`}>
                {t('lock_settings_toggle')}
              </Text>
              <Text className={`text-xs ${text.muted}`}>{t('lock_settings_sub')}</Text>
            </View>
            <Switch
              value={lockEnabled}
              onValueChange={(next) => {
                dismissSheet(settingsSheetRef);
                setPinModal(next ? 'setup' : 'disable');
              }}
              accessibilityLabel={t('lock_settings_toggle')}
            />
          </View>
          <Button label={t('nav_logout')} intent="neutral" onPress={onLogout} />
        </BottomSheetView>
      </Sheet>

      {pinModal ? (
        <PinSetupModal
          mode={pinModal}
          visible
          onDone={(changed) => {
            const mode = pinModal;
            setPinModal(null);
            if (changed && mode) {
              setLockEnabledState(mode === 'setup');
              toast.show({
                message: t(mode === 'setup' ? 'lock_enabled_toast' : 'lock_disabled_toast'),
                intent: 'success',
              });
            }
          }}
        />
      ) : null}
    </View>
  );
}
