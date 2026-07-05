// Runtime API base URL. Mirrors frontend/src/lib/runtime-env.ts, adapted for RN:
// there is no SSR window injection — the value comes from an Expo public env var
// (EXPO_PUBLIC_API_URL, inlined at build time) with a localhost default.
//
// NOTE: a physical device cannot reach `localhost` — that resolves to the phone
// itself. On a real device set EXPO_PUBLIC_API_URL to your machine's LAN IP
// (e.g. http://192.168.1.20:8000/api). The default below only works on the
// iOS simulator / Android emulator loopback.
const DEFAULT_BACKEND_URL = 'http://localhost:8000/api';

export interface RuntimeEnv {
  BACKEND_URL: string;
}

export function getRuntimeEnv(): RuntimeEnv {
  return {
    BACKEND_URL: process.env.EXPO_PUBLIC_API_URL || DEFAULT_BACKEND_URL,
  };
}
