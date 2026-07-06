// Primary tappable text action. Variant logic lives in cva so every intent's
// light/dark + pressed classes stay in one type-safe place.
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { cva, type VariantProps } from 'class-variance-authority';
import { useColorScheme } from 'nativewind';

const container = cva('flex-row items-center justify-center rounded-lg', {
  variants: {
    intent: {
      primary: 'bg-blue-600 active:bg-blue-700 dark:bg-blue-500 dark:active:bg-blue-600',
      success: 'bg-emerald-600 active:bg-emerald-700 dark:bg-emerald-500 dark:active:bg-emerald-600',
      warning: 'bg-amber-600 active:bg-amber-700 dark:bg-amber-500 dark:active:bg-amber-600',
      destructive: 'bg-rose-600 active:bg-rose-700 dark:bg-rose-500 dark:active:bg-rose-600',
      neutral: 'bg-gray-200 active:bg-gray-300 dark:bg-gray-700 dark:active:bg-gray-600',
      ghost: 'bg-transparent active:bg-gray-100 dark:active:bg-gray-800',
    },
    size: {
      sm: 'min-h-11 px-3',
      md: 'min-h-11 px-4',
      lg: 'min-h-12 px-5',
    },
  },
  defaultVariants: { intent: 'primary', size: 'md' },
});

const label = cva('font-semibold', {
  variants: {
    intent: {
      primary: 'text-white',
      success: 'text-white',
      warning: 'text-white',
      destructive: 'text-white',
      neutral: 'text-gray-900 dark:text-gray-50',
      ghost: 'text-blue-600 dark:text-blue-400',
    },
    size: {
      sm: 'text-sm',
      md: 'text-base',
      lg: 'text-lg',
    },
  },
  defaultVariants: { intent: 'primary', size: 'md' },
});

type ButtonVariants = VariantProps<typeof container>;

export interface ButtonProps {
  label: string;
  onPress: () => void;
  intent?: ButtonVariants['intent'];
  size?: ButtonVariants['size'];
  loading?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
}

function spinnerColor(intent: ButtonProps['intent'], dark: boolean): string {
  if (intent === 'neutral') return dark ? '#f9fafb' : '#111827'; // gray-50 / gray-900
  if (intent === 'ghost') return dark ? '#60a5fa' : '#2563eb'; // blue-400 / blue-600
  return '#ffffff';
}

export function Button({
  label: labelText,
  onPress,
  intent = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
}: ButtonProps) {
  const { colorScheme } = useColorScheme();
  const blocked = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={blocked}
      accessibilityRole="button"
      accessibilityLabel={labelText}
      accessibilityState={{ disabled: blocked, busy: loading }}
      className={container({ intent, size })}
      // disabled/loading via STYLE, never className toggles: flipping a class
      // string on a mounted css-interop component freeze-loops on RN 0.86.
      style={{ opacity: disabled ? 0.5 : 1 }}
    >
      {/* Loading keeps width+height: content goes transparent, spinner overlays. */}
      <View
        className="flex-row items-center justify-center gap-2"
        style={{ opacity: loading ? 0 : 1 }}
      >
        {icon}
        <Text className={label({ intent, size })}>{labelText}</Text>
      </View>
      {loading ? (
        <View className="absolute inset-0 items-center justify-center">
          <ActivityIndicator color={spinnerColor(intent, colorScheme === 'dark')} />
        </View>
      ) : null}
    </Pressable>
  );
}
