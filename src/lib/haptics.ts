// Haptics adapter — screens never import expo-haptics directly, so a future
// "reduce haptics" setting is a one-line change here. Every call site must pair
// the haptic with a visual cue (toast/state); haptics are never sole feedback.
import * as Haptics from 'expo-haptics';

const silent = () => {}; // fire-and-forget; failures on non-haptic devices are fine

export const haptics = {
  selection: () => Haptics.selectionAsync().catch(silent),                                    // segment/picker change
  light: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(silent),          // keypad digit
  success: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(silent),
  warning: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(silent),
  error: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(silent),
};
