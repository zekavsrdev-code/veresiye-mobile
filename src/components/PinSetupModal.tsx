// PIN setup / disable flow for the app lock (home settings sheet entry point).
// Setup: enter (4-6 digits) → confirm → enable. Disable: verify current → off.
// Explicit Continue button (variable PIN length — no auto-submit ambiguity).
import { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { PinDots, PinPad } from '@/components/PinPad';
import { useLang } from '@/context/lang';
import { setLockEnabled, verifyPin } from '@/lib/app-lock';
import { haptics } from '@/lib/haptics';
import { surface, text } from '@/lib/ui-tokens';

const MIN_PIN_LENGTH = 4;
const MAX_PIN_LENGTH = 6;

export type PinSetupMode = 'setup' | 'disable';

export interface PinSetupModalProps {
  mode: PinSetupMode;
  visible: boolean;
  onDone: (changed: boolean) => void;
}

export function PinSetupModal({ mode, visible, onDone }: PinSetupModalProps) {
  const { t } = useLang();
  const [step, setStep] = useState<'enter' | 'confirm'>('enter');
  const [pin, setPin] = useState('');
  const [firstPin, setFirstPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setStep('enter');
    setPin('');
    setFirstPin('');
    setError(null);
    setBusy(false);
  };

  const close = (changed: boolean) => {
    reset();
    onDone(changed);
  };

  const title =
    mode === 'disable'
      ? t('lock_disable_title')
      : step === 'enter'
        ? t('lock_setup_title')
        : t('lock_confirm_title');
  const subtitle =
    mode === 'disable'
      ? t('lock_disable_subtitle')
      : step === 'enter'
        ? t('lock_setup_subtitle')
        : t('lock_confirm_subtitle');

  const submit = async () => {
    if (pin.length < MIN_PIN_LENGTH || busy) return;
    setBusy(true);
    try {
      if (mode === 'disable') {
        if (await verifyPin(pin)) {
          haptics.success();
          await setLockEnabled(false);
          close(true);
          return;
        }
        haptics.error();
        setError(t('lock_incorrect'));
        setPin('');
        return;
      }
      if (step === 'enter') {
        setFirstPin(pin);
        setPin('');
        setStep('confirm');
        return;
      }
      if (pin !== firstPin) {
        haptics.error();
        setError(t('lock_mismatch'));
        setPin('');
        setStep('enter');
        setFirstPin('');
        return;
      }
      await setLockEnabled(true, pin);
      haptics.success();
      close(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={() => close(false)}>
      <SafeAreaView className={`flex-1 ${surface.base}`}>
        <View className="flex-1 justify-center gap-6 px-6">
          <View className="items-center gap-1">
            <Text className={`text-xl font-bold ${text.primary}`}>{title}</Text>
            <Text className={`text-sm ${text.muted}`}>{subtitle}</Text>
          </View>
          <PinDots filled={pin.length} />
          {error ? (
            <Text
              className="text-center text-sm text-rose-600 dark:text-rose-400"
              accessibilityLiveRegion="polite"
            >
              {error}
            </Text>
          ) : null}
          <PinPad
            disabled={busy}
            backspaceLabel={t('cancel')}
            onDigit={(digit) => {
              setError(null);
              setPin((prev) => (prev.length >= MAX_PIN_LENGTH ? prev : prev + digit));
            }}
            onBackspace={() => setPin((prev) => prev.slice(0, -1))}
          />
          <Button
            label={t('lock_continue')}
            intent="primary"
            onPress={submit}
            disabled={pin.length < MIN_PIN_LENGTH || busy}
          />
          <Pressable
            onPress={() => close(false)}
            accessibilityRole="button"
            className="min-h-11 items-center justify-center"
          >
            <Text className={`text-sm font-medium ${text.muted}`}>{t('cancel')}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
