import { useEffect, useState } from 'react';

import { useAuth } from '@/context/auth';
import { useTenant } from '@/context/tenant';
import { apiGet, type MyPermissions } from '@/lib/api';

// Backend-driven RBAC gate (no hardcoded codename mirror): fetches the caller's
// effective permissions in the active tenant. Owner passes every check. While
// loading, hasPerm returns true (flicker prevention — the server re-enforces).
export function usePermissions() {
  const { token } = useAuth();
  const { activeTenant } = useTenant();
  const [perms, setPerms] = useState<MyPermissions | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token || !activeTenant) return;
    let active = true;
    apiGet<MyPermissions>(`/tenants/${activeTenant.id}/my-permissions/`, token)
      .then((data) => {
        if (active) setPerms(data);
      })
      .catch(() => {
        // Fail closed once loading settles: no data → only owner-independent UI.
        if (active) setPerms({ is_owner: false, can_grant: false, codenames: [] });
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token, activeTenant]);

  const hasPerm = (codename: string): boolean => {
    if (loading || !perms) return true; // flicker prevention; server enforces anyway
    return perms.is_owner || perms.codenames.includes(codename);
  };

  return { hasPerm, loading, isOwner: perms?.is_owner ?? false };
}
