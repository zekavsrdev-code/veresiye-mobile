// Self-service onboarding, two steps to first value: (1) account, (2) shop.
// Config-gated by ALLOW_PUBLIC_REGISTRATION (the backend enforces it too — the
// gate here only hides a door that would 403). Field errors stay inline; the
// screen never dead-ends: a user who registered but bailed on the shop step
// re-enters at step 2 on next launch (no tenant yet → index redirects here).
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { useAuth } from '@/context/auth';
import { useLang } from '@/context/lang';
import { useTenant } from '@/context/tenant';
import { apiPost, getErrorMessage, isApiError, type Tenant } from '@/lib/api';
import { haptics } from '@/lib/haptics';
import { useSystemConfig } from '@/hooks/useSystemConfig';

export default function RegisterScreen() {
  const { user, token, register, loading } = useAuth();
  const { activeTenant, loading: tenantLoading, refresh } = useTenant();
  const { t } = useLang();
  const router = useRouter();
  const config = useSystemConfig();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [shopName, setShopName] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Signed in AND has a shop → nothing to do here.
  useEffect(() => {
    if (!loading && user && !tenantLoading && activeTenant) router.replace('/');
  }, [loading, user, tenantLoading, activeTenant, router]);

  const step: 1 | 2 = user ? 2 : 1;

  async function onCreateAccount() {
    const errors: Record<string, string> = {};
    if (!username.trim()) errors.username = t('register_username_required');
    if (!email.trim()) errors.email = t('register_email_required');
    if (password.length < 8) errors.password = t('register_password_min');
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      haptics.warning();
      return;
    }
    setSubmitting(true);
    setApiError(null);
    try {
      await register({ username: username.trim(), email: email.trim(), password });
      haptics.success();
    } catch (err) {
      haptics.error();
      if (isApiError(err) && err.errors) {
        const mapped: Record<string, string> = {};
        for (const [field, messages] of Object.entries(err.errors)) {
          mapped[field] = messages.join(' ');
        }
        setFieldErrors(mapped);
      } else {
        setApiError(getErrorMessage(err, t));
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function onCreateShop() {
    if (!shopName.trim()) {
      setFieldErrors({ shop: t('register_shop_required') });
      haptics.warning();
      return;
    }
    setSubmitting(true);
    setApiError(null);
    try {
      await apiPost<Tenant>('/tenants/', { name: shopName.trim() }, token ?? undefined);
      await refresh();
      haptics.success();
      router.replace('/');
    } catch (err) {
      haptics.error();
      setApiError(getErrorMessage(err, t));
    } finally {
      setSubmitting(false);
    }
  }

  const registrationClosed = config !== null && !config.allow_public_registration && step === 1;

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-gray-900">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <ScrollView
          contentContainerClassName="flex-grow justify-center gap-4 px-6 py-8"
          keyboardShouldPersistTaps="handled"
        >
          <View className="mb-2 gap-1">
            <Text className="text-2xl font-bold text-gray-900 dark:text-white">
              {step === 1 ? t('register_title') : t('register_shop_title')}
            </Text>
            <Text className="text-sm text-gray-500 dark:text-gray-400">
              {step === 1 ? t('register_subtitle') : t('register_shop_subtitle')}
            </Text>
            <Text className="text-xs text-gray-400 dark:text-gray-500">
              {t('register_step_of').replace('{step}', String(step))}
            </Text>
          </View>

          {registrationClosed ? (
            <>
              <Text className="text-sm text-amber-600 dark:text-amber-400">
                {t('register_closed')}
              </Text>
              <Button label={t('register_back_to_login')} onPress={() => router.replace('/login')} />
            </>
          ) : step === 1 ? (
            <>
              <TextField
                label={t('username')}
                value={username}
                onChangeText={(v) => setUsername(v)}
                error={fieldErrors.username ?? null}
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="username"
                testID="register-username"
              />
              <TextField
                label={t('register_email')}
                value={email}
                onChangeText={(v) => setEmail(v)}
                error={fieldErrors.email ?? null}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="emailAddress"
                testID="register-email"
              />
              <TextField
                label={t('password')}
                value={password}
                onChangeText={(v) => setPassword(v)}
                error={fieldErrors.password ?? null}
                secureTextEntry
                textContentType="newPassword"
                testID="register-password"
              />
              {/* Trust microcopy: first fintech contact — say the data is safe. */}
              <Text className="text-xs text-gray-400 dark:text-gray-500">
                {t('register_trust_note')}
              </Text>
              {apiError ? (
                <Text className="text-sm text-rose-600 dark:text-rose-400" accessibilityLiveRegion="polite">
                  {apiError}
                </Text>
              ) : null}
              <Button
                label={t('register_btn')}
                onPress={onCreateAccount}
                intent="primary"
                loading={submitting}
              />
              <Button label={t('register_back_to_login')} onPress={() => router.replace('/login')} />
            </>
          ) : (
            <>
              <TextField
                label={t('register_shop_name')}
                value={shopName}
                onChangeText={(v) => {
                  setShopName(v);
                  if (fieldErrors.shop) setFieldErrors({});
                }}
                error={fieldErrors.shop ?? null}
                autoFocus
                autoCapitalize="words"
                testID="register-shop-name"
              />
              {apiError ? (
                <Text className="text-sm text-rose-600 dark:text-rose-400" accessibilityLiveRegion="polite">
                  {apiError}
                </Text>
              ) : null}
              <Button
                label={t('register_shop_btn')}
                onPress={onCreateShop}
                intent="primary"
                loading={submitting}
              />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
