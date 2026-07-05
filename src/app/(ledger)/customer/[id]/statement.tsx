// Statement preview + async send (job-poll) + revoke share links.
// The preview is the trust surface: itemized, dated, direction-labeled — the
// send job runs backend-side; this screen only triggers it and reflects status.
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Linking, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BalanceBadge } from '@/components/BalanceBadge';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { EmptyState, ErrorState } from '@/components/EmptyState';
import { ScreenHeader } from '@/components/ScreenHeader';
import { ConfirmSheet, presentSheet, useSheetRef } from '@/components/Sheet';
import { SkeletonHeader, SkeletonRow } from '@/components/Skeleton';
import { TxRow } from '@/components/TxRow';
import { useRequireAuth } from '@/context/auth';
import { useLang } from '@/context/lang';
import { useTenant } from '@/context/tenant';
import { useToast } from '@/context/toast';
import { usePermissions } from '@/hooks/usePermissions';
import {
  apiGet,
  apiPost,
  getErrorMessage,
  getFlowRunStatus,
  unwrapList,
  type Customer,
  type LedgerTransaction,
  type RevokeResp,
  type SendStatementResp,
  type StatementLinkInfo,
} from '@/lib/api';
import { relativeDate } from '@/lib/dates';
import { haptics } from '@/lib/haptics';
import type { TranslationKey } from '@/lib/i18n';
import { formatTRY, fromCents, toCents } from '@/lib/money';
import { badge, borderTok, surface, text } from '@/lib/ui-tokens';

const PREVIEW_ROW_CAP = 50;
const POLL_INTERVAL_MS = 1500;
const MAX_POLL_ATTEMPTS = 20;

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; error: unknown }
  | { status: 'success'; customer: Customer; txs: LedgerTransaction[] };

interface PreviewRow {
  tx: LedgerTransaction;
  runningBalance: string;
}

type LinkStatus = 'approved' | 'disputed' | 'revoked' | 'expired' | 'pending';

// Response wins over lifecycle: a customer decision is meaningful even on a
// link that later expired or was revoked.
function statementLinkStatus(link: StatementLinkInfo): LinkStatus {
  if (link.response) return link.response.decision === 'approve' ? 'approved' : 'disputed';
  if (link.revoked_at) return 'revoked';
  if (!link.is_active) return 'expired';
  return 'pending';
}

// Soft-badge pattern (mirrors BalanceBadge): bg token on the View, explicit
// text color on the Text — RN does not cascade text color from parent views.
const linkStatusCfg: Record<
  LinkStatus,
  { badgeCls: string; textCls: string; labelKey: TranslationKey }
> = {
  approved: {
    badgeCls: badge.emerald,
    textCls: 'text-emerald-700 dark:text-emerald-300',
    labelKey: 'ledger_response_approved',
  },
  disputed: {
    badgeCls: badge.rose,
    textCls: 'text-rose-700 dark:text-rose-300',
    labelKey: 'ledger_response_disputed',
  },
  revoked: {
    badgeCls: badge.gray,
    textCls: 'text-gray-700 dark:text-gray-200',
    labelKey: 'ledger_link_revoked_status',
  },
  expired: {
    badgeCls: badge.gray,
    textCls: 'text-gray-700 dark:text-gray-200',
    labelKey: 'ledger_link_expired_status',
  },
  pending: {
    badgeCls: badge.blue,
    textCls: 'text-blue-700 dark:text-blue-300',
    labelKey: 'ledger_response_pending',
  },
};

export default function StatementScreen() {
  const { user, loading: authLoading, token } = useRequireAuth();
  const { t, lang } = useLang();
  const { activeTenant } = useTenant();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { show } = useToast();
  const { hasPerm } = usePermissions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const revokeSheetRef = useSheetRef();

  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState(false);
  const [links, setLinks] = useState<StatementLinkInfo[]>([]);
  const [linksError, setLinksError] = useState<unknown>(null);
  const [refreshing, setRefreshing] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  // Clear the poll interval on unmount — terminal states clear it themselves.
  useEffect(() => stopPolling, [stopPolling]);

  const load = useCallback(
    (mode: 'initial' | 'refresh' = 'initial') => {
      if (!token || !id) return Promise.resolve();
      if (mode === 'initial') setState({ status: 'loading' });
      return Promise.all([
        apiGet<Customer>(`/customers/${id}/`, token),
        apiGet<LedgerTransaction[] | { results: LedgerTransaction[] }>(
          `/transactions/?customer=${id}`,
          token,
        ),
      ])
        .then(([customer, txData]) => {
          setState({ status: 'success', customer, txs: unwrapList(txData) });
        })
        .catch((error: unknown) => {
          // On pull-to-refresh keep the stale data on screen; surface via toast.
          if (mode === 'initial') setState({ status: 'error', error });
          else show({ message: getErrorMessage(error, t), intent: 'error' });
        });
    },
    [token, id, show, t],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const loadLinks = useCallback(() => {
    if (!token || !id) return Promise.resolve();
    return apiGet<StatementLinkInfo[]>(`/customers/${id}/statement-links/`, token)
      .then((data) => {
        setLinks(data);
        setLinksError(null);
      })
      .catch((error: unknown) => setLinksError(error));
  }, [token, id]);

  // Focus (fires on mount too): a customer may have responded to a link while
  // this screen was backgrounded behind the public statement page.
  useFocusEffect(
    useCallback(() => {
      void loadLinks();
    }, [loadLinks]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void Promise.all([load('refresh'), loadLinks()]).finally(() => setRefreshing(false));
  }, [load, loadLinks]);

  // Running balances are folded oldest→newest in integer cents (API returns
  // newest-first, so reverse-accumulate), then rows keep newest-first order.
  const previewRows = useMemo<PreviewRow[]>(() => {
    if (state.status !== 'success') return [];
    const byId = new Map<string, string>();
    let running = 0;
    for (let i = state.txs.length - 1; i >= 0; i--) {
      const tx = state.txs[i];
      running += tx.type === 'borc' ? toCents(tx.amount) : -toCents(tx.amount);
      byId.set(tx.id, fromCents(running));
    }
    return state.txs
      .slice(0, PREVIEW_ROW_CAP)
      .map((tx) => ({ tx, runningBalance: byId.get(tx.id) ?? '0.00' }));
  }, [state]);

  const failSend = useCallback(
    (message: string) => {
      stopPolling();
      haptics.error();
      setSendError(message);
      setSending(false);
    },
    [stopPolling],
  );

  // wa.me deep link: WhatsApp expects country-code digits without "+". Turkish
  // local format 05xx… becomes 905xx…; already-international 90… passes through.
  const openWhatsAppShare = useCallback(
    (customer: Customer, statementUrl: string) => {
      const message = t('ledger_share_message')
        .replace('{name}', customer.name)
        .replace('{balance}', formatTRY(customer.balance))
        .replace('{url}', statementUrl);
      const encoded = encodeURIComponent(message);
      const digits = customer.phone.replace(/\D/g, '');
      const normalized = digits.startsWith('0') ? `9${digits}` : digits;
      if (normalized.length === 0) {
        show({ message: t('ledger_no_phone'), intent: 'info' });
        return Linking.openURL(`https://wa.me/?text=${encoded}`);
      }
      return Linking.openURL(`https://wa.me/${normalized}?text=${encoded}`);
    },
    [t, show],
  );

  const startPolling = useCallback(
    (jobId: string, customer: Customer) => {
      let attempts = 0;
      let inFlight = false;
      pollRef.current = setInterval(() => {
        if (inFlight) return;
        attempts += 1;
        inFlight = true;
        getFlowRunStatus(jobId, token ?? undefined)
          .then((job) => {
            if (!pollRef.current) return; // stopped or unmounted mid-request
            if (job.state === 'COMPLETED') {
              stopPolling();
              haptics.success();
              show({ message: t('ledger_statement_sent'), intent: 'success' });
              const statementUrl =
                typeof job.result?.statement_url === 'string' ? job.result.statement_url : '';
              // Fire WhatsApp first, dismiss the modal only after — backing out
              // early would unmount before the OS handoff settles.
              openWhatsAppShare(customer, statementUrl)
                .catch((err: unknown) =>
                  show({ message: getErrorMessage(err, t), intent: 'error' }),
                )
                .finally(() => router.back());
            } else if (job.state === 'FAILED') {
              failSend(job.error || t('ledger_statement_failed'));
            } else if (attempts >= MAX_POLL_ATTEMPTS) {
              failSend(t('ledger_statement_failed'));
            }
          })
          .catch(() => {
            // Transient poll failure: keep trying until the attempt cap.
            if (pollRef.current && attempts >= MAX_POLL_ATTEMPTS) {
              failSend(t('ledger_statement_failed'));
            }
          })
          .finally(() => {
            inFlight = false;
          });
      }, POLL_INTERVAL_MS);
    },
    [token, stopPolling, failSend, show, t, router, openWhatsAppShare],
  );

  const onSend = useCallback(async () => {
    if (state.status !== 'success') return;
    setSendError(null);
    setSending(true);
    try {
      const resp = await apiPost<SendStatementResp>(
        `/customers/${id}/send-statement/`,
        {},
        token ?? undefined,
      );
      startPolling(resp.job_id, state.customer);
    } catch (err) {
      haptics.error();
      setSendError(getErrorMessage(err, t));
      setSending(false);
    }
  }, [id, token, startPolling, t, state]);

  const onRevoke = useCallback(async () => {
    setRevoking(true);
    try {
      await apiPost<RevokeResp>(`/customers/${id}/revoke-statement-links/`, {}, token ?? undefined);
      show({ message: t('ledger_links_revoked'), intent: 'info' });
      void loadLinks();
    } catch (err) {
      haptics.error();
      show({ message: getErrorMessage(err, t), intent: 'error' });
    } finally {
      setRevoking(false);
    }
  }, [id, token, show, t, loadLinks]);

  if (authLoading || !user) return null;
  if (!activeTenant) return null;

  const canManageStatement = hasPerm('ledger.send_statement');

  return (
    <View className={`flex-1 ${surface.base}`}>
      <ScreenHeader title={t('ledger_statement_title')} onBack={() => router.back()} />

      {state.status === 'loading' && (
        <View className="gap-4 px-4">
          <SkeletonHeader />
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </View>
      )}

      {state.status === 'error' && (
        <ErrorState
          message={getErrorMessage(state.error, t)}
          onRetry={() => void load()}
          retryLabel={t('ledger_retry')}
        />
      )}

      {state.status === 'success' && (
        <>
          <ScrollView
            className="flex-1"
            contentContainerClassName="gap-4 px-4 pb-4"
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          >
            <Card className="items-center gap-3">
              <Text className={`text-lg font-semibold ${text.primary}`} numberOfLines={1}>
                {state.customer.name}
              </Text>
              <BalanceBadge balance={state.customer.balance} size="lg" />
            </Card>

            <View className={`rounded-xl ${surface.raised} ${borderTok} overflow-hidden`}>
              {previewRows.length === 0 ? (
                <EmptyState title={t('ledger_empty_transactions')} />
              ) : (
                previewRows.map(({ tx, runningBalance }) => (
                  <TxRow key={tx.id} tx={tx} runningBalance={runningBalance} />
                ))
              )}
            </View>

            {(links.length > 0 || linksError !== null) && (
              <View className="gap-2">
                <Text className={`text-sm font-semibold ${text.secondary}`}>
                  {t('ledger_link_history')}
                </Text>
                {linksError !== null ? (
                  <Text className="text-sm text-rose-600 dark:text-rose-400">
                    {getErrorMessage(linksError, t)}
                  </Text>
                ) : (
                  <View className={`rounded-xl ${surface.raised} ${borderTok} overflow-hidden`}>
                    {links.map((link, index) => {
                      const status = statementLinkStatus(link);
                      const cfg = linkStatusCfg[status];
                      return (
                        <View
                          key={link.id}
                          className={`gap-1 px-4 py-3 ${
                            index > 0 ? 'border-t border-gray-200 dark:border-gray-700' : ''
                          }`}
                        >
                          <View className="flex-row items-center justify-between gap-2">
                            <Text className={`text-sm ${text.secondary}`}>
                              {relativeDate(link.created_at, lang)}
                            </Text>
                            <View className={`rounded-full px-2 py-0.5 ${cfg.badgeCls}`}>
                              <Text className={`text-xs font-semibold ${cfg.textCls}`}>
                                {t(cfg.labelKey)}
                              </Text>
                            </View>
                          </View>
                          {status === 'disputed' &&
                            link.response !== null &&
                            link.response.note !== '' && (
                              <Text className={`text-xs ${text.muted}`}>{link.response.note}</Text>
                            )}
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            )}
          </ScrollView>

          {canManageStatement && (
            <View className="gap-3 px-4 pt-2" style={{ paddingBottom: insets.bottom + 16 }}>
              {sendError !== null && (
                <Text
                  className="text-sm text-rose-600 dark:text-rose-400"
                  accessibilityLiveRegion="polite"
                >
                  {sendError}
                </Text>
              )}
              <Button
                label={sending ? t('ledger_sending') : t('ledger_share_whatsapp')}
                intent="primary"
                size="lg"
                loading={sending}
                onPress={onSend}
              />
              <Button
                label={t('ledger_revoke_links')}
                intent="neutral"
                size="lg"
                loading={revoking}
                disabled={sending}
                onPress={() => presentSheet(revokeSheetRef)}
              />
            </View>
          )}

          <ConfirmSheet
            sheetRef={revokeSheetRef}
            title={t('ledger_revoke_links')}
            message={t('ledger_revoke_confirm')}
            confirmLabel={t('ledger_revoke_links')}
            cancelLabel={t('cancel')}
            destructive
            onConfirm={onRevoke}
          />
        </>
      )}
    </View>
  );
}
