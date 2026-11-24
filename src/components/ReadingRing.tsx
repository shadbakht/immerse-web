'use client';

import { useEffect, useState } from 'react';
import { RING_START, ringArc, ringPoint, ringSegments, ringColorAt } from '@/lib/readingRingGeometry';

/**
 * Reading progress ring in the style of Apple Watch's activity rings — the web
 * twin of mobile `src/components/ReadingRing.tsx` (change both). A thick band
 * on a tinted track, light teal at 12 o'clock shading to dark teal at 100% (the
 * shade follows the position on the circle, not the filled length),
 * a solid dark teal head dot like the reader scrubber's thumb, a soft shadow ahead of the head near the
 * end, and a check in place of the percentage at 100%.
 *
 * Sweeps from the value it last showed (remembered per `ringKey` for the page
 * session) to the new one. A book that crosses into 100% while you watch gets
 * a small burst; one already finished just shows the check. Reduced motion
 * skips both. Always clockwise: rings don't mirror in RTL.
 */

const lastShown = new Map<string, number>();

export function resetReadingRingMemory(): void {
  lastShown.clear();
}

const SWEEP_MS = 900;
const CELEBRATE_MS = 700;
const easeOutCubic = (k: number) => 1 - Math.pow(1 - k, 3);

export function ringPercent(fraction: number): number {
  return Math.min(100, Math.max(0, Math.round(fraction * 100)));
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export default function ReadingRing({ fraction, ringKey, size = 44 }: { fraction: number; ringKey: string; size?: number }) {
  const target = Math.min(1, Math.max(0, fraction || 0));
  const [shown, setShown] = useState(() => lastShown.get(ringKey) ?? 0);
  const [celebrate, setCelebrate] = useState<number | null>(null);

  useEffect(() => {
    const known = lastShown.has(ringKey);
    const from = lastShown.get(ringKey) ?? 0;
    lastShown.set(ringKey, target);
    const closes = known && ringPercent(from) < 100 && ringPercent(target) === 100;
    const instant = prefersReducedMotion() || Math.abs(target - from) < 0.0005;
    let frame = 0;
    let t0 = -1;
    const step = (now: number) => {
      if (t0 < 0) t0 = now;
      const elapsed = instant ? Infinity : now - t0;
      if (elapsed < SWEEP_MS) {
        setShown(from + (target - from) * easeOutCubic(elapsed / SWEEP_MS));
      } else if (closes && !instant && elapsed < SWEEP_MS + CELEBRATE_MS) {
        setShown(target);
        setCelebrate((elapsed - SWEEP_MS) / CELEBRATE_MS);
      } else {
        setShown(target);
        setCelebrate(null);
        return;
      }
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(frame);
      setShown(target);
      setCelebrate(null);
    };
  }, [target, ringKey]);

  const stroke = size * 0.13;
  const c = size / 2;
  // The head is a solid dot a little wider than the band, like the reader
  // scrubber's thumb; the radius leaves room for it.
  const knobR = stroke * 0.7;
  const r = size / 2 - knobR;
  const capR = stroke / 2;
  const pct = ringPercent(shown);
  const full = pct === 100;
  const drawn = full ? 1 : shown;
  const end = RING_START + Math.PI * 2 * Math.min(drawn, 0.9999);
  const [sx, sy] = ringPoint(c, r, RING_START);
  const [hx, hy] = ringPoint(c, r, end);
  const [dx, dy] = ringPoint(c, r, end + 0.12);
  const shadow = drawn > 0.8 ? 0.3 * Math.min(1, (drawn - 0.8) / 0.15) : 0;
  const checkScale = celebrate === null ? 1
    : celebrate < 0.4 ? Math.max(0.01, (celebrate / 0.4) * 1.15)
    : 1.15 - 0.15 * Math.min(1, (celebrate - 0.4) / 0.3);
  const pad = size * 0.35;

  return (
    <div
      className="relative shrink-0 [--ring-light:#56B2B2] [--ring-dark:#12525F] [--ring-track:rgba(27,107,123,0.15)] dark:[--ring-light:#8FD6D6] dark:[--ring-dark:#2D9DB3] dark:[--ring-track:rgba(45,157,179,0.22)]"
      style={{ width: size, height: size }}
      data-testid="reading-ring"
    >
      <svg width={size} height={size} className="absolute inset-0" aria-hidden="true">
        <circle cx={c} cy={c} r={r} fill="none" strokeWidth={stroke} style={{ stroke: 'var(--ring-track)' }} />
        <circle cx={sx} cy={sy} r={capR} style={{ fill: ringColorAt(0) }} />
        {ringSegments(drawn).map(({ a0, a1, t }, i) => (
          <path key={i} d={ringArc(c, r, a0, a1)} fill="none" strokeWidth={stroke} style={{ stroke: ringColorAt(t) }} />
        ))}
        {shadow > 0 && <circle cx={dx} cy={dy} r={knobR + size * 0.012} fill={`rgba(0,0,0,${shadow.toFixed(3)})`} />}
        <circle cx={hx} cy={hy} r={knobR} className="fill-[#1B6B7B] dark:fill-[#2D9DB3]" />
        {full && (
          <g transform={`translate(${c} ${c}) scale(${(size / 88) * checkScale}) translate(-44 -44)`}>
            <path d="M31 45 L40 54 L58 35" fill="none" strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" style={{ stroke: ringColorAt(1) }} />
          </g>
        )}
      </svg>
      {celebrate !== null && (
        <svg
          width={size + pad * 2} height={size + pad * 2} aria-hidden="true"
          className="pointer-events-none absolute" style={{ left: -pad, top: -pad }}
        >
          {Array.from({ length: 10 }, (_, i) => {
            const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
            const d = r + stroke * 0.6 + celebrate * pad * 0.8;
            return (
              <circle
                key={i}
                cx={c + pad + d * Math.cos(a)} cy={c + pad + d * Math.sin(a)}
                r={Math.max(0.5, (1 - celebrate) * size * 0.05)}
                fill={i % 2 ? '#56B2B2' : '#D4BC6A'} opacity={1 - celebrate}
              />
            );
          })}
        </svg>
      )}
      {!full && (
        <div className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold text-[#1B6B7B] dark:text-[#2D9DB3]">
          {pct}%
        </div>
      )}
    </div>
  );
}
