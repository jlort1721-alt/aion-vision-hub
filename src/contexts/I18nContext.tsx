import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';

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

  const setLang = useCallback((newLang: Language) => {
    setLangState(newLang);
    localStorage.setItem('clave-lang', newLang);
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
