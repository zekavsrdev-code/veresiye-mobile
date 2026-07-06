// Edit-customer screen (name/phone PATCH). Mirrors new.tsx: inline errors keep
// the form open; success closes back to the detail with a toast.
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { ScreenHeader } from '@/components/ScreenHeader';
import { TextField } from '@/components/TextField';
import { useRequireAuth } from '@/context/auth';
import { useLang } from '@/context/lang';
import { useToast } from '@/context/toast';
import { apiGet, apiPatch, getErrorMessage, type Customer } from '@/lib/api';
import { haptics } from '@/lib/haptics';
import { surface } from '@/lib/ui-tokens';

export default function EditCustomerScreen() {
  const { user, token, loading: authLoading } = useRequireAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useLang();
  const router = useRouter();
  const toast = useToast();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token || !id) return;
    let active = true;
    apiGet<Customer>(`/customers/${id}/`, token)
      .then((customer) => {
        if (!active) return;
        setName(customer.name);
        setPhone(customer.phone);
        setLoaded(true);
      })
      .catch((err) => {
        if (active) setApiError(getErrorMessage(err, t));
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- t is render-stable per lang
  }, [token, id]);

  if (authLoading || !user) return null;

  const handleSave = async () => {
    if (!name.trim()) {
      setNameError(t('ledger_name_required'));
      haptics.warning();
      return;
    }
    if (!token) return;
    setSubmitting(true);
    setApiError(null);
    try {
      await apiPatch<Customer>(
        `/customers/${id}/`,
        { name: name.trim(), phone: phone.trim() },
        token,
      );
      haptics.success();
      toast.show({ message: t('ledger_customer_updated'), intent: 'success' });
      router.back();
    } catch (err) {
      haptics.error();
      setApiError(getErrorMessage(err, t));
      setSubmitting(false);
    }
  };

  return (
    <View className={`flex-1 ${surface.base}`}>
      <ScreenHeader title={t('ledger_edit_customer')} onBack={() => router.back()} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        {!loaded && !apiError ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator />
          </View>
        ) : (
          <View className="flex-1 px-4 gap-4" pointerEvents={submitting ? 'none' : 'auto'}>
            <TextField
              label={t('ledger_customer_name')}
              value={name}
              onChangeText={(v) => {
                setName(v);
                if (nameError) setNameError(null);
              }}
              error={nameError}
              autoCapitalize="words"
              testID="edit-customer-name"
            />
            <TextField
              label={t('ledger_customer_phone')}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              testID="edit-customer-phone"
            />
            {apiError ? (
              <Text
                className="text-sm text-rose-600 dark:text-rose-400"
                accessibilityLiveRegion="polite"
              >
                {apiError}
              </Text>
            ) : null}
            {loaded ? (
              <Button
                label={t('save')}
                onPress={handleSave}
                intent="primary"
                loading={submitting}
              />
            ) : null}
          </View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}
