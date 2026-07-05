import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth, useRequireAuth } from '@/context/auth';
import { useLang } from '@/context/lang';

// Protected home. Live reference for the app's auth-guard pattern (mirrors the
// web app/notes/page.tsx contract). Replace the body with your own domain screen.
export default function HomeScreen() {
  const { user, loading } = useRequireAuth();
  const { logout } = useAuth();
  const { t } = useLang();

  if (loading || !user) return null;

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-gray-900">
      <View className="flex-1 items-center justify-center gap-3 px-6">
        <Text className="text-2xl font-bold text-gray-900 dark:text-white">
          {t('home_welcome')}, {user.first_name || user.username}
        </Text>
        <Text className="text-center text-sm text-gray-500 dark:text-gray-400">
          {t('home_subtitle')}
        </Text>
        <Pressable
          onPress={logout}
          className="mt-4 rounded-md bg-blue-600 px-4 py-2 active:opacity-80">
          <Text className="font-medium text-white">{t('nav_logout')}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
