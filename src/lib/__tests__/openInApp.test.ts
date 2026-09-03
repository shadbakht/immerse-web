/** @jest-environment jsdom */
import { openInApp, _nav } from '../openInApp';

describe('openInApp', () => {
  let goSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    // jsdom (this version) won't let `window.location` be deleted or its `href`
    // redefined — both are non-configurable — so the module exposes a `_nav.go`
    // navigation seam and the test spies on that instead.
    goSpy = jest.spyOn(_nav, 'go').mockImplementation(() => {});
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible', configurable: true, writable: true,
    });
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    goSpy.mockRestore();
  });

  it('navigates to the app URL immediately', () => {
    openInApp('immerse://read/x?pid=1', '/read/uuid?p=1');
    expect(goSpy).toHaveBeenCalledWith('immerse://read/x?pid=1');
  });

  it('falls back to the web URL if still visible after the timeout', () => {
    openInApp('immerse://read/x?pid=1', '/read/uuid?p=1');
    goSpy.mockClear();
    jest.advanceTimersByTime(1300);
    expect(goSpy).toHaveBeenCalledWith('/read/uuid?p=1');
  });

  it('does NOT fall back if the page was hidden (app took over)', () => {
    openInApp('immerse://read/x?pid=1', '/read/uuid?p=1');
    goSpy.mockClear();
    (document as any).visibilityState = 'hidden';
    document.dispatchEvent(new Event('visibilitychange'));
    jest.advanceTimersByTime(1300);
    expect(goSpy).not.toHaveBeenCalled();
  });

  it('does NOT fall back after pagehide', () => {
    openInApp('immerse://read/x?pid=1', '/read/uuid?p=1');
    goSpy.mockClear();
    window.dispatchEvent(new Event('pagehide'));
    jest.advanceTimersByTime(1300);
    expect(goSpy).not.toHaveBeenCalled();
  });
});
