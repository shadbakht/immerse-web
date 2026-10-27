'use client';

// Whalie in the web reader (and the Appearance preview). Mounts the shared
// engine — src/lib/whalie/whaleEngine.js, a byte-identical copy of mobile's —
// into a host strip along the bottom of whatever positioned box contains it.
//
// The engine positions its canvas and hit box with `position: fixed`, which is
// right in the mobile WebView (the WebView IS the reader) but on web would pin
// him to the browser viewport. The host's `transform` makes it the containing
// block for fixed descendants, so "fixed" means "fixed to this strip": he spans
// the reader's width, not the window's, and stays put while the passage scrolls.
//
// Clicks: the canvas is pointer-events:none; only the engine's hit box (sized
// to him, while swimming) takes pointer events, and it stops propagation of its
// own click. Every other click lands on the passage exactly as before.
//
// Mouse drag-selection: while a button that went down somewhere else is held,
// his hit box is made pointer-events:none, so a drag that is released over him
// delivers its mouseup to the text underneath — and so to the reader's
// onMouseUp, which raises the selection bar — instead of to his hit box (a
// sibling of the passage, outside its event path). A press that starts ON him
// is left alone, so clicking him still breaches.

import { useEffect, useRef } from 'react';
import { createWhalie, type WhalePalette, type WhalieHandle } from '@/lib/whalie/whaleEngine';

interface Props {
  enabled: boolean;
  palette: WhalePalette;
  /** Height (px) of any bottom bar currently showing; 0 when none. */
  floor: number;
  /** Freeze him (e.g. reader hidden). The tab being hidden pauses him too. */
  paused: boolean;
  className?: string;
}

const REDUCE_MOTION = '(prefers-reduced-motion: reduce)';

export default function WhalieLayer({ enabled, palette, floor, paused, className }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<WhalieHandle | null>(null);
  // Latest props, read when the engine is (re)created.
  // Effects run in order, so this one has updated it before the one below runs.
  const live = useRef({ palette, floor, paused });
  useEffect(() => { live.current = { palette, floor, paused }; });
  const hidden = useRef(false);

  useEffect(() => {
    if (!enabled || !hostRef.current) return;
    const mq = typeof window.matchMedia === 'function' ? window.matchMedia(REDUCE_MOTION) : null;
    const handle = createWhalie(hostRef.current, {
      palette: live.current.palette,
      floor: live.current.floor,
      reduceMotion: !!mq?.matches,
    });
    handleRef.current = handle;

    const syncPaused = () => handle.setPaused(live.current.paused || hidden.current);
    hidden.current = typeof document !== 'undefined' && document.visibilityState === 'hidden';
    syncPaused();

    const onMotion = (e: { matches: boolean }) => handle.setReduceMotion(e.matches);
    mq?.addEventListener?.('change', onMotion);
    const onVisibility = () => {
      hidden.current = document.visibilityState === 'hidden';
      syncPaused();
    };
    document.addEventListener('visibilitychange', onVisibility);

    const host = hostRef.current;
    let dragging = false;
    const setHitPointer = (value: string) => {
      // The engine's children are its canvas (always pointer-events:none) and
      // its hit box; only the hit box takes pointer events.
      Array.prototype.forEach.call(host.children, (el: HTMLElement) => {
        if (el.tagName === 'DIV') el.style.pointerEvents = value;
      });
    };
    const endDrag = () => {
      if (!dragging) return;
      dragging = false;
      setHitPointer('auto');
    };
    // Capture phase, so nothing in the page can stop these first. The mouseup's
    // target was already hit-tested with pointer-events:none, so restoring here
    // does not pull that mouseup back onto him.
    const onMouseDown = (e: MouseEvent) => {
      if (host.contains(e.target as Node)) return;
      dragging = true;
      setHitPointer('none');
    };
    // Released outside the window: the next move with no button held ends it.
    const onMouseMove = (e: MouseEvent) => { if (dragging && e.buttons === 0) endDrag(); };
    document.addEventListener('mousedown', onMouseDown, true);
    document.addEventListener('mouseup', endDrag, true);
    document.addEventListener('mousemove', onMouseMove, true);

    return () => {
      document.removeEventListener('mousedown', onMouseDown, true);
      document.removeEventListener('mouseup', endDrag, true);
      document.removeEventListener('mousemove', onMouseMove, true);
      mq?.removeEventListener?.('change', onMotion);
      document.removeEventListener('visibilitychange', onVisibility);
      handle.destroy();
      handleRef.current = null;
    };
  }, [enabled]);

  useEffect(() => { handleRef.current?.setPalette(palette); }, [palette]);
  useEffect(() => { handleRef.current?.setFloor(floor); }, [floor]);
  useEffect(() => { handleRef.current?.setPaused(paused || hidden.current); }, [paused]);

  if (!enabled) return null;
  return (
    <div
      ref={hostRef}
      aria-hidden="true"
      data-whalie-host=""
      className={className}
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: 128,
        pointerEvents: 'none',
        transform: 'translateZ(0)',
      }}
    />
  );
}
