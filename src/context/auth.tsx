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

import { apiGet, apiPost, isApiError, type User } from '@/lib/api';
import { tokenStore } from '@/lib/token-store';

const TOKEN_KEY = 'veresiye.access_token';

interface AuthContextValue {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (username: string, password: string, remember?: boolean) => Promise<void>;
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

  const logout = useCallback(async () => {
    const current = token;
    setUser(null);
    setToken(null);
    await tokenStore.remove(TOKEN_KEY);
    if (current) apiPost('/auth/logout/', {}, current).catch(() => {});
  }, [token]);

  const value = useMemo(
    () => ({ user, token, loading, login, logout }),
    [user, token, loading, login, logout],
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
