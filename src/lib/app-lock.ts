// App-lock persistence + lock-state module store. Mirrors the outbox.ts
// pattern: plain module state + a listener set, read via useSyncExternalStore —
// never React state mutated inside an effect body.
//
// PIN storage choice: the PIN is stored as a PLAIN value in SecureStore, not a
// hash. SecureStore already encrypts values at rest (iOS Keychain / Android
// Keystore) with no export path off-device, so a stored PIN is not meaningfully
// more exposed than a hash would be here — and this avoids hand-rolling SHA-256
// (no expo-crypto dependency added) for a value that never leaves the device.
import { AppState, type AppStateStatus } from 'react-native';

import { tokenStore } from './token-store';

const PIN_KEY = 'veresiye.applock.pin';
const ENABLED_KEY = 'veresiye.applock.enabled';
const BACKGROUND_THRESHOLD_MS = 60_000;

let locked = false;
let enabledCache = false;
let backgroundedAt: number | null = null;
let started = false;
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

export function subscribeLock(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getLockSnapshot(): boolean {
  return locked;
}

export async function isLockEnabled(): Promise<boolean> {
  const v = await tokenStore.get(ENABLED_KEY);
  enabledCache = v === '1';
  return enabledCache;
}

export async function hasPinSet(): Promise<boolean> {
  return (await tokenStore.get(PIN_KEY)) !== null;
}

export async function setLockEnabled(enabled: boolean, pin?: string): Promise<void> {
  if (enabled) {
    if (!pin) throw new Error('pin required to enable app lock');
    await tokenStore.set(PIN_KEY, pin);
    await tokenStore.set(ENABLED_KEY, '1');
  } else {
    await tokenStore.remove(PIN_KEY);
    await tokenStore.set(ENABLED_KEY, '0');
  }
  enabledCache = enabled;
}

export async function changePin(newPin: string): Promise<void> {
  await tokenStore.set(PIN_KEY, newPin);
}

export async function verifyPin(pin: string): Promise<boolean> {
  const stored = await tokenStore.get(PIN_KEY);
  return stored !== null && stored === pin;
}

export function unlock(): void {
  locked = false;
  notify();
}

/** Call once at app start — wires the AppState background/foreground watcher
 * and applies the "locked at launch" trigger if the setting is on. Idempotent. */
export async function initAppLock(): Promise<void> {
  if (started) return;
  started = true;
  const enabled = await isLockEnabled();
  if (enabled) {
    locked = true;
    notify();
  }
  AppState.addEventListener('change', (state: AppStateStatus) => {
    if (state === 'background' || state === 'inactive') {
      backgroundedAt = Date.now();
      return;
    }
    if (state === 'active') {
      if (
        enabledCache &&
        backgroundedAt !== null &&
        Date.now() - backgroundedAt > BACKGROUND_THRESHOLD_MS
      ) {
        locked = true;
        notify();
      }
      backgroundedAt = null;
    }
  });
}
