// Receivable aging — the collection worklist. Buckets up top (who is how late,
// in total), overdue customers below sorted by amount, tap-through to detail.
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { Card } from '@/components/Card';
import { EmptyState, ErrorState } from '@/components/EmptyState';
import { List, type ListRenderItemInfo } from '@/components/List';
import { ListRow } from '@/components/ListRow';
import { MoneyText } from '@/components/MoneyText';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SkeletonHeader, SkeletonRow } from '@/components/Skeleton';
import { useAuth, useRequireAuth } from '@/context/auth';
import { useLang } from '@/context/lang';
import { useTenant } from '@/context/tenant';
import { apiGet, getErrorMessage, type AgingReport } from '@/lib/api';
import { badge, surface, text } from '@/lib/ui-tokens';

type Status = 'loading' | 'error' | 'success';

type AgingCustomer = AgingReport['customers'][number];

const BUCKET_DEFS = [
  { key: 'd1_30', labelKey: 'aging_1_30' },
  { key: 'd31_60', labelKey: 'aging_31_60' },
  { key: 'd61_90', labelKey: 'aging_61_90' },
  { key: 'd90_plus', labelKey: 'aging_90_plus' },
] as const;

export default function AgingScreen() {
  const { user, loading: authLoading } = useRequireAuth();
  const { token } = useAuth();
  const { activeTenant } = useTenant();
  const { t } = useLang();
  const router = useRouter();

  const [report, setReport] = useState<AgingReport | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!token || !activeTenant) return;
    const data = await apiGet<AgingReport>(
      `/customers/aging/?tenant=${activeTenant.id}`,
      token,
    );
    setReport(data);
  }, [token, activeTenant]);

  // Focus-driven (not mount-driven): returning from a customer detail after a
  // payment must show the updated worklist. Initial status is already 'loading'.
  useFocusEffect(
    useCallback(() => {
      if (!token || !activeTenant) return;
      let active = true;
      load()
        .then(() => {
          if (active) setStatus('success');
        })
        .catch((err: unknown) => {
          if (!active) return;
          setErrorMsg(getErrorMessage(err, t));
          setStatus('error');
        });
      return () => {
        active = false;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps -- t is render-stable per lang
    }, [token, activeTenant, load]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load()
      .catch((err: unknown) => setErrorMsg(getErrorMessage(err, t)))
      .finally(() => setRefreshing(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- t is render-stable per lang
  }, [load]);

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<AgingCustomer>) => (
      <ListRow
        left={<Avatar name={item.name} />}
        title={item.name}
        right={
          <View className={`rounded-full px-2 py-0.5 ${badge.amber}`}>
            <MoneyText
              value={item.overdue_total}
              className="text-sm font-semibold text-amber-700 dark:text-amber-300"
            />
          </View>
        }
        onPress={() => router.push({ pathname: '/customer/[id]', params: { id: item.id } })}
      />
    ),
    [router],
  );

  const keyExtractor = useCallback((item: AgingCustomer) => item.id, []);

  if (authLoading || !user) return null;

  const header = report ? (
    <View className="gap-3 px-4 pb-2 pt-2">
      <Card className="items-center gap-1">
        <Text className={`text-sm ${text.muted}`}>{t('aging_total_overdue')}</Text>
        <MoneyText
          value={report.total_overdue}
          className="text-3xl font-bold text-amber-600 dark:text-amber-400"
        />
      </Card>
      <Card className="gap-2">
        {BUCKET_DEFS.map(({ key, labelKey }) => (
          <View key={key} className="flex-row items-center justify-between">
            <Text className={`text-sm ${text.secondary}`}>{t(labelKey)}</Text>
            <MoneyText
              value={report.buckets[key]}
              className={`text-sm font-semibold ${text.primary}`}
            />
          </View>
        ))}
      </Card>
      {report.customers.length > 0 ? (
        <Text className={`pt-2 text-sm font-medium ${text.muted}`}>
          {t('aging_worklist_title')}
        </Text>
      ) : null}
    </View>
  ) : null;

  return (
    <View className={`flex-1 ${surface.base}`}>
      <ScreenHeader title={t('aging_title')} onBack={() => router.back()} />

      {status === 'loading' && (
        <View className="flex-1">
          <View className="px-4 pb-2 pt-2">
            <SkeletonHeader />
          </View>
          {Array.from({ length: 5 }, (_, i) => (
            <SkeletonRow key={i} />
          ))}
        </View>
      )}

      {status === 'error' && (
        <ErrorState
          message={errorMsg}
          onRetry={() => {
            setStatus('loading');
            load()
              .then(() => setStatus('success'))
              .catch((err: unknown) => {
                setErrorMsg(getErrorMessage(err, t));
                setStatus('error');
              });
          }}
          retryLabel={t('ledger_retry')}
        />
      )}

      {status === 'success' && report && (
        <List
          data={report.customers}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          ListHeaderComponent={header}
          ListEmptyComponent={
            <EmptyState title={t('aging_empty')} subtitle={t('aging_empty_sub')} />
          }
          refreshing={refreshing}
          onRefresh={onRefresh}
        />
      )}
    </View>
  );
}
