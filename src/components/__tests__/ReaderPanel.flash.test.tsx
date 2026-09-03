/** @jest-environment jsdom */
// ReaderPanel pulls in the Supabase browser client at module load (via
// annotationSync); stub it so we can import the pure helper.
jest.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }));

import { flashPassageWhenReady } from '../ReaderPanel';

describe('flashPassageWhenReady', () => {
  beforeEach(() => { jest.useFakeTimers(); document.body.innerHTML = ''; });
  afterEach(() => { jest.useRealTimers(); });

  it('adds then removes the passage-flash class', () => {
    const el = document.createElement('p');
    el.id = 'p-abc';
    document.body.appendChild(el);
    flashPassageWhenReady('abc');
    jest.advanceTimersByTime(100);
    expect(el.classList.contains('passage-flash')).toBe(true);
    jest.advanceTimersByTime(2000);
    expect(el.classList.contains('passage-flash')).toBe(false);
  });

  it('gives up quietly if the node never appears', () => {
    expect(() => { flashPassageWhenReady('missing'); jest.advanceTimersByTime(5000); }).not.toThrow();
  });
});
