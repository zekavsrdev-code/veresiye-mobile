import { Text, View } from 'react-native';

interface AvatarProps {
  name: string;
}

function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join('')
    .toUpperCase();
}

export function Avatar({ name }: AvatarProps) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className="h-10 w-10 items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700"
    >
      <Text className="font-semibold text-gray-700 dark:text-gray-200">{initialsOf(name)}</Text>
    </View>
  );
}
