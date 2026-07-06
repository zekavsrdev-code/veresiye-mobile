// Offline outbox for ledger writes (transactions only — the critical fast
// loop). A no-signal save is queued here and replayed when connectivity
// returns; the server's (tenant, client_request_id) unique constraint makes
// every replay idempotent, so a retry can never double-insert.
//
// Scope decision: customer CREATION is not queued — a queued transaction would
// then need a temp-id remap when the customer materializes. Recording a debt
// for an EXISTING customer is the offline moment that matters at the counter.
//
// Storage goes through kv-store, which transparently falls back to an in-memory
// map when the AsyncStorage native module isn't linked (pre-rebuild dev client)
// — the queue still works, just without persistence across app restarts.
import { AppState } from 'react-native';

import { apiPost, isApiError } from './api';
import { kvStore } from './kv-store';

export interface OutboxEntry {
  key: string; // client_request_id — the idempotency key
  tenant: string;
  customer: string;
  type: 'borc' | 'odeme';
  amount: string;
  note: string;
  due_date?: string;
  queuedAt: string;
  attempts: number;
  /** Set when the server permanently rejected the entry (4xx) — needs user action. */
  failedError?: string;
}

const STORAGE_KEY = 'veresiye.outbox.v1';
const RETRY_INTERVAL_MS = 30_000;

let queue: OutboxEntry[] = [];
let initialized = false;
let flushing = false;
let authToken: string | null = null;
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

async function persist(): Promise<void> {
  // kvStore never throws on a missing native module (in-memory fallback).
  await kvStore.setItem(STORAGE_KEY, JSON.stringify(queue));
}

export async function initOutbox(): Promise<void> {
  if (initialized) return;
  initialized = true;
  try {
    const raw = await kvStore.getItem(STORAGE_KEY);
    if (raw) {
      queue = JSON.parse(raw) as OutboxEntry[];
      notify();
    }
  } catch {
    // corrupt/partial JSON — start with a fresh queue
  }
  // Foregrounding is the natural "am I back online?" moment.
  AppState.addEventListener('change', (state) => {
    if (state === 'active') void flushOutbox();
  });
  setInterval(() => {
    if (queue.length > 0) void flushOutbox();
  }, RETRY_INTERVAL_MS);
}

/** AuthProvider feeds the token; a fresh token triggers a flush attempt. */
export function setOutboxToken(token: string | null): void {
  authToken = token;
  if (token) void flushOutbox();
}

export function subscribeOutbox(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getOutboxEntries(customerId?: string): OutboxEntry[] {
  return customerId ? queue.filter((e) => e.customer === customerId) : [...queue];
}

/** Referentially-stable snapshot for useSyncExternalStore — every mutation
 * below replaces the array, so a changed ref === a changed queue. */
export function getOutboxSnapshot(): readonly OutboxEntry[] {
  return queue;
}

export function getOutboxCount(): number {
  return queue.length;
}

export async function enqueueTransaction(
  entry: Omit<OutboxEntry, 'queuedAt' | 'attempts' | 'failedError'>,
): Promise<void> {
  queue = [...queue, { ...entry, queuedAt: new Date().toISOString(), attempts: 0 }];
  await persist();
  notify();
  void flushOutbox();
}

export async function removeOutboxEntry(key: string): Promise<void> {
  queue = queue.filter((e) => e.key !== key);
  await persist();
  notify();
}

/** Drain the queue oldest-first. Stops on connectivity/server errors (retried
 * later); marks permanent 4xx rejections as failed for user resolution —
 * silently dropping a money entry is never acceptable. */
export async function flushOutbox(): Promise<void> {
  if (flushing || !authToken || queue.length === 0) return;
  flushing = true;
  try {
    for (const entry of [...queue]) {
      if (entry.failedError) continue; // waits for user action
      try {
        await apiPost(
          '/transactions/',
          {
            tenant: entry.tenant,
            customer: entry.customer,
            type: entry.type,
            amount: entry.amount,
            note: entry.note,
            ...(entry.due_date ? { due_date: entry.due_date } : {}),
            client_request_id: entry.key,
          },
          authToken,
        );
        queue = queue.filter((e) => e.key !== entry.key);
        await persist();
        notify();
      } catch (err) {
        const permanent =
          isApiError(err) &&
          err.status >= 400 && err.status < 500 &&
          err.status !== 401 && err.status !== 429;
        if (permanent) {
          const message = err instanceof Error ? err.message : String(err);
          queue = queue.map((e) =>
            e.key === entry.key ? { ...e, failedError: message } : e,
          );
          await persist();
          notify();
          continue;
        }
        queue = queue.map((e) =>
          e.key === entry.key ? { ...e, attempts: e.attempts + 1 } : e,
        );
        await persist();
        notify();
        break; // offline / server down — stop, the retry loop will re-enter
      }
    }
  } finally {
    flushing = false;
  }
}
