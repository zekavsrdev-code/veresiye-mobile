// Token persistence adapter — the ONLY place that touches expo-secure-store.
// Native-module boundary guard: if SecureStore is unavailable or version-skewed
// (e.g. an outdated Expo Go whose native module lacks the JS method names, or
// web where SecureStore doesn't exist), fall back to in-memory storage so the
// app still runs with a non-persistent session instead of crashing at launch.
import * as SecureStore from 'expo-secure-store';

let memory: Record<string, string> = {};
let warned = false;

function warnOnce(err: unknown) {
  if (warned) return;
  warned = true;
  console.warn(
    'SecureStore unavailable — falling back to in-memory token storage (session will not persist). ' +
      'If on a device, update the Expo Go app to match the project SDK.',
    err,
  );
}

export const tokenStore = {
  async get(key: string): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(key);
    } catch (err) {
      warnOnce(err);
      return memory[key] ?? null;
    }
  },

  async set(key: string, value: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch (err) {
      warnOnce(err);
      memory[key] = value;
    }
  },

  async remove(key: string): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (err) {
      warnOnce(err);
    }
    delete memory[key];
  },
};
