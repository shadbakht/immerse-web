/** @jest-environment jsdom */
import { act, renderHook, waitFor } from '@testing-library/react';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  WHALIE_STORAGE_KEY, getStoredWhalie, initWhalie, saveWhalie, useWhalie, whaliePaletteFor,
} from '../whalie/whalie';

// A minimal supabase double: profiles.select(...).eq(...).single() resolves with
// `selectResult`; profiles.update(patch).eq(...) records the patch and resolves
// with `updateResult`. supabase-js resolves with { error } rather than throwing.
function fakeSupabase(opts: {
  remote?: boolean | null;
  selectError?: boolean;
  updateError?: boolean;
} = {}) {
  const updates: unknown[] = [];
  const from = jest.fn(() => ({
    select: () => ({
      eq: () => ({
        single: () => Promise.resolve(
          opts.selectError
            ? { data: null, error: { message: 'boom' } }
            : { data: { whalie_enabled: opts.remote ?? null }, error: null },
        ),
      }),
    }),
    update: (patch: unknown) => {
      updates.push(patch);
      return {
        eq: () => Promise.resolve(opts.updateError ? { error: { message: 'nope' } } : { error: null }),
      };
    },
  }));
  return { client: { from } as unknown as SupabaseClient, from, updates };
}

beforeEach(() => localStorage.clear());

describe('getStoredWhalie', () => {
  it('null when never chosen on this browser', () => {
    expect(getStoredWhalie()).toBeNull();
  });
  it('reads a stored choice', () => {
    localStorage.setItem(WHALIE_STORAGE_KEY, 'true');
    expect(getStoredWhalie()).toBe(true);
    localStorage.setItem(WHALIE_STORAGE_KEY, 'false');
    expect(getStoredWhalie()).toBe(false);
  });
  it('ignores junk', () => {
    localStorage.setItem(WHALIE_STORAGE_KEY, 'yes');
    expect(getStoredWhalie()).toBeNull();
  });
});

describe('initWhalie — sync rules (same as mobile WhalieContext)', () => {
  it('device true + server NULL → seeds the server with true', async () => {
    localStorage.setItem(WHALIE_STORAGE_KEY, 'true');
    const sb = fakeSupabase({ remote: null });
    await expect(initWhalie(sb.client, 'u1')).resolves.toBe(true);
    expect(sb.updates).toEqual([{ whalie_enabled: true }]);
  });

  it('device unset + server true → enabled, and stored on the device', async () => {
    const sb = fakeSupabase({ remote: true });
    await expect(initWhalie(sb.client, 'u1')).resolves.toBe(true);
    expect(localStorage.getItem(WHALIE_STORAGE_KEY)).toBe('true');
    expect(sb.updates).toEqual([]);
  });

  it('device unset + server NULL → false and NO server write', async () => {
    const sb = fakeSupabase({ remote: null });
    await expect(initWhalie(sb.client, 'u1')).resolves.toBe(false);
    expect(sb.updates).toEqual([]);
    expect(localStorage.getItem(WHALIE_STORAGE_KEY)).toBeNull();
  });

  it('server value wins over the device once the account has a choice', async () => {
    localStorage.setItem(WHALIE_STORAGE_KEY, 'true');
    const sb = fakeSupabase({ remote: false });
    await expect(initWhalie(sb.client, 'u1')).resolves.toBe(false);
    expect(localStorage.getItem(WHALIE_STORAGE_KEY)).toBe('false');
  });

  it('guest → device value only, no network call', async () => {
    localStorage.setItem(WHALIE_STORAGE_KEY, 'true');
    const sb = fakeSupabase({ remote: false });
    await expect(initWhalie(sb.client, null)).resolves.toBe(true);
    expect(sb.from).not.toHaveBeenCalled();
  });

  it('a { error } response leaves the local value intact', async () => {
    localStorage.setItem(WHALIE_STORAGE_KEY, 'true');
    const sb = fakeSupabase({ selectError: true });
    await expect(initWhalie(sb.client, 'u1')).resolves.toBe(true);
    expect(localStorage.getItem(WHALIE_STORAGE_KEY)).toBe('true');
    expect(sb.updates).toEqual([]);
  });
});

describe('saveWhalie', () => {
  it('writes the device and, when signed in, profiles.whalie_enabled', async () => {
    const sb = fakeSupabase();
    await saveWhalie(sb.client, 'u1', true);
    expect(localStorage.getItem(WHALIE_STORAGE_KEY)).toBe('true');
    expect(sb.updates).toEqual([{ whalie_enabled: true }]);
  });
  it('guest → device only', async () => {
    const sb = fakeSupabase();
    await saveWhalie(sb.client, null, true);
    expect(localStorage.getItem(WHALIE_STORAGE_KEY)).toBe('true');
    expect(sb.from).not.toHaveBeenCalled();
  });
  it('an { error } on update keeps the local value', async () => {
    const sb = fakeSupabase({ updateError: true });
    await expect(saveWhalie(sb.client, 'u1', true)).resolves.toBeUndefined();
    expect(localStorage.getItem(WHALIE_STORAGE_KEY)).toBe('true');
  });
});

describe('useWhalie', () => {
  it('device value applies first, account reconciles after', async () => {
    localStorage.setItem(WHALIE_STORAGE_KEY, 'false');
    const sb = fakeSupabase({ remote: true });
    const { result } = renderHook(() => useWhalie(sb.client, 'u1'));
    await waitFor(() => expect(result.current.enabled).toBe(true));
    expect(result.current.ready).toBe(true);
  });

  it('setEnabled(true) writes the device and the account', async () => {
    const sb = fakeSupabase({ remote: null });
    const { result } = renderHook(() => useWhalie(sb.client, 'u1'));
    await waitFor(() => expect(result.current.ready).toBe(true));
    act(() => result.current.setEnabled(true));
    expect(result.current.enabled).toBe(true);
    expect(localStorage.getItem(WHALIE_STORAGE_KEY)).toBe('true');
    await waitFor(() => expect(sb.updates).toContainEqual({ whalie_enabled: true }));
  });

  it('a slow profile fetch does not overwrite a choice made while it was in flight', async () => {
    let resolveSelect: (v: unknown) => void = () => {};
    const updates: unknown[] = [];
    const client = {
      from: () => ({
        select: () => ({ eq: () => ({ single: () => new Promise(r => { resolveSelect = r; }) }) }),
        update: (p: unknown) => { updates.push(p); return { eq: () => Promise.resolve({ error: null }) }; },
      }),
    } as unknown as SupabaseClient;
    const { result } = renderHook(() => useWhalie(client, 'u1'));
    act(() => result.current.setEnabled(true));
    await act(async () => { resolveSelect({ data: { whalie_enabled: false }, error: null }); });
    expect(result.current.enabled).toBe(true);
  });

  // A client whose SELECTs and UPDATEs each wait until the test settles them.
  function deferredSupabase() {
    const selects: Array<(v: unknown) => void> = [];
    const updates: Array<{ patch: unknown; done: (v: unknown) => void }> = [];
    const client = {
      from: () => ({
        select: () => ({ eq: () => ({ single: () => new Promise(r => { selects.push(r); }) }) }),
        update: (patch: unknown) => ({
          eq: () => new Promise(r => { updates.push({ patch, done: r }); }),
        }),
      }),
    } as unknown as SupabaseClient;
    return { client, selects, updates };
  }

  it('a reconcile landing after a toggle in another instance does not flip it back', async () => {
    localStorage.setItem(WHALIE_STORAGE_KEY, 'false');
    const sb = deferredSupabase();
    // Settings is open and has reconciled (account: off).
    const settings = renderHook(() => useWhalie(sb.client, 'u1'));
    await act(async () => { sb.selects[0]({ data: { whalie_enabled: false }, error: null }); });
    // The user turns him on; the account write is still in flight…
    act(() => settings.result.current.setEnabled(true));
    // …when the reader opens and its fetch reads the account's stale "off".
    const reader = renderHook(() => useWhalie(sb.client, 'u1'));
    await act(async () => { sb.selects[1]({ data: { whalie_enabled: false }, error: null }); });
    expect(localStorage.getItem(WHALIE_STORAGE_KEY)).toBe('true');
    expect(reader.result.current.enabled).toBe(true);
    expect(settings.result.current.enabled).toBe(true);
    await act(async () => { sb.updates.forEach(u => u.done({ error: null })); });
    expect(sb.updates.map(u => u.patch)).toEqual([{ whalie_enabled: true }]);
  });

  it('a choice stored by another tab during the fetch is not overwritten by the fetched value', async () => {
    localStorage.setItem(WHALIE_STORAGE_KEY, 'false');
    const sb = deferredSupabase();
    const pending = initWhalie(sb.client, 'u1');
    localStorage.setItem(WHALIE_STORAGE_KEY, 'true'); // another tab chose "on"
    sb.selects[0]({ data: { whalie_enabled: false }, error: null });
    await expect(pending).resolves.toBe(true);
    expect(localStorage.getItem(WHALIE_STORAGE_KEY)).toBe('true');
  });

  it('still adopts the account value when no save overlapped the fetch', async () => {
    localStorage.setItem(WHALIE_STORAGE_KEY, 'false');
    const sb = deferredSupabase();
    const settings = renderHook(() => useWhalie(sb.client, 'u1'));
    act(() => settings.result.current.setEnabled(true));
    await act(async () => { sb.updates[0].done({ error: null }); });
    // A later reconcile, started after that save settled, follows the account
    // (e.g. changed on another device).
    const pending = initWhalie(sb.client, 'u1');
    sb.selects[sb.selects.length - 1]({ data: { whalie_enabled: false }, error: null });
    await expect(pending).resolves.toBe(false);
    expect(localStorage.getItem(WHALIE_STORAGE_KEY)).toBe('false');
  });

  it('a second instance (settings vs reader) follows a change made in the first', async () => {
    const sb = fakeSupabase({ remote: null });
    const a = renderHook(() => useWhalie(sb.client, null));
    const b = renderHook(() => useWhalie(sb.client, null));
    act(() => a.result.current.setEnabled(true));
    await waitFor(() => expect(b.result.current.enabled).toBe(true));
  });
});

describe('whaliePaletteFor (port of mobile utils/readerChrome.ts)', () => {
  it.each([
    ['light', false, 'paper'], ['quiet', false, 'paper'],
    ['sepia', false, 'sepia'],
    ['dark', false, 'night'], ['night', true, 'night'],
    ['system', false, 'paper'], ['system', true, 'night'],
  ] as const)('%s (dark app: %s) → %s', (theme, isDark, expected) => {
    expect(whaliePaletteFor(theme, isDark)).toBe(expected);
  });
});
