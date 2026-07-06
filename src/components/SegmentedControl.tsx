// Generic segment pill (e.g. Borç / Ödeme). Selected state is NEUTRAL+bold per
// design ruling — semantic color lives only in the small optional icon, never
// in the highlight fill itself.
//
// IMPORTANT: className strings here are STABLE on purpose. Toggling a class
// string on a css-interop-wrapped Pressable (selected ↔ unselected) makes
// react-native-css-interop 0.2.x re-process/upgrade the component on RN 0.86 —
// which remount-loops and hard-freezes the JS thread (the "Borçlu tab locks the
// app" bug). Selection is expressed via the style prop instead, which
// css-interop passes through untouched.
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useColorScheme } from 'nativewind';
import { haptics } from '@/lib/haptics';

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
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === 'dark';

  const selectedBg = dark ? '#374151' : '#ffffff'; // gray-700 / white
  const selectedText = dark ? '#f9fafb' : '#111827'; // gray-50 / gray-900
  const mutedText = dark ? '#9ca3af' : '#4b5563'; // gray-400 / gray-600

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
            className="min-h-11 flex-1 flex-row items-center justify-center gap-2 rounded-md"
            style={
              selected
                ? {
                    backgroundColor: selectedBg,
                    shadowColor: '#000',
                    shadowOpacity: dark ? 0 : 0.08,
                    shadowRadius: 2,
                    shadowOffset: { width: 0, height: 1 },
                    elevation: dark ? 0 : 1,
                  }
                : undefined
            }
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
              className="text-base"
              style={{
                color: selected ? selectedText : mutedText,
                fontWeight: selected ? '700' : '400',
              }}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
