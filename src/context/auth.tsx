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

import {
  apiGet,
  apiPost,
  isApiError,
  setSessionTokens,
  setTokensRefreshedHandler,
  setUnauthorizedHandler,
  type User,
} from '@/lib/api';
import { initOutbox, setOutboxToken } from '@/lib/outbox';
import { registerPushToken, unregisterPushToken } from '@/lib/push';
import { tokenStore } from '@/lib/token-store';

const TOKEN_KEY = 'veresiye.access_token';
const REFRESH_KEY = 'veresiye.refresh_token';

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

interface LoginResp {
  access: string;
  refresh?: string;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Mirrors frontend/src/context/AuthContext.tsx, adapted for mobile. The web build
// rotates a short-lived access token against an httpOnly refresh COOKIE; RN has no
// cookie jar, so the backend returns the refresh token in the BODY for mobile
// (X-Client-Platform header) and we persist BOTH tokens in the OS keychain. The
// api.ts request core silently rotates the refresh token on a 401 and retries, so
// the 15-minute access token renews itself without forcing re-login for 7 days.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Persist a token pair to the keychain + push it into the api.ts session store
  // (which the request core reads for the Bearer header and refresh rotation).
  const applyTokens = useCallback(async (access: string, refresh: string | null) => {
    setToken(access);
    setSessionTokens(access, refresh);
    await tokenStore.set(TOKEN_KEY, access);
    if (refresh) await tokenStore.set(REFRESH_KEY, refresh);
  }, []);

  const clearTokens = useCallback(async () => {
    setToken(null);
    setSessionTokens(null, null);
    await tokenStore.remove(TOKEN_KEY);
    await tokenStore.remove(REFRESH_KEY);
  }, []);

  // Offline outbox: restore the queue once, then keep it fed with the live token.
  useEffect(() => {
    void initOutbox();
  }, []);
  useEffect(() => {
    setOutboxToken(token);
  }, [token]);

  // Push device registration: after login/register and on restore. Idempotent.
  useEffect(() => {
    if (token) void registerPushToken(token);
  }, [token]);

  // A silent refresh (in api.ts) produced a new pair → mirror it into state +
  // keychain so a restart and the outbox use the rotated tokens.
  useEffect(() => {
    setTokensRefreshedHandler(({ access, refresh }) => {
      setToken(access);
      tokenStore.set(TOKEN_KEY, access).catch(() => {});
      tokenStore.set(REFRESH_KEY, refresh).catch(() => {});
    });
    return () => setTokensRefreshedHandler(null);
  }, []);

  // Refresh exhausted (blacklisted/expired) → drop the dead session, go to /login.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
      void clearTokens();
      router.replace('/login');
    });
    return () => setUnauthorizedHandler(null);
  }, [router, clearTokens]);

  // Launch restore: seed the session store from the keychain, then validate. A
  // 401 here means the SHORT access token expired — the request core's silent
  // refresh transparently rotates it, so a valid refresh keeps the user in.
  useEffect(() => {
    let active = true;
    (async () => {
      const [storedAccess, storedRefresh] = await Promise.all([
        tokenStore.get(TOKEN_KEY),
        tokenStore.get(REFRESH_KEY),
      ]);
      if (!storedAccess) {
        if (active) setLoading(false);
        return;
      }
      setSessionTokens(storedAccess, storedRefresh);
      try {
        const me = await apiGet<User>('/auth/me/'); // request core refreshes on 401
        if (active) {
          setToken(storedAccess);
          setUser(me);
        }
      } catch (err) {
        if (isApiError(err) && err.status === 401) {
          await clearTokens(); // refresh also dead — stay logged out
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [clearTokens]);

  const login = useCallback(
    async (username: string, password: string, remember = true) => {
      const data = await apiPost<LoginResp>('/auth/login/', { username, password, remember });
      await applyTokens(data.access, data.refresh ?? null);
      const me = await apiGet<User>('/auth/me/', data.access);
      setUser(me);
    },
    [applyTokens],
  );

  const register = useCallback(
    async (input: RegisterInput) => {
      const data = await apiPost<LoginResp & { user: User }>('/auth/register/', input);
      await applyTokens(data.access, data.refresh ?? null);
      setUser(data.user);
    },
    [applyTokens],
  );

  const logout = useCallback(async () => {
    const currentAccess = token;
    const currentRefresh = await tokenStore.get(REFRESH_KEY);
    // Deregister the push token BEFORE clearing — the DELETE needs a live Bearer.
    if (currentAccess) await unregisterPushToken(currentAccess).catch(() => {});
    setUser(null);
    await clearTokens();
    // Blacklist the refresh token server-side (best-effort, fire-and-forget).
    if (currentRefresh) apiPost('/auth/logout/', { refresh: currentRefresh }).catch(() => {});
  }, [token, clearTokens]);

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
