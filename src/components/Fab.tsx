// Floating action button — bottom-third thumb zone, primary blue, light haptic
// on press (visual result comes from whatever the press opens).
import type { ReactNode } from 'react';
import { Pressable } from 'react-native';
import { Plus } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { elevation2 } from '@/lib/ui-tokens';
import { haptics } from '@/lib/haptics';

export interface FabProps {
  onPress: () => void;
  accessibilityLabel: string;
  icon?: ReactNode;
}

export function Fab({ onPress, accessibilityLabel, icon }: FabProps) {
  // Android runs edge-to-edge (SDK 57 default): a fixed bottom offset puts the
  // FAB UNDER the system navigation bar — visible, but the nav bar swallows the
  // taps. Offset by the bottom inset so the touch target sits above it.
  const insets = useSafeAreaInsets();

  return (
    <Pressable
      onPress={() => {
        haptics.light();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={{ bottom: insets.bottom + 24 }}
      className={`absolute right-4 h-14 w-14 items-center justify-center rounded-full bg-blue-600 active:bg-blue-700 dark:bg-blue-500 dark:active:bg-blue-600 ${elevation2}`}
    >
      {icon ?? <Plus size={24} color="#ffffff" />}
    </Pressable>
  );
}
