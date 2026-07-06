import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

interface SkeletonProps {
  className?: string;
}

function usePulseStyle() {
  const opacity = useSharedValue(0.5);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(1, { duration: 700, reduceMotion: ReduceMotion.System }),
      -1,
      true,
    );
  }, [opacity]);

  return useAnimatedStyle(() => ({ opacity: opacity.value }));
}

export function Skeleton({ className }: SkeletonProps) {
  const pulseStyle = usePulseStyle();

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={pulseStyle}
      className={`rounded-md bg-gray-200 dark:bg-gray-700${className ? ` ${className}` : ''}`}
    />
  );
}

// Matches ListRow geometry: avatar circle + two text bars + right bar.
export function SkeletonRow() {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className="min-h-11 flex-row items-center gap-3 px-4 py-3"
    >
      <Skeleton className="h-10 w-10 rounded-full" />
      <View className="flex-1 gap-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-20" />
      </View>
      <Skeleton className="h-6 w-20 rounded-full" />
    </View>
  );
}

// Matches the hero card: small label bar + large amount bar.
export function SkeletonHeader() {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className="gap-3 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
    >
      <Skeleton className="h-3 w-28" />
      <Skeleton className="h-9 w-44" />
    </View>
  );
}

// A labelled-input placeholder (label bar + field box) for form screens that
// load existing data before rendering their fields (e.g. customer edit).
export function SkeletonField() {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className="gap-2"
    >
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-12 w-full rounded-md" />
    </View>
  );
}
