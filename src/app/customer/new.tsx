// New-customer modal. Single-screen form: required name + optional phone,
// with contact-book import to skip typing. Validation and API errors stay
// inline (form remains open); success closes via replace → detail (toast).
import { useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { BookUser } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { ListRow } from '@/components/ListRow';
import { ScreenHeader } from '@/components/ScreenHeader';
import { TextField } from '@/components/TextField';
import { useRequireAuth } from '@/context/auth';
import { useLang } from '@/context/lang';
import { useTenant } from '@/context/tenant';
import { useToast } from '@/context/toast';
import { apiPost, getErrorMessage, type Customer } from '@/lib/api';
import { listContactsWithPhones, normalizePhone, type PickableContact } from '@/lib/contacts';
import { haptics } from '@/lib/haptics';
import { surface, text } from '@/lib/ui-tokens';

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
  const [pickerOpen, setPickerOpen] = useState(false);
  const [contacts, setContacts] = useState<PickableContact[] | null>(null);
  const [contactQuery, setContactQuery] = useState('');
  const { colorScheme } = useColorScheme();

  if (authLoading || !user) return null;

  const openContactPicker = () => {
    haptics.selection();
    setPickerOpen(true);
    // Loaded lazily on open (permission prompt fires here, not at screen mount).
    void listContactsWithPhones().then(setContacts);
  };

  const pickContact = (contact: PickableContact) => {
    haptics.selection();
    setName(contact.name);
    setPhone(normalizePhone(contact.phone));
    setNameError(null);
    setPickerOpen(false);
  };

  const filteredContacts = (contacts ?? []).filter((c) =>
    contactQuery.trim() === ''
      ? true
      : c.name.toLocaleLowerCase('tr').includes(contactQuery.trim().toLocaleLowerCase('tr')),
  );

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
          <Pressable
            onPress={openContactPicker}
            accessibilityRole="button"
            accessibilityLabel={t('contacts_pick_button')}
            className="min-h-12 flex-row items-center justify-center gap-2 rounded-lg border border-dashed border-blue-400 active:bg-blue-50 dark:border-blue-500 dark:active:bg-blue-950"
          >
            <BookUser size={18} color={colorScheme === 'dark' ? '#60a5fa' : '#2563eb'} />
            <Text className="text-base font-semibold text-blue-600 dark:text-blue-400">
              {t('contacts_pick_button')}
            </Text>
          </Pressable>
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

      {/* Contact picker — permission asked on open; guarded lib returns [] when
          the native module is missing (pre-rebuild dev client). */}
      <Modal visible={pickerOpen} animationType="slide" onRequestClose={() => setPickerOpen(false)}>
        <SafeAreaView className={`flex-1 ${surface.base}`}>
          <ScreenHeader title={t('contacts_pick_title')} onBack={() => setPickerOpen(false)} />
          <View className="px-4 pb-3">
            <TextField
              label={t('contacts_pick_title')}
              value={contactQuery}
              onChangeText={setContactQuery}
              placeholder={t('contacts_search_placeholder')}
            />
          </View>
          {contacts !== null && filteredContacts.length === 0 ? (
            <EmptyState title={t('contacts_empty')} />
          ) : (
            <FlatList
              data={filteredContacts}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <ListRow
                  left={<Avatar name={item.name} />}
                  title={item.name}
                  subtitle={item.phone}
                  onPress={() => pickContact(item)}
                />
              )}
            />
          )}
          <View className="px-4 pb-6">
            <Text className={`text-center text-xs ${text.muted}`}>
              {contacts === null ? t('loading') : ''}
            </Text>
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
}
