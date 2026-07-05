// Labeled text input — factors the login inline pattern into a shared field.
// Focus/error borders are tracked via state (RN has no :focus pseudo-class).
import { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
} from 'react-native';
import { useColorScheme } from 'nativewind';
import { inputCls, inputErrorCls, inputFocusCls, text } from '@/lib/ui-tokens';

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
  testID,
}: TextFieldProps) {
  const [focused, setFocused] = useState(false);
  const { colorScheme } = useColorScheme();

  useEffect(() => {
    if (error) AccessibilityInfo.announceForAccessibility(error);
  }, [error]);

  const stateCls = error ? inputErrorCls : focused ? inputFocusCls : '';

  return (
    <View className="gap-1">
      <Text className={`text-xs font-medium ${text.secondary}`}>{label}</Text>
      <TextInput
        className={`${inputCls} ${stateCls}`}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colorScheme === 'dark' ? '#6b7280' : '#9ca3af'}
        keyboardType={keyboardType}
        autoFocus={autoFocus}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize}
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
