/** @jest-environment jsdom */
// AppShell pulls in the Supabase browser client transitively (LibraryPanel →
// annotationSync); stub it so we can import the pure helper.
jest.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }));

import { shouldStartLibraryCollapsed } from '../AppShell';

describe('shouldStartLibraryCollapsed', () => {
  it('collapses when landing on a book on a narrow viewport', () => {
    expect(shouldStartLibraryCollapsed('some-book', true)).toBe(true);
  });
  it('does not collapse on a wide viewport', () => {
    expect(shouldStartLibraryCollapsed('some-book', false)).toBe(false);
  });
  it('does not collapse when not landing on a book', () => {
    expect(shouldStartLibraryCollapsed(undefined, true)).toBe(false);
  });
});
