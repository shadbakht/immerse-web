/**
 * The reconciliation rules for language preferences carried by the account.
 *
 * Every case here is one where getting it wrong loses a setting the user chose
 * on another device — silently, and only for people who use more than one.
 * That is exactly the class of bug that never shows up in a single-device test
 * pass, so the rules are pinned here rather than left to the reading of two
 * implementations that have to agree. Mobile pins the same rules in
 * src/contexts/__tests__/languageSync.test.tsx (mobile repo) — this is
 * deliberately structured the same way, adapted for two real platform
 * differences:
 *
 *  - Storage is real jsdom localStorage here, not a mocked AsyncStorage.
 *  - There is no "is the library actually installed" gate. Mobile guards
 *    content_language against packs that haven't been downloaded; web has no
 *    download step — every language is always available — so that guard, and
 *    its test, simply don't exist on this platform. Not a gap, a real
 *    difference in what each platform has to guard against.
 *
 * It also covers something mobile has no equivalent of: reconcile() has two
 * separate call sites here — once from the initial getSession() on mount,
 * and again from onAuthStateChange for a session that appears AFTER the page
 * has already rendered (the comment on that effect calls this out as the
 * interesting case). Both are exercised below.
 */

import React from 'react';
import { render, waitFor, act } from '@testing-library/react';

import { LanguageProvider, useLanguage } from '../LanguageProvider';
import { createClient } from '@/lib/supabase/client';
import { fetchLanguagePrefs, pushLanguagePrefs } from '@/lib/languageSync';

jest.mock('@/lib/supabase/client', () => ({ createClient: jest.fn() }));

jest.mock('@/lib/languageSync', () => ({
  fetchLanguagePrefs: jest.fn(),
  pushLanguagePrefs: jest.fn().mockResolvedValue(undefined),
}));

const UI_KEY = 'immerse_ui_language';
const CONTENT_KEY = 'immerse:contentLang';

const USER = 'user-1';

type AuthChangeCb = (event: string, session: { user: { id: string } } | null) => void;

/** A stand-in for the real Supabase client — just enough of `.auth` for
 * LanguageProvider to drive its two reconcile trigger points. */
function fakeSupabase(initialSession: { user: { id: string } } | null) {
  const listeners: AuthChangeCb[] = [];
  return {
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: initialSession } }),
      onAuthStateChange: jest.fn((cb: AuthChangeCb) => {
        listeners.push(cb);
        return { data: { subscription: { unsubscribe: jest.fn() } } };
      }),
    },
    // Test-only helper, not part of the real client's API.
    __fireAuthChange: (session: { user: { id: string } } | null) => {
      listeners.forEach(cb => cb('SIGNED_IN', session));
    },
  };
}

function Probe() {
  const { uiLanguage, contentLanguage } = useLanguage();
  return <div data-testid="langs">{`${uiLanguage}/${contentLanguage}`}</div>;
}

/** Mounts the provider with the given starting session and waits for the
 * initial getSession() pass to resolve — the one thing every mount does,
 * authed or not. */
async function mount(client: ReturnType<typeof fakeSupabase>) {
  (createClient as jest.Mock).mockReturnValue(client);
  const view = render(
    <LanguageProvider>
      <Probe />
    </LanguageProvider>,
  );
  await waitFor(() => expect(client.auth.getSession).toHaveBeenCalled());
  return view;
}

const langsOf = (view: { getByTestId: (id: string) => HTMLElement }) =>
  view.getByTestId('langs').textContent;

beforeEach(() => {
  jest.clearAllMocks();
  window.localStorage.clear();
  (fetchLanguagePrefs as jest.Mock).mockResolvedValue({ ui: null, content: null });
});

describe('adopting what the account holds', () => {
  it('takes both languages from the account when this device has none', async () => {
    (fetchLanguagePrefs as jest.Mock).mockResolvedValue({ ui: 'fr', content: 'es' });

    const view = await mount(fakeSupabase({ user: { id: USER } }));

    await waitFor(() => expect(langsOf(view)).toBe('fr/es'));
    // Written through to the device too, so the next cold start paints in
    // French before the network is consulted at all.
    expect(window.localStorage.getItem(UI_KEY)).toBe('fr');
    expect(window.localStorage.getItem(CONTENT_KEY)).toBe('es');
  });

  it('overrides a stale local choice, because the account is the newer word', async () => {
    window.localStorage.setItem(UI_KEY, 'es');
    (fetchLanguagePrefs as jest.Mock).mockResolvedValue({ ui: 'ru', content: null });

    const view = await mount(fakeSupabase({ user: { id: USER } }));

    await waitFor(() => expect(langsOf(view)).toBe('ru/en'));
  });
});

describe('seeding an account that has never held a preference', () => {
  it('seeds from languages the user actually chose on this device', async () => {
    window.localStorage.setItem(UI_KEY, 'tr');
    window.localStorage.setItem(CONTENT_KEY, 'es');

    await mount(fakeSupabase({ user: { id: USER } }));

    await waitFor(() => expect(pushLanguagePrefs).toHaveBeenCalledWith(
      expect.anything(), USER, { ui_language: 'tr', content_language: 'es' },
    ));
  });

  it('does not seed from the browser locale, which is a guess', async () => {
    // Nothing stored: whatever the app resolved is a default, not a decision,
    // and writing it would pin the account on the user's behalf.
    await mount(fakeSupabase({ user: { id: USER } }));

    await waitFor(() => expect(pushLanguagePrefs).toHaveBeenCalledWith(
      expect.anything(), USER, {},
    ));
  });
});

describe('defaulting to the language the browser is already in', () => {
  const withBrowserLanguages = (...langs: string[]) => {
    Object.defineProperty(window.navigator, 'languages', { value: langs, configurable: true });
  };

  it('opens in the browser language when Immerse speaks it', async () => {
    withBrowserLanguages('fr-CA', 'en-US');   // regional variant, no stored choice

    const view = await mount(fakeSupabase(null));

    await waitFor(() => expect(langsOf(view)).toBe('fr/en'));
  });

  it('falls back to English for a browser language Immerse does not speak', async () => {
    withBrowserLanguages('ja-JP');

    const view = await mount(fakeSupabase(null));

    expect(langsOf(view)).toBe('en/en');
  });

  it('lets a stored choice outrank the browser', async () => {
    withBrowserLanguages('fr-FR');
    window.localStorage.setItem(UI_KEY, 'tr');

    const view = await mount(fakeSupabase(null));

    expect(langsOf(view)).toBe('tr/en');
  });
});

describe('who syncs at all', () => {
  it('leaves a signed-out visitor entirely on the device', async () => {
    await mount(fakeSupabase(null));

    expect(fetchLanguagePrefs).not.toHaveBeenCalled();
    expect(pushLanguagePrefs).not.toHaveBeenCalled();
  });

  it('changes nothing when the account cannot be read', async () => {
    window.localStorage.setItem(UI_KEY, 'fr');
    (fetchLanguagePrefs as jest.Mock).mockResolvedValue(null);   // offline

    const view = await mount(fakeSupabase({ user: { id: USER } }));

    await waitFor(() => expect(fetchLanguagePrefs).toHaveBeenCalled());
    expect(langsOf(view)).toBe('fr/en');
    // Not even an empty write: unreadable is not the same as "never set", and
    // treating it as such would seed the account off a failed request.
    expect(pushLanguagePrefs).not.toHaveBeenCalled();
  });
});

describe('reconciling on a session that appears after the page already rendered', () => {
  it('reconciles once onAuthStateChange reports a genuine sign-in', async () => {
    (fetchLanguagePrefs as jest.Mock).mockResolvedValue({ ui: 'fa', content: null });
    const client = fakeSupabase(null);   // signed out at mount

    const view = await mount(client);
    expect(fetchLanguagePrefs).not.toHaveBeenCalled();

    act(() => { client.__fireAuthChange({ user: { id: USER } }); });

    await waitFor(() => expect(langsOf(view)).toBe('fa/en'));
  });

  it('does not re-reconcile on a token refresh for the same user', async () => {
    const client = fakeSupabase({ user: { id: USER } });
    await mount(client);
    await waitFor(() => expect(fetchLanguagePrefs).toHaveBeenCalledTimes(1));

    // Supabase fires onAuthStateChange on token refresh too, with the same
    // user id — re-running reconcile here would fight a language the user
    // changed seconds ago on this very tab.
    act(() => { client.__fireAuthChange({ user: { id: USER } }); });

    expect(fetchLanguagePrefs).toHaveBeenCalledTimes(1);
  });
});
