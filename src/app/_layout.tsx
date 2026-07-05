import '@/global.css';

import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { Stack } from 'expo-router';
import { useColorScheme } from 'nativewind';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from '@/context/auth';
import { LangProvider } from '@/context/lang';
import { TenantProvider } from '@/context/tenant';
import { ToastProvider } from '@/context/toast';

// Provider order: Lang (pure) → Auth (api) → Tenant (needs auth) → Toast (UI).
// The Stack has no default header — each screen owns its chrome (ScreenHeader).
export default function RootLayout() {
  const { setColorScheme } = useColorScheme();

  // darkMode:'class' needs an explicit scheme; 'system' follows the OS setting.
  useEffect(() => {
    setColorScheme('system');
  }, [setColorScheme]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <LangProvider>
          <AuthProvider>
            <TenantProvider>
              <ToastProvider>
                <BottomSheetModalProvider>
                  <Stack screenOptions={{ headerShown: false }} />
                </BottomSheetModalProvider>
              </ToastProvider>
            </TenantProvider>
          </AuthProvider>
        </LangProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
