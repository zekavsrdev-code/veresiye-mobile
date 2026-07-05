// Calculator-style money keypad — replaces the OS keyboard for amount entry.
// Controlled by a RAW digit string ("1234,5"); the raw string (not a number)
// is the single source of truth so trailing-comma state is never lost and no
// float math ever touches money.
import { Pressable, Text, View } from 'react-native';
import { Delete } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { haptics } from '@/lib/haptics';
import { useLang } from '@/context/lang';
import { borderTok, text } from '@/lib/ui-tokens';

export interface AmountKeypadProps {
  raw: string;
  onRaw: (raw: string) => void;
}

const MAX_INT_DIGITS = 9;
const MAX_FRAC_DIGITS = 2;

// "1234,5" → "1234.50", "" → "0.00" — API-ready decimal string.
export function rawToDecimalString(raw: string): string {
  const [intPart = '', fracPart = ''] = raw.split(',');
  const int = intPart === '' ? '0' : intPart;
  const frac = (fracPart + '00').slice(0, MAX_FRAC_DIGITS);
  return `${int}.${frac}`;
}

// Live partial display with tr grouping: "1234,5" → "1.234,5", "" → "0".
// Regroups the int part manually — never Number()s the raw, so a trailing
// comma ("1234,") survives as the user typed it.
export function rawToDisplay(raw: string): string {
  const hasComma = raw.includes(',');
  const [intPart = '', fracPart = ''] = raw.split(',');
  const grouped = (intPart === '' ? '0' : intPart).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return hasComma ? `${grouped},${fracPart}` : grouped;
}

function applyKey(raw: string, key: string): string {
  if (key === 'back') return raw.slice(0, -1);
  if (key === ',') {
    if (raw.includes(',')) return raw;
    return raw === '' ? '0,' : `${raw},`;
  }
  // digit
  const [intPart = '', fracPart] = raw.split(',');
  if (raw.includes(',')) {
    if ((fracPart ?? '').length >= MAX_FRAC_DIGITS) return raw;
    return raw + key;
  }
  if (intPart === '0') return key === '0' ? raw : key; // leading zero replaced
  if (intPart.length >= MAX_INT_DIGITS) return raw;
  return raw + key;
}

const KEY_ROWS: string[][] = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  [',', '0', 'back'],
];

const keyCls =
  `min-h-14 flex-1 items-center justify-center rounded-2xl bg-white ${borderTok} ` +
  'active:bg-gray-100 dark:bg-gray-800 dark:active:bg-gray-700';

export function AmountKeypad({ raw, onRaw }: AmountKeypadProps) {
  const { t } = useLang();
  const { colorScheme } = useColorScheme();
  const iconColor = colorScheme === 'dark' ? '#f9fafb' : '#111827';

  const press = (key: string) => {
    haptics.light();
    const next = applyKey(raw, key);
    if (next !== raw) onRaw(next);
  };

  return (
    <View className="gap-2">
      {KEY_ROWS.map((row) => (
        <View key={row.join('-')} className="flex-row gap-2">
          {row.map((key) => (
            <Pressable
              key={key}
              className={keyCls}
              accessibilityRole="button"
              accessibilityLabel={key === 'back' ? t('delete') : key}
              onPress={() => press(key)}
            >
              {key === 'back' ? (
                <Delete size={28} color={iconColor} />
              ) : (
                <Text className={`text-2xl font-semibold ${text.primary}`}>{key}</Text>
              )}
            </Pressable>
          ))}
        </View>
      ))}
    </View>
  );
}
