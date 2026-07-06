import '@/global.css';

import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { router, Stack } from 'expo-router';
import { colorScheme } from 'nativewind';
import { useEffect, useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { LockScreen } from '@/components/LockScreen';
import { AuthProvider, useAuth } from '@/context/auth';
import { LangProvider } from '@/context/lang';
import { TenantProvider } from '@/context/tenant';
import { ToastProvider, useToast } from '@/context/toast';
import { getLockSnapshot, initAppLock, subscribeLock } from '@/lib/app-lock';
import { addNotificationReceivedListener, addNotificationResponseListener } from '@/lib/push';

// darkMode:'class' needs an explicit scheme; 'system' follows the OS setting.
// NATIVE: set at MODULE level (before first render) — flipping it in a post-mount
// effect re-writes CSS variables on already-rendered components, which triggers
// css-interop "should upgrade" dev warnings on every later interaction.
// WEB: module level would run during SSR and throw ("not in a browser") — set it
// in a client-only effect instead.
if (Platform.OS !== 'web') {
  colorScheme.set('system');
}

// App-lock init + notification wiring live here (need useAuth/useToast, which
// only exist below their providers) — kept out of RootLayout so the provider
// tree above stays the single place that assembles context.
function AppShell() {
  const { user } = useAuth();
  const toast = useToast();
  const locked = useSyncExternalStore(subscribeLock, getLockSnapshot, () => false);

  useEffect(() => {
    void initAppLock();
  }, []);

  // Foreground delivery surfaces as a toast (guarded no-op pre-EAS-rebuild).
  useEffect(() => {
    return addNotificationReceivedListener((title, body) => {
      toast.show({ message: [title, body].filter(Boolean).join(': ') || title, intent: 'info' });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- toast identity is stable per ToastProvider
  }, []);

  // Notification tap → deep link. Only '/aging' is wired today (spec scope).
  useEffect(() => {
    return addNotificationResponseListener((url) => {
      if (url === '/aging') router.push('/aging');
    });
  }, []);

  return (
    <>
      {/* Single flat Stack on purpose: a nested (group) Stack layered a
          second react-native-screens container that swallowed all taps
          on RN 0.86/Fabric (scroll worked, presses died). Modals are
          configured here instead of a group _layout. */}
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="customer/[id]/index" />
        <Stack.Screen name="customer/new" options={{ presentation: 'modal' }} />
        <Stack.Screen name="customer/[id]/statement" options={{ presentation: 'modal' }} />
        <Stack.Screen name="entry" options={{ presentation: 'modal' }} />
      </Stack>
      {locked && user ? <LockScreen /> : null}
    </>
  );
}

// Provider order: Lang (pure) → Auth (api) → Tenant (needs auth) → Toast (UI).
// The Stack has no default header — each screen owns its chrome (ScreenHeader).
export default function RootLayout() {
  useEffect(() => {
    if (Platform.OS === 'web') {
      colorScheme.set('system');
    }
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <LangProvider>
          <AuthProvider>
            <TenantProvider>
              <ToastProvider>
                <BottomSheetModalProvider>
                  <AppShell />
                </BottomSheetModalProvider>
              </ToastProvider>
            </TenantProvider>
          </AuthProvider>
        </LangProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
