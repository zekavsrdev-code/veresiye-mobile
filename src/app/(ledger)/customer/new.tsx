// New-customer modal. Single-screen form: required name + optional phone.
// Validation and API errors stay inline (form remains open); success closes
// via replace → detail, so the confirmation is a toast.
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Button } from '@/components/Button';
import { ScreenHeader } from '@/components/ScreenHeader';
import { TextField } from '@/components/TextField';
import { useRequireAuth } from '@/context/auth';
import { useLang } from '@/context/lang';
import { useTenant } from '@/context/tenant';
import { useToast } from '@/context/toast';
import { apiPost, getErrorMessage, type Customer } from '@/lib/api';
import { haptics } from '@/lib/haptics';
import { surface } from '@/lib/ui-tokens';

export default function NewCustomerScreen() {
  const { user, token, loading: authLoading } = useRequireAuth();
  const { t } = useLang();
  const { activeTenant } = useTenant();
  const router = useRouter();
  const toast = useToast();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (authLoading || !user) return null;

  const handleSave = async () => {
    if (!name.trim()) {
      setNameError(t('ledger_name_required'));
      haptics.warning();
      return;
    }
    if (!activeTenant || !token) return;

    setSubmitting(true);
    setApiError(null);
    try {
      const created = await apiPost<Customer>(
        '/customers/',
        { tenant: activeTenant.id, name: name.trim(), phone: phone.trim() },
        token,
      );
      haptics.success();
      toast.show({ message: t('ledger_customer_created'), intent: 'success' });
      router.replace(`/customer/${created.id}`);
    } catch (err) {
      haptics.error();
      setApiError(getErrorMessage(err, t));
      setSubmitting(false);
    }
  };

  return (
    <View className={`flex-1 ${surface.base}`}>
      <ScreenHeader title={t('ledger_new_customer')} onBack={() => router.back()} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <View className="flex-1 px-4 gap-4" pointerEvents={submitting ? 'none' : 'auto'}>
          <TextField
            label={t('ledger_customer_name')}
            value={name}
            onChangeText={(v) => {
              setName(v);
              if (nameError) setNameError(null);
            }}
            error={nameError}
            autoFocus
            autoCapitalize="words"
            testID="new-customer-name"
          />
          <TextField
            label={t('ledger_customer_phone')}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            testID="new-customer-phone"
          />
          {apiError ? (
            <Text
              className="text-sm text-rose-600 dark:text-rose-400"
              accessibilityLiveRegion="polite"
            >
              {apiError}
            </Text>
          ) : null}
          <Button
            label={t('save')}
            onPress={handleSave}
            intent="primary"
            loading={submitting}
          />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
