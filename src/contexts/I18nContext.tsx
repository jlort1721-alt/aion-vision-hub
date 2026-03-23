import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type Language = 'es' | 'en';

interface I18nContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: string, fallback?: string) => string;
}

const I18nContext = createContext<I18nContextType>({
  lang: 'es',
  setLang: () => {},
  t: (key: string) => key,
});

export const useI18n = () => useContext(I18nContext);

// Dynamic translation loaders — each language is a separate chunk
const translationLoaders: Record<Language, () => Promise<{ default: Record<string, string> }>> = {
  es: () => import('@/i18n/es'),
  en: () => import('@/i18n/en'),
};

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Language>(() => {
    const stored = localStorage.getItem('clave-lang');
    if (stored === 'en' || stored === 'es') return stored;
    return 'es'; // Default Spanish
  });

  const [translations, setTranslations] = useState<Record<string, string>>({});
  const loadedLangRef = useRef<Language | null>(null);

  // Load translations for current language
  useEffect(() => {
    if (loadedLangRef.current === lang) return;
    loadedLangRef.current = lang;
    translationLoaders[lang]().then(mod => {
      setTranslations(mod.default);
    });
  }, [lang]);

  // Load language preference from DB on mount
  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const { data: profile } = await supabase
          .from('profiles')
          .select('tenant_id')
          .eq('user_id', session.user.id)
          .single();
        if (!profile) return;
        const { data: tenant } = await supabase
          .from('tenants')
          .select('settings')
          .eq('id', profile.tenant_id)
          .single();
        const savedLang = (tenant?.settings as any)?.language;
        if (savedLang === 'en' || savedLang === 'es') {
          setLangState(savedLang);
          localStorage.setItem('clave-lang', savedLang);
        }
      } catch { /* ignore */ }
    })();
  }, []);

  const setLang = useCallback(async (newLang: Language) => {
    setLangState(newLang);
    localStorage.setItem('clave-lang', newLang);
    // Persist to DB
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('user_id', session.user.id)
        .single();
      if (!profile) return;
      const { data: tenant } = await supabase
        .from('tenants')
        .select('settings')
        .eq('id', profile.tenant_id)
        .single();
      const currentSettings = (tenant?.settings as Record<string, any>) || {};
      await supabase
        .from('tenants')
        .update({ settings: { ...currentSettings, language: newLang } })
        .eq('id', profile.tenant_id);
    } catch { /* ignore */ }
  }, []);

  const t = useCallback((key: string, fallback?: string): string => {
    return translations[key] || fallback || key;
  }, [translations]);

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}
