// Quick-entry modal — the core fast loop (spec §4c). Ideal path from customer
// detail is 3 taps: [Veresiye Ekle] → digits → [Kaydet]. From the FAB an inline
// customer picker is the only extra step. Amount is a raw keypad string
// (single source of truth, no float math); submit is a plain POST (the lists
// that would benefit from optimistic UI live on other screens).
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowDownLeft, ArrowUpRight, ChevronDown, UserPlus } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';

import { AmountKeypad, rawToDecimalString, rawToDisplay } from '@/components/AmountKeypad';
import { Avatar } from '@/components/Avatar';
import { BalanceBadge } from '@/components/BalanceBadge';
import { Button } from '@/components/Button';
import { EmptyState, ErrorState } from '@/components/EmptyState';
import { List, type ListRenderItemInfo } from '@/components/List';
import { ListRow } from '@/components/ListRow';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SegmentedControl } from '@/components/SegmentedControl';
import { Skeleton, SkeletonRow } from '@/components/Skeleton';
import { TextField } from '@/components/TextField';
import { useAuth, useRequireAuth } from '@/context/auth';
import { useLang } from '@/context/lang';
import { useTenant } from '@/context/tenant';
import { useToast } from '@/context/toast';
import {
  apiGet,
  apiPost,
  getErrorMessage,
  isApiError,
  unwrapList,
  type Customer,
  type LedgerTransaction,
  type Paginated,
} from '@/lib/api';
import { enqueueTransaction } from '@/lib/outbox';
import { addDaysLocalISO, formatDueDate } from '@/lib/dates';
import { haptics } from '@/lib/haptics';
import { toCents, type TxType } from '@/lib/money';
import { newIdempotencyKey } from '@/lib/uuid';
import { borderTok, surface, text } from '@/lib/ui-tokens';

// Due-term quick chips (days). Term-picking beats a calendar for the fast loop:
// esnaf credit is "1 hafta / 2 hafta / 1 ay", not an arbitrary date.
const DUE_TERM_DAYS = [7, 14, 30] as const;

// "150.00" → "150", "150.50" → "150,50" — decimal param back to keypad raw form.
function decimalToRaw(decimal: string): string {
  if (!/^\d+(\.\d{1,2})?$/.test(decimal)) return '';
  const [intPart = '0', frac = ''] = decimal.split('.');
  const int = intPart.replace(/^0+(?=\d)/, '');
  const trimmedFrac = frac.replace(/0+$/, '');
  if (int === '0' && trimmedFrac === '') return '';
  return trimmedFrac ? `${int},${trimmedFrac}` : int;
}

type PickerState =
  | { status: 'loading' }
  | { status: 'error'; error: unknown }
  | { status: 'success'; customers: Customer[]; next: string | null };

const SEARCH_DEBOUNCE_MS = 300;

// Some deployments leave the endpoint unpaginated (plain array) — normalize both.
function nextCursor(data: Paginated<Customer> | Customer[]): string | null {
  return Array.isArray(data) ? null : data.next;
}

// Hex map (not classes): `type` flips at runtime, and toggling a class string on
// a mounted css-interop component freeze-loops on RN 0.86 — color via style.
const amountColorHex: Record<TxType, { light: string; dark: string }> = {
  borc: { light: '#d97706', dark: '#fbbf24' }, // amber-600 / amber-400
  odeme: { light: '#059669', dark: '#34d399' }, // emerald-600 / emerald-400
};

export default function EntryScreen() {
  const { user, loading: authLoading } = useRequireAuth();
  const { t, lang } = useLang();
  const { activeTenant } = useTenant();
  const { token } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const params = useLocalSearchParams<{
    customer?: string;
    type?: string;
    amount?: string;
    note?: string;
  }>();

  const customerParam = params.customer;
  // Launched from the FAB when no customer is pre-bound; only then is the chip
  // pressable to reopen the picker.
  const fromFab = !customerParam;

  const [customerId, setCustomerId] = useState<string | null>(customerParam ?? null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [pickerOpen, setPickerOpen] = useState(fromFab);
  const [picker, setPicker] = useState<PickerState>({ status: 'loading' });
  const [loadingMore, setLoadingMore] = useState(false);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  // Guards against out-of-order responses when the debounced search refires.
  const pickerRequestSeq = useRef(0);
  const [type, setType] = useState<TxType>(params.type === 'odeme' ? 'odeme' : 'borc');
  const [raw, setRaw] = useState(() => decimalToRaw(params.amount ?? ''));
  const [note, setNote] = useState(params.note ?? '');
  const [dueDays, setDueDays] = useState<number | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // One key per logical entry: a timeout-retry of the same submit replays
  // instead of double-inserting (backend client_request_id constraint).
  const idempotencyKey = useRef(newIdempotencyKey());

  // Chip name when launched with a bound customer. Cross-tenant/stale id → 404
  // → fall back to the picker so the entry can still be completed.
  useEffect(() => {
    if (!customerParam || !token) return;
    let active = true;
    apiGet<Customer>(`/customers/${customerParam}/`, token)
      .then((customer) => {
        if (active) setSelectedCustomer(customer);
      })
      .catch(() => {
        if (!active) return;
        setCustomerId(null);
        setPickerOpen(true);
      });
    return () => {
      active = false;
    };
  }, [customerParam, token]);

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedQuery(query.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [query]);

  const loadCustomers = useCallback(() => {
    if (!token || !activeTenant) return;
    const seq = ++pickerRequestSeq.current;
    setPicker({ status: 'loading' });
    const searchParam = debouncedQuery ? `&search=${encodeURIComponent(debouncedQuery)}` : '';
    apiGet<Paginated<Customer> | Customer[]>(
      `/customers/?tenant=${activeTenant.id}${searchParam}`,
      token,
    )
      .then((data) => {
        if (seq !== pickerRequestSeq.current) return;
        setPicker({
          status: 'success',
          customers: unwrapList(data),
          next: nextCursor(data),
        });
      })
      .catch((error: unknown) => {
        if (seq !== pickerRequestSeq.current) return;
        setPicker({ status: 'error', error });
      });
  }, [token, activeTenant, debouncedQuery]);

  useEffect(() => {
    if (pickerOpen) loadCustomers();
  }, [pickerOpen, loadCustomers]);

  // Returning from "new customer" (create → detail → back) must show the fresh
  // customer in the picker — the mount-time fetch above is stale by then.
  useFocusEffect(
    useCallback(() => {
      if (pickerOpen) loadCustomers();
    }, [pickerOpen, loadCustomers]),
  );

  const loadMoreCustomers = useCallback(() => {
    if (picker.status !== 'success' || !picker.next || loadingMore || !token) return;
    const seq = pickerRequestSeq.current;
    setLoadingMore(true);
    apiGet<Paginated<Customer> | Customer[]>(picker.next, token)
      .then((data) => {
        if (seq !== pickerRequestSeq.current) return;
        setPicker((prev) =>
          prev.status === 'success'
            ? {
                status: 'success',
                customers: [...prev.customers, ...unwrapList(data)],
                next: nextCursor(data),
              }
            : prev,
        );
      })
      .catch((error: unknown) => {
        if (seq !== pickerRequestSeq.current) return;
        toast.show({ message: getErrorMessage(error, t), intent: 'error' });
      })
      .finally(() => setLoadingMore(false));
  }, [picker, loadingMore, token, toast, t]);

  const pickCustomer = useCallback((customer: Customer) => {
    haptics.selection();
    setSelectedCustomer(customer);
    setCustomerId(customer.id);
    setPickerOpen(false);
  }, []);

  const renderCustomer = useCallback(
    ({ item }: ListRenderItemInfo<Customer>) => (
      <ListRow
        left={<Avatar name={item.name} />}
        title={item.name}
        right={<BalanceBadge balance={item.balance} size="sm" />}
        onPress={() => pickCustomer(item)}
      />
    ),
    [pickCustomer],
  );

  const keyExtractor = useCallback((item: Customer) => item.id, []);

  if (authLoading || !user) return null;

  const dark = colorScheme === 'dark';
  const amberIcon = dark ? '#fbbf24' : '#d97706'; // amber-400 / amber-600
  const emeraldIcon = dark ? '#34d399' : '#059669'; // emerald-400 / emerald-600
  const neutralIcon = dark ? '#f9fafb' : '#111827'; // gray-50 / gray-900

  const decimalAmount = rawToDecimalString(raw);
  const canSave = decimalAmount !== '0.00' && !!customerId && !!activeTenant;

  const submit = async () => {
    if (toCents(decimalAmount) <= 0) {
      haptics.warning();
      setFormError(t('ledger_amount_positive'));
      return;
    }
    if (!customerId || !activeTenant || !token) return;
    setFormError(null);
    setSubmitting(true);
    try {
      await apiPost<LedgerTransaction>(
        '/transactions/',
        {
          tenant: activeTenant.id,
          customer: customerId,
          type,
          amount: decimalAmount,
          note: note.trim(),
          client_request_id: idempotencyKey.current,
          ...(type === 'borc' && dueDays !== null
            ? { due_date: addDaysLocalISO(dueDays) }
            : {}),
        },
        token,
      );
      haptics.success();
      toast.show({ message: t('ledger_saved'), intent: 'success' });
      router.back();
    } catch (err) {
      // No connection → queue instead of failing. The outbox replays with the
      // same idempotency key, so this exact save can never double-insert.
      if (isApiError(err) && err.status === 0) {
        await enqueueTransaction({
          key: idempotencyKey.current,
          tenant: activeTenant.id,
          customer: customerId,
          type,
          amount: decimalAmount,
          note: note.trim(),
          ...(type === 'borc' && dueDays !== null
            ? { due_date: addDaysLocalISO(dueDays) }
            : {}),
        });
        haptics.success();
        toast.show({ message: t('ledger_queued_offline'), intent: 'success' });
        router.back();
        return;
      }
      haptics.error();
      setFormError(getErrorMessage(err, t));
      setSubmitting(false);
    }
  };

  if (pickerOpen) {
    return (
      <View className={`flex-1 ${surface.base}`}>
        <ScreenHeader title={t('ledger_entry_title')} onBack={() => router.back()} />
        <View className="px-4 pb-3">
          <TextField
            label={t('ledger_pick_customer')}
            value={query}
            onChangeText={setQuery}
            placeholder={t('ledger_search_placeholder')}
          />
        </View>
        {picker.status === 'loading' ? (
          <View>
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </View>
        ) : picker.status === 'error' ? (
          <ErrorState
            message={getErrorMessage(picker.error, t)}
            onRetry={loadCustomers}
            retryLabel={t('ledger_retry')}
          />
        ) : picker.customers.length === 0 && debouncedQuery === '' ? (
          <EmptyState
            title={t('ledger_empty_customers')}
            subtitle={t('ledger_empty_customers_sub')}
            ctaLabel={t('ledger_new_customer')}
            onCta={() => router.push('/customer/new')}
          />
        ) : (
          <View className="flex-1">
            <List
              data={picker.customers}
              renderItem={renderCustomer}
              keyExtractor={keyExtractor}
              onEndReached={loadMoreCustomers}
              onEndReachedThreshold={0.5}
              ListHeaderComponent={
                // Styled as an ACTION (blue + icon), not a plain row — plain text
                // reads as "just another customer" and gets missed.
                <Pressable
                  onPress={() => router.push('/customer/new')}
                  accessibilityRole="button"
                  accessibilityLabel={t('ledger_new_customer')}
                  className="mx-4 my-2 min-h-12 flex-row items-center justify-center gap-2 rounded-lg border border-dashed border-blue-400 active:bg-blue-50 dark:border-blue-500 dark:active:bg-blue-950"
                >
                  <UserPlus size={18} color={dark ? '#60a5fa' : '#2563eb'} />
                  <Text className="text-base font-semibold text-blue-600 dark:text-blue-400">
                    {t('ledger_new_customer')}
                  </Text>
                </Pressable>
              }
              ListFooterComponent={
                loadingMore ? (
                  <View className="items-center py-4">
                    <ActivityIndicator color={dark ? '#9ca3af' : '#6b7280'} />
                  </View>
                ) : null
              }
            />
          </View>
        )}
      </View>
    );
  }

  return (
    <View className={`flex-1 ${surface.base}`}>
      <ScreenHeader title={t('ledger_entry_title')} onBack={() => router.back()} />
      {/* Keeps the note field + Save button visible above the keyboard (customer/new.tsx pattern). */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView keyboardShouldPersistTaps="handled">
          <View className="gap-4 px-4 pb-8">
            {/* Selected-customer chip — pressable only when launched from the FAB. */}
            <Pressable
              onPress={() => setPickerOpen(true)}
              disabled={!fromFab}
              accessibilityRole="button"
              accessibilityLabel={selectedCustomer?.name ?? t('ledger_pick_customer')}
              accessibilityState={{ disabled: !fromFab }}
              className={`min-h-11 flex-row items-center gap-2 self-start rounded-full py-1 pl-1 pr-3 ${surface.raised} ${borderTok} active:bg-gray-100 dark:active:bg-gray-700`}
            >
              <Avatar name={selectedCustomer?.name ?? '?'} />
              {selectedCustomer ? (
                <Text className={`text-base font-medium ${text.primary}`} numberOfLines={1}>
                  {selectedCustomer.name}
                </Text>
              ) : (
                <Skeleton className="h-5 w-32" />
              )}
              {fromFab ? <ChevronDown size={16} color={neutralIcon} /> : null}
            </Pressable>

            <SegmentedControl
              options={[
                {
                  value: 'borc',
                  label: t('ledger_segment_debt'),
                  icon: <ArrowUpRight size={16} color={amberIcon} />,
                },
                {
                  value: 'odeme',
                  label: t('ledger_segment_payment'),
                  icon: <ArrowDownLeft size={16} color={emeraldIcon} />,
                },
              ]}
              value={type}
              onChange={(value) => setType(value === 'odeme' ? 'odeme' : 'borc')}
            />

            {/* Live amount — raw display keeps a trailing comma exactly as typed. */}
            <View className="items-center py-4">
              <Text className={`text-sm ${text.muted}`}>{t('ledger_amount')}</Text>
              <Text
                className="text-4xl font-bold"
                style={{
                  fontVariant: ['tabular-nums'],
                  color: dark ? amountColorHex[type].dark : amountColorHex[type].light,
                }}
                accessibilityLabel={`${t('ledger_amount')}: ${rawToDisplay(raw)} ₺`}
              >
                {`${rawToDisplay(raw)} ₺`}
              </Text>
            </View>

            <AmountKeypad
              raw={raw}
              onRaw={(next) => {
                setRaw(next);
                if (formError) setFormError(null);
              }}
            />

            {/* Due-term chips — debts only; payments have no due date. */}
            {type === 'borc' ? (
              <View className="gap-2">
                <Text className={`text-xs font-medium ${text.muted}`}>
                  {t('ledger_due_label')}
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {[null, ...DUE_TERM_DAYS].map((days) => {
                    const selected = dueDays === days;
                    return (
                      <Pressable
                        key={days ?? 'none'}
                        onPress={() => {
                          haptics.selection();
                          setDueDays(days);
                        }}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        className={`min-h-11 items-center justify-center rounded-full border px-4 ${
                          selected
                            ? 'border-blue-600 bg-blue-600 dark:border-blue-500 dark:bg-blue-500'
                            : `${borderTok} ${surface.raised} active:bg-gray-100 dark:active:bg-gray-700`
                        }`}
                      >
                        <Text
                          className={`text-sm font-medium ${selected ? 'text-white' : text.secondary}`}
                        >
                          {days === null
                            ? t('ledger_due_none')
                            : t('ledger_due_days').replace('{n}', String(days))}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                {dueDays !== null ? (
                  <Text className={`text-xs ${text.muted}`}>
                    {t('ledger_due_on').replace(
                      '{date}',
                      formatDueDate(addDaysLocalISO(dueDays), lang),
                    )}
                  </Text>
                ) : null}
              </View>
            ) : null}

            <TextField label={t('ledger_note_placeholder')} value={note} onChangeText={setNote} />

            {formError ? (
              <Text className="text-sm text-rose-600 dark:text-rose-400">{formError}</Text>
            ) : null}

            <Button
              label={t('save')}
              size="lg"
              onPress={submit}
              disabled={!canSave}
              loading={submitting}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
