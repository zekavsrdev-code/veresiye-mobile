import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/context/auth';
import { useLang } from '@/context/lang';
import { getErrorMessage } from '@/lib/api';

export default function LoginScreen() {
  const { login, user, loading } = useAuth();
  const { t } = useLang();
  const router = useRouter();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Already signed in (e.g. token restored on launch) → bounce to home.
  useEffect(() => {
    if (!loading && user) router.replace('/');
  }, [loading, user, router]);

  async function onSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      await login(username.trim(), password);
      router.replace('/');
    } catch (err) {
      // Form stays open → inline error (design rule: toast only on redirect/close).
      setError(getErrorMessage(err, t));
    } finally {
      setSubmitting(false);
    }
  }

  const inputCls =
    'w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 ' +
    'dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200';

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-gray-900">
      <View className="flex-1 justify-center gap-4 px-6">
        <View className="mb-2 gap-1">
          <Text className="text-2xl font-bold text-gray-900 dark:text-white">{t('app_name')}</Text>
          <Text className="text-sm text-gray-500 dark:text-gray-400">{t('login_subtitle')}</Text>
        </View>

        <View className="gap-1">
          <Text className="text-xs font-medium text-gray-600 dark:text-gray-300">
            {t('username')}
          </Text>
          <TextInput
            className={inputCls}
            value={username}
            onChangeText={setUsername}
            placeholder={t('username_placeholder')}
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="username"
          />
        </View>

        <View className="gap-1">
          <Text className="text-xs font-medium text-gray-600 dark:text-gray-300">
            {t('password')}
          </Text>
          <TextInput
            className={inputCls}
            value={password}
            onChangeText={setPassword}
            placeholder={t('password_placeholder')}
            secureTextEntry
            textContentType="password"
          />
        </View>

        {error ? <Text className="text-sm text-rose-600 dark:text-rose-400">{error}</Text> : null}

        <Pressable
          onPress={onSubmit}
          disabled={submitting}
          className="mt-2 h-11 flex-row items-center justify-center rounded-md bg-blue-600 active:opacity-80 disabled:opacity-60">
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="font-medium text-white">{t('login_btn')}</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
