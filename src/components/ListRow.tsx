import { memo, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { text } from '@/lib/ui-tokens';

interface ListRowProps {
  left?: ReactNode;
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  accessibilityLabel?: string;
}

export const ListRow = memo(function ListRow({
  left,
  title,
  subtitle,
  right,
  onPress,
  onLongPress,
  accessibilityLabel,
}: ListRowProps) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={!onPress && !onLongPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? (subtitle ? `${title}, ${subtitle}` : title)}
      className="min-h-11 flex-row items-center gap-3 px-4 py-3 active:bg-gray-50 dark:active:bg-gray-800"
    >
      {left}
      <View className="flex-1">
        <Text className={`text-base font-medium ${text.primary}`} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text className={`text-sm ${text.muted}`} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </Pressable>
  );
});
