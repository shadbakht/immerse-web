'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { translate, type TranslationKey, type TranslateVars } from '@immerse/i18n';
import {
  DEFAULT_UI_LANGUAGE,
  DEFAULT_CONTENT_LANGUAGE,
  applyUiLanguage,
  getStoredUiLanguage,
  getChosenUiLanguage,
  getChosenContentLanguage,
  storeUiLanguage,
  storeContentLanguage,
} from '@/lib/language';
import { createClient } from '@/lib/supabase/client';
import { fetchLanguagePrefs, pushLanguagePrefs } from '@/lib/languageSync';

interface LanguageContextValue {
  /** The chrome: buttons, menus, headings. */
  uiLanguage: string;
  setUiLanguage: (lang: string) => void;
  /** Which library is being read. Deliberately independent of the chrome. */
  contentLanguage: string;
  setContentLanguage: (lang: string) => void;
}

const LanguageContext = createContext<LanguageContextValue>({
  uiLanguage: DEFAULT_UI_LANGUAGE,
  setUiLanguage: () => {},
  contentLanguage: DEFAULT_CONTENT_LANGUAGE,
  setContentLanguage: () => {},
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  // Both start at the default rather than reading localStorage in the
  // initialiser: that runs on the server too, where it returns English, and the
  // client would then hydrate with a different value and trip a React hydration
  // mismatch. The stored languages are picked up in the effect below, one frame
  // later — the same trade colorMode.ts and fontSize.ts already make.
  const [uiLanguage, setUiLanguageState] = useState(DEFAULT_UI_LANGUAGE);
  const [contentLanguage, setContentLanguageState] = useState(DEFAULT_CONTENT_LANGUAGE);

  // Read inside callbacks that must not re-subscribe when the languages change.
  const latest = useRef({ ui: DEFAULT_UI_LANGUAGE, content: DEFAULT_CONTENT_LANGUAGE });
  latest.current = { ui: uiLanguage, content: contentLanguage };

  const userIdRef = useRef<string | null>(null);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    const storedUi = getStoredUiLanguage();
    setUiLanguageState(storedUi);
    applyUiLanguage(storedUi);
    setContentLanguageState(getChosenContentLanguage() ?? DEFAULT_CONTENT_LANGUAGE);
  }, []);

  /**
   * Reconcile this browser with the account.
   *
   * Runs on load and again on every sign-in, because the interesting case is
   * precisely the one where a session appears after the page has already
   * rendered in whatever this browser had stored.
   */
  const reconcile = useCallback(async (userId: string) => {
    const remote = await fetchLanguagePrefs(supabase, userId);
    if (!remote) return;                       // unreachable or no row — leave local alone

    const seed: { ui_language?: string; content_language?: string } = {};

    if (remote.ui) {
      if (remote.ui !== latest.current.ui) {
        setUiLanguageState(remote.ui);
        applyUiLanguage(remote.ui);
        storeUiLanguage(remote.ui);
      }
    } else {
      // Seed only from a language the user actually picked here. The browser
      // locale is a guess, and writing a guess to the account would pin it on
      // the user's behalf.
      const chosen = getChosenUiLanguage();
      if (chosen) seed.ui_language = chosen;
    }

    if (remote.content) {
      if (remote.content !== latest.current.content) {
        setContentLanguageState(remote.content);
        storeContentLanguage(remote.content);
      }
    } else {
      const chosen = getChosenContentLanguage();
      if (chosen) seed.content_language = chosen;
    }

    await pushLanguagePrefs(supabase, userId, seed);
  }, [supabase]);

  useEffect(() => {
    let cancelled = false;

    supabase.auth.getSession().then(({ data }) => {
      const id = data.session?.user?.id ?? null;
      userIdRef.current = id;
      if (id && !cancelled) reconcile(id);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const id = session?.user?.id ?? null;
      const changed = id !== userIdRef.current;
      userIdRef.current = id;
      // Only on a genuine sign-in. Supabase fires this on token refresh too,
      // and re-running the reconcile there would fight a language the user
      // changed seconds ago on this very tab.
      if (id && changed && !cancelled) reconcile(id);
    });

    return () => { cancelled = true; sub.subscription.unsubscribe(); };
  }, [supabase, reconcile]);

  const setUiLanguage = useCallback((lang: string) => {
    setUiLanguageState(lang);
    applyUiLanguage(lang);
    storeUiLanguage(lang);
    const userId = userIdRef.current;
    if (userId) pushLanguagePrefs(supabase, userId, { ui_language: lang });
  }, [supabase]);

  const setContentLanguage = useCallback((lang: string) => {
    setContentLanguageState(lang);
    storeContentLanguage(lang);
    const userId = userIdRef.current;
    if (userId) pushLanguagePrefs(supabase, userId, { content_language: lang });
  }, [supabase]);

  const value = useMemo(
    () => ({ uiLanguage, setUiLanguage, contentLanguage, setContentLanguage }),
    [uiLanguage, setUiLanguage, contentLanguage, setContentLanguage],
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
