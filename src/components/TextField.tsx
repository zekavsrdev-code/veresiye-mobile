// Labeled text input — factors the login inline pattern into a shared field.
// Focus/error borders are tracked via state (RN has no :focus pseudo-class).
import { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type TextInputProps,
} from 'react-native';
import { useColorScheme } from 'nativewind';
import { inputCls, text } from '@/lib/ui-tokens';

export interface TextFieldProps {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  error?: string | null;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  autoFocus?: boolean;
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoCorrect?: boolean;
  // Drives OS autofill (username/password managers) on auth forms.
  textContentType?: TextInputProps['textContentType'];
  testID?: string;
}

export function TextField({
  label,
  value,
  onChangeText,
  error,
  placeholder,
  keyboardType,
  autoFocus,
  secureTextEntry,
  autoCapitalize,
  autoCorrect,
  textContentType,
  testID,
}: TextFieldProps) {
  const [focused, setFocused] = useState(false);
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === 'dark';

  useEffect(() => {
    if (error) AccessibilityInfo.announceForAccessibility(error);
  }, [error]);

  // Focus/error border via STYLE, not className: toggling a class string on a
  // mounted css-interop component freeze-loops on RN 0.86 (the Borçlu-tab bug).
  const borderColor = error
    ? dark ? '#fb7185' : '#f43f5e' // rose-400 / rose-500
    : focused
      ? dark ? '#60a5fa' : '#3b82f6' // blue-400 / blue-500
      : undefined; // class default (gray-200 / gray-700)

  return (
    <View className="gap-1">
      <Text className={`text-xs font-medium ${text.secondary}`}>{label}</Text>
      <TextInput
        className={inputCls}
        style={borderColor ? { borderColor } : undefined}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colorScheme === 'dark' ? '#6b7280' : '#9ca3af'}
        keyboardType={keyboardType}
        autoFocus={autoFocus}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        textContentType={textContentType}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        accessibilityLabel={label}
        testID={testID}
      />
      {error ? (
        <Text className="text-sm text-rose-600 dark:text-rose-400">{error}</Text>
      ) : null}
    </View>
  );
}
