// 44px-floor icon-only tap target. accessibilityLabel is required by the type
// on purpose — an icon-only control is invisible to screen readers without it.
import type { ReactNode } from 'react';
import { Pressable } from 'react-native';

export interface IconButtonProps {
  icon: ReactNode;
  onPress: () => void;
  accessibilityLabel: string;
  className?: string;
}

export function IconButton({ icon, onPress, accessibilityLabel, className }: IconButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      className={`min-w-11 min-h-11 items-center justify-center rounded-full active:bg-gray-100 dark:active:bg-gray-800${className ? ` ${className}` : ''}`}
    >
      {icon}
    </Pressable>
  );
}
