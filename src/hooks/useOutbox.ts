import { useMemo, useSyncExternalStore } from 'react';

import { getOutboxSnapshot, subscribeOutbox, type OutboxEntry } from '@/lib/outbox';

// Live view of queued (not-yet-synced) ledger writes, optionally per customer.
export function usePendingTransactions(customerId?: string): OutboxEntry[] {
  const all = useSyncExternalStore(subscribeOutbox, getOutboxSnapshot, getOutboxSnapshot);
  return useMemo(
    () => (customerId ? all.filter((e) => e.customer === customerId) : [...all]),
    [all, customerId],
  );
}
