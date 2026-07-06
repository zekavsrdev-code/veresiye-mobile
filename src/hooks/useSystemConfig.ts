import { useEffect, useState } from 'react';

import { apiGet, type SystemConfig } from '@/lib/api';

// Unauthenticated deployment gates (mirrors the web useLicense hook). null while
// loading or on error — callers treat null as "gate closed" (fail conservative).
export function useSystemConfig(): SystemConfig | null {
  const [config, setConfig] = useState<SystemConfig | null>(null);

  useEffect(() => {
    let active = true;
    apiGet<SystemConfig>('/system/license/')
      .then((data) => {
        if (active) setConfig(data);
      })
      .catch(() => {
        if (active) setConfig(null);
      });
    return () => {
      active = false;
    };
  }, []);

  return config;
}
