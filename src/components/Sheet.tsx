// @gorhom/bottom-sheet adapter — screens never import gorhom directly.
// Requires BottomSheetModalProvider in the root layout.
import { forwardRef, useCallback, useRef, type ReactNode, type RefObject } from 'react';
import { Pressable, Text, View } from 'react-native';
import {
  BottomSheetModal,
  BottomSheetBackdrop,
  BottomSheetView,
  BottomSheetTextInput,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { cssInterop, useColorScheme } from 'nativewind';
import { text } from '@/lib/ui-tokens';

// Register gorhom components with NativeWind so className works on them.
cssInterop(BottomSheetView, { className: 'style' });
cssInterop(BottomSheetTextInput, { className: 'style' });
cssInterop(BottomSheetScrollView, {
  className: 'style',
  contentContainerClassName: 'contentContainerStyle',
});

export { BottomSheetView, BottomSheetTextInput, BottomSheetScrollView };

export type SheetRef = RefObject<BottomSheetModal | null>;

export function useSheetRef(): SheetRef {
  return useRef<BottomSheetModal>(null);
}

export function presentSheet(ref: SheetRef): void {
  ref.current?.present();
}

export function dismissSheet(ref: SheetRef): void {
  ref.current?.dismiss();
}

interface SheetProps {
  snapPoints?: (string | number)[];
  onDismiss?: () => void;
  children: ReactNode;
}

export const Sheet = forwardRef<BottomSheetModal, SheetProps>(function Sheet(
  { snapPoints = ['50%'], onDismiss, children },
  ref,
) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        pressBehavior="close"
      />
    ),
    [],
  );

  return (
    <BottomSheetModal
      ref={ref}
      snapPoints={snapPoints}
      enablePanDownToClose
      onDismiss={onDismiss}
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: isDark ? '#1f2937' : '#ffffff' }}
      handleIndicatorStyle={{ backgroundColor: isDark ? '#4b5563' : '#d1d5db' }}
    >
      {children}
    </BottomSheetModal>
  );
});

interface ConfirmSheetProps {
  sheetRef: SheetRef;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
}

export function ConfirmSheet({
  sheetRef,
  title,
  message,
  confirmLabel,
  cancelLabel,
  destructive,
  onConfirm,
}: ConfirmSheetProps) {
  const confirmCls = destructive
    ? 'bg-rose-600 active:bg-rose-700 dark:bg-rose-500 dark:active:bg-rose-600'
    : 'bg-blue-600 active:bg-blue-700 dark:bg-blue-500 dark:active:bg-blue-600';

  return (
    <Sheet ref={sheetRef} snapPoints={['35%']}>
      <BottomSheetView className="px-4 pb-8 gap-4">
        <Text className={`text-lg font-semibold ${text.primary}`}>{title}</Text>
        <Text className={`text-base ${text.secondary}`}>{message}</Text>
        <View className="gap-3">
          <Pressable
            onPress={() => {
              dismissSheet(sheetRef);
              onConfirm();
            }}
            accessibilityRole="button"
            accessibilityLabel={confirmLabel}
            className={`min-h-12 items-center justify-center rounded-lg px-4 ${confirmCls}`}
          >
            <Text className="text-base font-semibold text-white">{confirmLabel}</Text>
          </Pressable>
          <Pressable
            onPress={() => dismissSheet(sheetRef)}
            accessibilityRole="button"
            accessibilityLabel={cancelLabel}
            className="min-h-12 items-center justify-center rounded-lg px-4 bg-gray-100 active:bg-gray-200 dark:bg-gray-700 dark:active:bg-gray-600"
          >
            <Text className="text-base font-semibold text-gray-700 dark:text-gray-200">
              {cancelLabel}
            </Text>
          </Pressable>
        </View>
      </BottomSheetView>
    </Sheet>
  );
}
