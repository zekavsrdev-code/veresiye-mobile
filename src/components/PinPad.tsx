// Digit-only keypad + progress dots — shared by LockScreen (verify) and the
// home settings PIN setup flow (set/confirm). Visual language mirrors
// AmountKeypad (rounded keys, same sizing) but without comma/decimal handling.
import { Delete } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { Pressable, Text, View } from 'react-native';

import { haptics } from '@/lib/haptics';
import { borderTok, text } from '@/lib/ui-tokens';

export interface PinPadProps {
  onDigit: (digit: string) => void;
  onBackspace: () => void;
  backspaceLabel: string;
  disabled?: boolean;
}

const ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['', '0', 'back'],
];

const keyCls =
  `min-h-14 flex-1 items-center justify-center rounded-2xl bg-white ${borderTok} ` +
  'active:bg-gray-100 dark:bg-gray-800 dark:active:bg-gray-700';

export function PinPad({ onDigit, onBackspace, backspaceLabel, disabled }: PinPadProps) {
  const { colorScheme } = useColorScheme();
  const iconColor = colorScheme === 'dark' ? '#f9fafb' : '#111827';

  return (
    <View className="gap-2" pointerEvents={disabled ? 'none' : 'auto'}>
      {ROWS.map((row, rowIndex) => (
        <View key={rowIndex} className="flex-row gap-2">
          {row.map((key, keyIndex) => {
            // Compound key: the empty spacer's positional key `0` would otherwise
            // collide with the '0' digit key (React treats numeric 0 and '0' as
            // the same key) → "two children with the same key" warning.
            if (key === '') return <View key={`sp-${rowIndex}-${keyIndex}`} className="flex-1" />;
            return (
              <Pressable
                key={key}
                className={keyCls}
                accessibilityRole="button"
                accessibilityLabel={key === 'back' ? backspaceLabel : key}
                onPress={() => {
                  haptics.light();
                  if (key === 'back') onBackspace();
                  else onDigit(key);
                }}
              >
                {key === 'back' ? (
                  <Delete size={24} color={iconColor} />
                ) : (
                  <Text className={`text-2xl font-semibold ${text.primary}`}>{key}</Text>
                )}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

export interface PinDotsProps {
  filled: number;
  max?: number;
}

export function PinDots({ filled, max = 6 }: PinDotsProps) {
  return (
    <View className="flex-row items-center justify-center gap-3">
      {Array.from({ length: max }, (_, i) => (
        <View
          key={i}
          className={`h-3.5 w-3.5 rounded-full ${
            i < filled ? 'bg-blue-600 dark:bg-blue-400' : 'bg-gray-300 dark:bg-gray-600'
          }`}
        />
      ))}
    </View>
  );
}
