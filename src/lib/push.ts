// Push registration adapter — the ONLY place that touches expo-notifications /
// expo-constants for this. Native-module boundary guard: on the current dev
// client (no EAS rebuild yet) every call degrades to a no-op + console.warn
// instead of crashing the app.
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { apiDelete, apiPost } from './api';

let warned = false;
function warnOnce(err: unknown) {
  if (warned) return;
  warned = true;
  console.warn(
    'expo-notifications unavailable — push registration disabled until an EAS dev-client rebuild.',
    err,
  );
}

try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
} catch (err) {
  warnOnce(err);
}

// Remembered so logout can deregister the exact token that was registered —
// the server call is a plain POST/DELETE by token value, no local persistence needed.
let registeredExpoToken: string | null = null;

function nativePlatform(): 'ios' | 'android' | null {
  return Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : null;
}

/** Idempotent on the server — safe to call after every login and on every app start. */
export async function registerPushToken(apiToken: string): Promise<void> {
  const platform = nativePlatform();
  if (!platform) return;
  try {
    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== 'granted') {
      status = (await Notifications.requestPermissionsAsync()).status;
    }
    if (status !== 'granted') return;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (typeof projectId !== 'string') return;

    const { data: expoPushToken } = await Notifications.getExpoPushTokenAsync({ projectId });
    registeredExpoToken = expoPushToken;
    await apiPost('/devices/', { token: expoPushToken, platform }, apiToken);
  } catch (err) {
    warnOnce(err);
  }
}

/** Call BEFORE clearing the session on logout — needs the still-valid Bearer token. */
export async function unregisterPushToken(apiToken: string): Promise<void> {
  if (!registeredExpoToken) return;
  const tokenToRemove = registeredExpoToken;
  registeredExpoToken = null;
  try {
    await apiDelete('/devices/', apiToken, { token: tokenToRemove });
  } catch (err) {
    warnOnce(err);
  }
}

/** Foreground delivery (app open) — caller decides how to surface it (toast). */
export function addNotificationReceivedListener(
  onReceive: (title: string, body: string) => void,
): () => void {
  try {
    const sub = Notifications.addNotificationReceivedListener((notification) => {
      const { title, body } = notification.request.content;
      onReceive(title ?? '', body ?? '');
    });
    return () => sub.remove();
  } catch (err) {
    warnOnce(err);
    return () => {};
  }
}

/** Notification tap (foreground, background or cold start). */
export function addNotificationResponseListener(onUrl: (url: string) => void): () => void {
  try {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, unknown>;
      if (typeof data?.url === 'string') onUrl(data.url);
    });
    return () => sub.remove();
  } catch (err) {
    warnOnce(err);
    return () => {};
  }
}
