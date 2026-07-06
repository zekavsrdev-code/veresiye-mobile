import '@/global.css';

import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { Stack } from 'expo-router';
import { colorScheme } from 'nativewind';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from '@/context/auth';
import { LangProvider } from '@/context/lang';
import { TenantProvider } from '@/context/tenant';
import { ToastProvider } from '@/context/toast';

// darkMode:'class' needs an explicit scheme; 'system' follows the OS setting.
// NATIVE: set at MODULE level (before first render) — flipping it in a post-mount
// effect re-writes CSS variables on already-rendered components, which triggers
// css-interop "should upgrade" dev warnings on every later interaction.
// WEB: module level would run during SSR and throw ("not in a browser") — set it
// in a client-only effect instead.
if (Platform.OS !== 'web') {
  colorScheme.set('system');
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
                  {/* Single flat Stack on purpose: a nested (group) Stack layered a
                      second react-native-screens container that swallowed all taps
                      on RN 0.86/Fabric (scroll worked, presses died). Modals are
                      configured here instead of a group _layout. */}
                  <Stack screenOptions={{ headerShown: false }}>
                    <Stack.Screen name="index" />
                    <Stack.Screen name="login" />
                    <Stack.Screen name="customer/[id]/index" />
                    <Stack.Screen name="customer/new" options={{ presentation: 'modal' }} />
                    <Stack.Screen
                      name="customer/[id]/statement"
                      options={{ presentation: 'modal' }}
                    />
                    <Stack.Screen name="entry" options={{ presentation: 'modal' }} />
                  </Stack>
                </BottomSheetModalProvider>
              </ToastProvider>
            </TenantProvider>
          </AuthProvider>
        </LangProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
