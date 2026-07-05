import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Pressable, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type ToastIntent = 'success' | 'error' | 'info';

interface ToastOptions {
  message: string;
  intent?: ToastIntent;
  actionLabel?: string;
  onAction?: () => void;
}

interface ToastContextValue {
  show: (opts: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const INTENT_CLS: Record<ToastIntent, string> = {
  success: 'bg-emerald-600 dark:bg-emerald-500',
  error: 'bg-rose-600 dark:bg-rose-500',
  info: 'bg-blue-600 dark:bg-blue-500',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastOptions | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();

  const show = useCallback((opts: ToastOptions) => {
    if (timer.current) clearTimeout(timer.current);
    setToast(opts);
    AccessibilityInfo.announceForAccessibility(opts.message);
    timer.current = setTimeout(() => setToast(null), opts.onAction ? 5000 : 4000);
  }, []);

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast ? (
        <Animated.View
          entering={FadeInDown.duration(200)}
          exiting={FadeOutDown.duration(150)}
          className="absolute left-4 right-4"
          style={{ bottom: insets.bottom + 16, pointerEvents: 'box-none' }}
          accessibilityLiveRegion="polite">
          <View
            className={`flex-row items-center justify-between gap-3 rounded-xl px-4 py-3 shadow-lg ${INTENT_CLS[toast.intent ?? 'info']}`}>
            <Text className="flex-1 text-base font-medium text-white">{toast.message}</Text>
            {toast.actionLabel && toast.onAction ? (
              <Pressable
                onPress={() => {
                  toast.onAction?.();
                  setToast(null);
                }}
                className="min-h-11 justify-center px-2"
                accessibilityRole="button"
                accessibilityLabel={toast.actionLabel}>
                <Text className="text-base font-bold text-white">{toast.actionLabel}</Text>
              </Pressable>
            ) : null}
          </View>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}
