import { useRouter } from 'expo-router';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { apiGet, apiPost, isApiError, setUnauthorizedHandler, type User } from '@/lib/api';
import { initOutbox, setOutboxToken } from '@/lib/outbox';
import { registerPushToken, unregisterPushToken } from '@/lib/push';
import { tokenStore } from '@/lib/token-store';

const TOKEN_KEY = 'veresiye.access_token';

export interface RegisterInput {
  username: string;
  email: string;
  password: string;
  first_name?: string;
  last_name?: string;
}

interface AuthContextValue {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (username: string, password: string, remember?: boolean) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Mirrors frontend/src/context/AuthContext.tsx, adapted for mobile: the web build
// rotates a short-lived access token against an httpOnly refresh COOKIE. Cookies
// aren't a portable RN primitive, so mobile persists the access token itself in
// the OS keychain (expo-secure-store) and re-validates it against /auth/me/ on
// launch. A mobile refresh strategy (token-in-body rotation) is a later concern.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Offline outbox: restore the queue once, then keep it fed with the live
  // token so queued entries flush as soon as we're signed in + online.
  useEffect(() => {
    void initOutbox();
  }, []);
  useEffect(() => {
    setOutboxToken(token);
  }, [token]);

  // Push device registration: fires after successful login/register (token just
  // set) AND on app start once the stored token restores — idempotent server-side.
  useEffect(() => {
    if (token) void registerPushToken(token);
  }, [token]);

  // Global 401 → drop the dead session and land on /login, wherever the user
  // was. Registered once; api.ts skips /auth/* so login failures stay inline.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
      setToken(null);
      tokenStore.remove(TOKEN_KEY).catch(() => {});
      router.replace('/login');
    });
    return () => setUnauthorizedHandler(null);
  }, [router]);

  useEffect(() => {
    let active = true;
    (async () => {
      const stored = await tokenStore.get(TOKEN_KEY);
      if (!stored) {
        if (active) setLoading(false);
        return;
      }
      try {
        const me = await apiGet<User>('/auth/me/', stored);
        if (active) {
          setToken(stored);
          setUser(me);
        }
      } catch (err) {
        // Stored token is stale/invalid — drop it and stay logged out.
        if (isApiError(err) && err.status === 401) {
          await tokenStore.remove(TOKEN_KEY);
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (username: string, password: string, remember = true) => {
    const data = await apiPost<{ access: string; remember: boolean }>('/auth/login/', {
      username,
      password,
      remember,
    });
    await tokenStore.set(TOKEN_KEY, data.access);
    const me = await apiGet<User>('/auth/me/', data.access);
    setToken(data.access);
    setUser(me);
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    const data = await apiPost<{ user: User; access: string }>('/auth/register/', input);
    await tokenStore.set(TOKEN_KEY, data.access);
    setToken(data.access);
    setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    const current = token;
    // Deregister the push token BEFORE clearing the session — the DELETE call
    // needs the still-valid Bearer token.
    if (current) await unregisterPushToken(current).catch(() => {});
    setUser(null);
    setToken(null);
    await tokenStore.remove(TOKEN_KEY);
    if (current) apiPost('/auth/logout/', {}, current).catch(() => {});
  }, [token]);

  const value = useMemo(
    () => ({ user, token, loading, login, register, logout }),
    [user, token, loading, login, register, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}

// Protected-screen guard — mirrors the web `useRequireAuth`. Redirects to /login
// once loading settles with no user. Consumers render null while loading/redirecting:
//   const { user, token, loading } = useRequireAuth()
//   if (loading || !user) return null
export function useRequireAuth(): AuthContextValue {
  const auth = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!auth.loading && !auth.user) {
      router.replace('/login');
    }
  }, [auth.loading, auth.user, router]);
  return auth;
}
