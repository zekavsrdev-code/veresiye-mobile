// @gorhom/bottom-sheet adapter — screens never import gorhom directly.
// Requires BottomSheetModalProvider in the root layout.
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { Pressable, Text, View } from 'react-native';
import {
  BottomSheetModal,
  BottomSheetBackdrop,
  BottomSheetView as GorhomSheetView,
  BottomSheetTextInput,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { useColorScheme } from 'nativewind';
import { text } from '@/lib/ui-tokens';

// Do NOT cssInterop-register gorhom components: their portal-mount lifecycle makes
// css-interop's "component upgraded" dev warning fire, and that warning's prop
// stringifier crashes on react-navigation context getters ("Couldn't find a
// navigation context" render error). Instead, className lives on a plain inner
// View — call sites keep using <BottomSheetView className=...> unchanged.
export function BottomSheetView({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <GorhomSheetView>
      <View className={className}>{children}</View>
    </GorhomSheetView>
  );
}

export { BottomSheetTextInput, BottomSheetScrollView };

export interface SheetHandle {
  present: () => void;
  dismiss: () => void;
}

export type SheetRef = RefObject<SheetHandle | null>;

export function useSheetRef(): SheetRef {
  return useRef<SheetHandle>(null);
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

// LAZY-MOUNT on purpose: an always-mounted (but closed) BottomSheetModal host was
// swallowing ALL touches on the screen beneath it on RN 0.86/Fabric — rows, FAB,
// header buttons, everything. The modal now exists ONLY while open: present()
// mounts it then opens; dismissal unmounts it again, so a closed sheet can never
// intercept a touch.
export const Sheet = forwardRef<SheetHandle, SheetProps>(function Sheet(
  { snapPoints = ['50%'], onDismiss, children },
  ref,
) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const modalRef = useRef<BottomSheetModal>(null);
  const [mounted, setMounted] = useState(false);
  const pendingPresent = useRef(false);

  useImperativeHandle(ref, () => ({
    present: () => {
      if (mounted) {
        modalRef.current?.present();
      } else {
        pendingPresent.current = true;
        setMounted(true);
      }
    },
    dismiss: () => modalRef.current?.dismiss(),
  }), [mounted]);

  useEffect(() => {
    if (mounted && pendingPresent.current) {
      pendingPresent.current = false;
      // Next frame: the freshly-mounted BottomSheetModal must attach to the
      // provider host before present(), or the call is silently dropped.
      requestAnimationFrame(() => modalRef.current?.present());
    }
  }, [mounted]);

  const handleDismiss = useCallback(() => {
    setMounted(false);
    onDismiss?.();
  }, [onDismiss]);

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

  if (!mounted) return null;

  return (
    <BottomSheetModal
      ref={modalRef}
      snapPoints={snapPoints}
      enablePanDownToClose
      onDismiss={handleDismiss}
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
