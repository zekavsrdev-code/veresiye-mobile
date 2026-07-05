// Generic segment pill (e.g. Borç / Ödeme). Selected state is NEUTRAL+bold per
// design ruling — semantic color lives only in the small optional icon, never
// in the highlight fill itself.
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { haptics } from '@/lib/haptics';
import { text } from '@/lib/ui-tokens';

export interface SegmentOption {
  value: string;
  label: string;
  icon?: ReactNode;
}

export interface SegmentedControlProps {
  options: SegmentOption[];
  value: string;
  onChange: (value: string) => void;
}

export function SegmentedControl({ options, value, onChange }: SegmentedControlProps) {
  return (
    <View
      className="flex-row rounded-lg bg-gray-100 p-1 dark:bg-gray-900"
      accessibilityRole="tablist"
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            className={`min-h-11 flex-1 flex-row items-center justify-center gap-2 rounded-md ${
              selected ? 'bg-white shadow-sm dark:bg-gray-700' : ''
            }`}
            accessibilityRole="tab"
            accessibilityLabel={option.label}
            accessibilityState={{ selected }}
            onPress={() => {
              if (selected) return;
              haptics.selection();
              onChange(option.value);
            }}
          >
            {option.icon}
            <Text
              className={
                selected ? `text-base font-bold ${text.primary}` : `text-base ${text.muted}`
              }
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
