'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { translate, type TranslationKey, type TranslateVars } from '@immerse/i18n';
import {
  DEFAULT_UI_LANGUAGE,
  applyUiLanguage,
  getStoredUiLanguage,
} from '@/lib/language';

interface LanguageContextValue {
  uiLanguage: string;
  setUiLanguage: (lang: string) => void;
}

const LanguageContext = createContext<LanguageContextValue>({
  uiLanguage: DEFAULT_UI_LANGUAGE,
  setUiLanguage: () => {},
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  // Starts at the default rather than reading localStorage in the initialiser:
  // that runs on the server too, where it returns English, and the client would
  // then hydrate with a different value and trip a React hydration mismatch.
  // The stored language is picked up in the effect below, one frame later —
  // the same trade colorMode.ts and fontSize.ts already make.
  const [uiLanguage, setUiLanguageState] = useState(DEFAULT_UI_LANGUAGE);

  useEffect(() => {
    const stored = getStoredUiLanguage();
    setUiLanguageState(stored);
    applyUiLanguage(stored);
  }, []);

  const setUiLanguage = useCallback((lang: string) => {
    setUiLanguageState(lang);
    applyUiLanguage(lang);
  }, []);

  const value = useMemo(
    () => ({ uiLanguage, setUiLanguage }),
    [uiLanguage, setUiLanguage],
  );

  return (
    <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}

/**
 * Translation hook, matching the mobile app's API so call sites read the same
 * on both platforms:
 *
 *   const { t } = useTranslation();
 *   t('settings.appLanguage')
 *   t('common.book', { count: n })
 *
 * `t` is memoised on uiLanguage, so it is safe in dependency arrays and only
 * re-renders consumers when the language actually changes.
 */
export function useTranslation() {
  const { uiLanguage } = useContext(LanguageContext);
  const t = useCallback(
    (key: TranslationKey, vars?: TranslateVars) => translate(uiLanguage, key, vars),
    [uiLanguage],
  );
  return { t, uiLanguage };
}
