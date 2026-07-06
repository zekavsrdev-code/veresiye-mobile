// Biometric adapter — the ONLY place that touches expo-local-authentication.
// Native-module boundary guard (same shape as token-store.ts): the current dev
// client lacks this native module until an EAS rebuild, so every call degrades
// to "unavailable" instead of crashing.
import * as LocalAuthentication from 'expo-local-authentication';

let warned = false;
function warnOnce(err: unknown) {
  if (warned) return;
  warned = true;
  console.warn(
    'expo-local-authentication unavailable — biometric unlock disabled until an EAS dev-client rebuild.',
    err,
  );
}

export async function isBiometricAvailable(): Promise<boolean> {
  try {
    const [hasHardware, isEnrolled] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
    ]);
    return hasHardware && isEnrolled;
  } catch (err) {
    warnOnce(err);
    return false;
  }
}

export async function authenticateAsync(promptMessage: string): Promise<boolean> {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      disableDeviceFallback: true, // PIN keypad is our own fallback, not the OS passcode sheet
      cancelLabel: undefined,
    });
    return result.success;
  } catch (err) {
    warnOnce(err);
    return false;
  }
}
