import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { useAuth } from '@/context/auth';
import { apiGet, unwrapList, type Tenant } from '@/lib/api';

interface TenantContextValue {
  activeTenant: Tenant | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

const TenantContext = createContext<TenantContextValue | null>(null);

// Mirrors the web single-active-tenant rule: the user's first (only) tenant from
// GET /tenants/. Every ?tenant= query param and create-body tenant field reads this.
export function TenantProvider({ children }: { children: ReactNode }) {
  const { user, token } = useAuth();
  const [activeTenant, setActiveTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user || !token) return;
    const data = await apiGet<Tenant[] | { results: Tenant[] }>('/tenants/', token);
    setActiveTenant(unwrapList(data)[0] ?? null);
  }, [user, token]);

  useEffect(() => {
    if (!user || !token) {
      setActiveTenant(null);
      setLoading(!user ? false : true);
      return;
    }
    let active = true;
    setLoading(true);
    refresh()
      .catch(() => {
        // Guarded screens surface data errors themselves; tenant stays null.
        if (active) setActiveTenant(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user, token, refresh]);

  const value = useMemo(() => ({ activeTenant, loading, refresh }), [activeTenant, loading, refresh]);
  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenant(): TenantContextValue {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error('useTenant must be used within a TenantProvider');
  return ctx;
}
