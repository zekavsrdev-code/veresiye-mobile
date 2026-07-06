// App-wide toast — a TOP banner, deliberately not a bottom snackbar: this app's
// bottom zone is busy (pinned debt/payment action bar on detail, FAB on home,
// bottom sheets), and Material's own guidance is "avoid overlapping navigation;
// pick placement by context". Top also stays visible above the keyboard.
//
// 2025-baseline behaviors: single toast at a time (replace, never stack), soft
// raised surface with a semantic icon + accent (never solid-bright bg — see
// ui-tokens), spring entrance, swipe-up or tap to dismiss, longer auto-dismiss
// for errors, screen-reader announcement.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AccessibilityInfo, Pressable, Text, View } from 'react-native';
import { Directions, Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { SlideInUp, SlideOutUp, runOnJS } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AlertCircle, CheckCircle2, Info } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';

import { borderTok } from '@/lib/ui-tokens';

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

const AUTO_DISMISS_MS: Record<ToastIntent, number> = {
  success: 3500,
  info: 3500,
  error: 6000, // errors need reading time; swipe/tap dismisses sooner
};

const INTENT_META: Record<
  ToastIntent,
  { Icon: typeof Info; accentCls: string; icon: { light: string; dark: string } }
> = {
  success: {
    Icon: CheckCircle2,
    accentCls: 'bg-emerald-500 dark:bg-emerald-400',
    icon: { light: '#059669', dark: '#34d399' },
  },
  error: {
    Icon: AlertCircle,
    accentCls: 'bg-rose-500 dark:bg-rose-400',
    icon: { light: '#e11d48', dark: '#fb7185' },
  },
  info: {
    Icon: Info,
    accentCls: 'bg-blue-500 dark:bg-blue-400',
    icon: { light: '#2563eb', dark: '#60a5fa' },
  },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<(ToastOptions & { id: number }) | null>(null);
  const idSeq = useRef(0);
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();

  const dismiss = useCallback(() => setToast(null), []);

  const show = useCallback((opts: ToastOptions) => {
    idSeq.current += 1; // new id → re-triggers the entrance + the effect below
    setToast({ ...opts, id: idSeq.current });
    AccessibilityInfo.announceForAccessibility(opts.message);
  }, []);

  // Auto-dismiss driven by the active toast (effect owns the timer, so `dismiss`
  // stays a pure setState with no ref access during render). A new toast id
  // re-runs this, clearing the previous timeout.
  useEffect(() => {
    if (!toast) return;
    const ms = AUTO_DISMISS_MS[toast.intent ?? 'info'] + (toast.onAction ? 1500 : 0);
    const id = setTimeout(() => setToast(null), ms);
    return () => clearTimeout(id);
  }, [toast]);

  const value = useMemo(() => ({ show }), [show]);

  // Swipe up = "push it back where it came from". Fling (not Pan): dismissal
  // needs no finger-follow, and a gesture without shared-value writes stays
  // within the repo's reanimated lint rules (see Skeleton.tsx pattern).
  // Memoized so it isn't rebuilt each render (and so `dismiss`'s ref access
  // lives in an event handler, not the render body).
  const flingUp = useMemo(
    () => Gesture.Fling().direction(Directions.UP).onEnd(() => runOnJS(dismiss)()),
    [dismiss],
  );

  const meta = INTENT_META[toast?.intent ?? 'info'];
  const iconColor = colorScheme === 'dark' ? meta.icon.dark : meta.icon.light;

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast ? (
        <Animated.View
          key={toast.id} // re-run entrance when a new toast replaces the old
          entering={SlideInUp.springify().damping(18).stiffness(220)}
          exiting={SlideOutUp.duration(160)}
          className="absolute left-4 right-4"
          style={{ top: insets.top + 8 }}
          accessibilityLiveRegion="polite"
        >
          <GestureDetector gesture={flingUp}>
            <Pressable
              onPress={dismiss}
              accessibilityRole="alert"
              accessibilityHint={toast.actionLabel ?? undefined}
              className={`flex-row items-center gap-3 overflow-hidden rounded-2xl bg-white py-3 pl-3 pr-4 shadow-lg dark:bg-gray-800 ${borderTok}`}
            >
              {/* Semantic accent bar + icon — meaning never rides on color alone. */}
              <View className={`absolute bottom-0 left-0 top-0 w-1 ${meta.accentCls}`} />
              <meta.Icon size={22} color={iconColor} />
              <Text
                className="flex-1 text-base font-medium text-gray-900 dark:text-gray-50"
                numberOfLines={3}
              >
                {toast.message}
              </Text>
              {toast.actionLabel && toast.onAction ? (
                <Pressable
                  onPress={() => {
                    toast.onAction?.();
                    dismiss();
                  }}
                  className="min-h-11 justify-center px-2"
                  accessibilityRole="button"
                  accessibilityLabel={toast.actionLabel}
                >
                  <Text className="text-base font-bold text-blue-600 dark:text-blue-400">
                    {toast.actionLabel}
                  </Text>
                </Pressable>
              ) : null}
            </Pressable>
          </GestureDetector>
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
