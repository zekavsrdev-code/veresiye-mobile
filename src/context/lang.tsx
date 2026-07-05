import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import { translate, type Lang, type TranslationKey } from '@/lib/i18n';

interface LangContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: TranslationKey) => string;
}

const LangContext = createContext<LangContextValue | null>(null);

// Mirrors the web `useLang` hook. Default is Turkish (primary audience); a device
// locale probe (expo-localization) can be wired in later without changing consumers.
export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>('tr');
  const t = useCallback((key: TranslationKey) => translate(lang, key), [lang]);
  const value = useMemo(() => ({ lang, setLang, t }), [lang, t]);
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang(): LangContextValue {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error('useLang must be used within a LangProvider');
  return ctx;
}
