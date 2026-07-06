// Resilient key-value storage — the ONLY place that touches AsyncStorage.
//
// Native-module boundary guard (like token-store.ts, but stricter): the
// @react-native-async-storage default export is `null` — not a throwing stub —
// when its native module isn't linked (e.g. an Expo Go / dev client built
// BEFORE the dependency was added). Calling `.getItem` on null throws
// "AsyncStorage is null". So we detect null ONCE up front and fall back to an
// in-memory Map: callers keep working (non-persistent) instead of crashing, and
// there's no per-call try/catch noise. After an EAS dev-client rebuild the real
// module is present and persistence just works.
import AsyncStorageDefault from '@react-native-async-storage/async-storage';

interface KV {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

const memory = new Map<string, string>();

const memoryStore: KV = {
  async getItem(key) {
    return memory.has(key) ? (memory.get(key) as string) : null;
  },
  async setItem(key, value) {
    memory.set(key, value);
  },
  async removeItem(key) {
    memory.delete(key);
  },
};

// `AsyncStorageDefault` is null when the native module is missing. `?.getItem`
// existence check keeps this safe even if the shape ever changes.
const nativeAvailable =
  AsyncStorageDefault != null && typeof AsyncStorageDefault.getItem === 'function';

if (!nativeAvailable) {
  console.warn(
    'AsyncStorage native module unavailable — using in-memory storage ' +
      '(data will not persist across restarts). Rebuild the dev client to enable persistence.',
  );
}

export const kvStore: KV = nativeAvailable ? (AsyncStorageDefault as KV) : memoryStore;

export const kvPersistent = nativeAvailable;
