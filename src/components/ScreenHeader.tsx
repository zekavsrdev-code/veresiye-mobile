// Per-screen chrome (root layout has headerShown: false). Transparent bg so
// the screen surface shows through; safe-area top inset applied here.
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { useLang } from '@/context/lang';
import { text } from '@/lib/ui-tokens';

interface ScreenHeaderProps {
  title: string;
  onBack?: () => void;
  right?: ReactNode;
  large?: boolean;
}

export function ScreenHeader({ title, onBack, right, large }: ScreenHeaderProps) {
  const insets = useSafeAreaInsets();
  const { t } = useLang();
  const { colorScheme } = useColorScheme();
  const iconColor = colorScheme === 'dark' ? '#f9fafb' : '#111827';

  return (
    <View
      className="flex-row items-center px-4 pb-3 gap-3"
      style={{ paddingTop: insets.top }}
    >
      {onBack ? (
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel={t('ledger_back')}
          className="min-w-11 min-h-11 items-center justify-center rounded-full active:bg-gray-100 dark:active:bg-gray-800"
        >
          <ChevronLeft size={24} color={iconColor} />
        </Pressable>
      ) : null}
      <Text
        className={`flex-1 ${large ? 'text-2xl font-bold' : 'text-lg font-semibold'} ${text.primary}`}
        numberOfLines={1}
        accessibilityRole="header"
      >
        {title}
      </Text>
      {right ?? null}
    </View>
  );
}
