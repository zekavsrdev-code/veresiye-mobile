import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { useAuth } from '@/context/auth';
import { apiGet, unwrapList, type Tenant } from '@/lib/api';

interface TenantContextValue {
  activeTenant: Tenant | null;
  loading: boolean;
}

const TenantContext = createContext<TenantContextValue | null>(null);

// Mirrors the web single-active-tenant rule: the user's first (only) tenant from
// GET /tenants/. Every ?tenant= query param and create-body tenant field reads this.
export function TenantProvider({ children }: { children: ReactNode }) {
  const { user, token } = useAuth();
  const [activeTenant, setActiveTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !token) {
      setActiveTenant(null);
      setLoading(!user ? false : true);
      return;
    }
    let active = true;
    setLoading(true);
    apiGet<Tenant[] | { results: Tenant[] }>('/tenants/', token)
      .then((data) => {
        if (active) setActiveTenant(unwrapList(data)[0] ?? null);
      })
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
  }, [user, token]);

  const value = useMemo(() => ({ activeTenant, loading }), [activeTenant, loading]);
  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenant(): TenantContextValue {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error('useTenant must be used within a TenantProvider');
  return ctx;
}
