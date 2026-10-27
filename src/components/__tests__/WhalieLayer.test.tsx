/** @jest-environment jsdom */
import { act, fireEvent, render } from '@testing-library/react';
import WhalieLayer from '../WhalieLayer';
import { createWhalie } from '@/lib/whalie/whaleEngine';

jest.mock('@/lib/whalie/whaleEngine', () => {
  const actual = jest.requireActual('@/lib/whalie/whaleEngine');
  return { ...actual, createWhalie: jest.fn(actual.createWhalie) };
});
const createSpy = createWhalie as jest.MockedFunction<typeof createWhalie>;

// jsdom has no 2D canvas and no matchMedia.
let reduceMotion = false;
let mqListeners: Array<(e: { matches: boolean }) => void> = [];
beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = (() => null) as never;
});
beforeEach(() => {
  createSpy.mockClear();
  reduceMotion = false;
  mqListeners = [];
  window.matchMedia = ((query: string) => ({
    matches: query.includes('prefers-reduced-motion') ? reduceMotion : false,
    media: query,
    addEventListener: (_: string, fn: (e: { matches: boolean }) => void) => { mqListeners.push(fn); },
    removeEventListener: (_: string, fn: (e: { matches: boolean }) => void) => {
      mqListeners = mqListeners.filter(l => l !== fn);
    },
  })) as never;
});

const hitDiv = (root: HTMLElement) =>
  Array.from(root.querySelectorAll('div')).find(d => d.style.zIndex === '6') as HTMLDivElement;

describe('WhalieLayer', () => {
  it('mounts a canvas when enabled and removes it when disabled', () => {
    const { container, rerender } = render(
      <WhalieLayer enabled palette="paper" floor={0} paused={false} />,
    );
    expect(container.querySelector('canvas')).not.toBeNull();
    rerender(<WhalieLayer enabled={false} palette="paper" floor={0} paused={false} />);
    expect(container.querySelector('canvas')).toBeNull();
  });

  it('renders nothing and creates no engine while disabled', () => {
    const { container } = render(
      <WhalieLayer enabled={false} palette="paper" floor={0} paused={false} />,
    );
    expect(container.querySelector('canvas')).toBeNull();
    expect(createSpy).not.toHaveBeenCalled();
  });

  it('prefers-reduced-motion → engine created with reduceMotion: true', () => {
    reduceMotion = true;
    render(<WhalieLayer enabled palette="night" floor={12} paused={false} />);
    expect(createSpy).toHaveBeenCalledTimes(1);
    expect(createSpy.mock.calls[0][1]).toMatchObject({ reduceMotion: true, palette: 'night', floor: 12 });
  });

  it('follows a live prefers-reduced-motion change', () => {
    render(<WhalieLayer enabled palette="paper" floor={0} paused={false} />);
    const handle = createSpy.mock.results[0].value;
    const spy = jest.spyOn(handle, 'setReduceMotion');
    act(() => mqListeners.forEach(l => l({ matches: true })));
    expect(spy).toHaveBeenCalledWith(true);
  });

  it('passes palette and floor changes to the live engine without re-creating it', () => {
    const { rerender } = render(<WhalieLayer enabled palette="paper" floor={0} paused={false} />);
    const handle = createSpy.mock.results[0].value;
    const setPalette = jest.spyOn(handle, 'setPalette');
    const setFloor = jest.spyOn(handle, 'setFloor');
    rerender(<WhalieLayer enabled palette="sepia" floor={40} paused={false} />);
    expect(setPalette).toHaveBeenCalledWith('sepia');
    expect(setFloor).toHaveBeenCalledWith(40);
    expect(createSpy).toHaveBeenCalledTimes(1);
  });

  it('pauses while the paused prop is set or the tab is hidden', () => {
    const { rerender } = render(<WhalieLayer enabled palette="paper" floor={0} paused={false} />);
    const handle = createSpy.mock.results[0].value;
    const setPaused = jest.spyOn(handle, 'setPaused');
    rerender(<WhalieLayer enabled palette="paper" floor={0} paused />);
    expect(setPaused).toHaveBeenLastCalledWith(true);
    rerender(<WhalieLayer enabled palette="paper" floor={0} paused={false} />);
    expect(setPaused).toHaveBeenLastCalledWith(false);

    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    expect(setPaused).toHaveBeenLastCalledWith(true);
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    expect(setPaused).toHaveBeenLastCalledWith(false);
  });

  it('a click on Whalie does not reach the passage container; a click elsewhere does', () => {
    const onPassageClick = jest.fn();
    const { container } = render(
      <div onClick={onPassageClick}>
        <p data-testid="passage">Text</p>
        <WhalieLayer enabled palette="paper" floor={0} paused={false} />
      </div>,
    );
    fireEvent.click(hitDiv(container));
    expect(onPassageClick).not.toHaveBeenCalled();
    fireEvent.click(container.querySelector('[data-testid="passage"]')!);
    expect(onPassageClick).toHaveBeenCalledTimes(1);
  });

  it('destroys the engine on unmount', () => {
    const { unmount } = render(<WhalieLayer enabled palette="paper" floor={0} paused={false} />);
    const handle = createSpy.mock.results[0].value;
    const destroy = jest.spyOn(handle, 'destroy');
    unmount();
    expect(destroy).toHaveBeenCalled();
  });
});
