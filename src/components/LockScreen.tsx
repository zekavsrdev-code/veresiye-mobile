// Full-screen app-lock overlay — mounted above the navigator in _layout.tsx
// whenever the lock module store reports `locked`. Tries biometric once on
// mount (guarded — no-ops on the current dev client until an EAS rebuild),
// PIN keypad is always the fallback.
import { Fingerprint } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { PinDots, PinPad } from '@/components/PinPad';
import { useLang } from '@/context/lang';
import { unlock, verifyPin } from '@/lib/app-lock';
import { authenticateAsync, isBiometricAvailable } from '@/lib/biometrics';
import { haptics } from '@/lib/haptics';
import { surface, text } from '@/lib/ui-tokens';

const MIN_PIN_LENGTH = 4;
const MAX_PIN_LENGTH = 6;

export function LockScreen() {
  const { t } = useLang();
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const triedBiometricRef = useRef(false);

  const tryBiometric = useCallback(async () => {
    const ok = await authenticateAsync(t('lock_screen_title'));
    if (ok) {
      haptics.success();
      unlock();
    }
  }, [t]);

  useEffect(() => {
    let active = true;
    void isBiometricAvailable().then((available) => {
      if (!active) return;
      setBiometricAvailable(available);
      if (available && !triedBiometricRef.current) {
        triedBiometricRef.current = true;
        void tryBiometric();
      }
    });
    return () => {
      active = false;
    };
  }, [tryBiometric]);

  const checkPin = useCallback(async (candidate: string) => {
    const ok = await verifyPin(candidate);
    if (ok) {
      haptics.success();
      unlock();
      return;
    }
    if (candidate.length >= MAX_PIN_LENGTH) {
      haptics.error();
      setError(true);
      setPin('');
    }
  }, []);

  const onDigit = useCallback(
    (digit: string) => {
      setPin((prev) => {
        if (prev.length >= MAX_PIN_LENGTH) return prev;
        const next = prev + digit;
        if (next.length >= MIN_PIN_LENGTH) void checkPin(next);
        return next;
      });
      setError(false);
    },
    [checkPin],
  );

  const onBackspace = useCallback(() => {
    setPin((prev) => prev.slice(0, -1));
    setError(false);
  }, []);

  const iconColor = colorScheme === 'dark' ? '#f9fafb' : '#111827';

  return (
    <View
      className={`absolute inset-0 z-50 ${surface.base}`}
      style={{ paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }}
      accessibilityViewIsModal
    >
      <View className="flex-1 justify-center gap-8 px-8">
        <Text
          className={`text-center text-xl font-bold ${text.primary}`}
          accessibilityRole="header"
        >
          {t('lock_screen_title')}
        </Text>

        <PinDots filled={pin.length} />

        <Text
          className="min-h-5 text-center text-sm text-rose-600 dark:text-rose-400"
          accessibilityLiveRegion="polite"
        >
          {error ? t('lock_incorrect') : ''}
        </Text>

        <PinPad onDigit={onDigit} onBackspace={onBackspace} backspaceLabel={t('delete')} />

        {biometricAvailable ? (
          <Button
            label={t('lock_use_biometric')}
            intent="neutral"
            icon={<Fingerprint size={18} color={iconColor} />}
            onPress={() => void tryBiometric()}
          />
        ) : null}
      </View>
    </View>
  );
}
