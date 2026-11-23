/**
 * Pure geometry for ReadingRing (a copy of mobile src/components/readingRingGeometry.ts
 * — change both), kept apart so it can be tested without rendering. Angles are radians, measured clockwise from 3 o'clock,
 * so the ring starts at RING_START (12 o'clock).
 */

export const RING_START = -Math.PI / 2;

/** One band segment's colour step is invisible at this size (~3 RGB units). */
const SEGMENTS_PER_TURN = 36;
/** Butt-capped segments overlap by this much so no seam shows between them. */
const SEGMENT_OVERLAP = 0.02;

export function ringPoint(c: number, r: number, a: number): [number, number] {
  return [c + r * Math.cos(a), c + r * Math.sin(a)];
}

/** SVG path for a clockwise arc from a0 to a1 on the circle of radius r about (c, c). */
export function ringArc(c: number, r: number, a0: number, a1: number): string {
  const [x0, y0] = ringPoint(c, r, a0);
  const [x1, y1] = ringPoint(c, r, a1);
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M${x0.toFixed(2)} ${y0.toFixed(2)}A${r.toFixed(2)} ${r.toFixed(2)} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

/**
 * The band split into short arcs so it can shade along its length (SVG has no
 * conic gradient). `t` is each segment's place along the band, 0 at the start
 * and 1 at the head, which picks its colour. Empty at 0%.
 */
export function ringSegments(fraction: number): { a0: number; a1: number; t: number }[] {
  const p = Math.min(Math.max(fraction, 0), 0.9999);
  if (p <= 0) return [];
  const n = Math.max(1, Math.ceil(p * SEGMENTS_PER_TURN));
  const end = RING_START + Math.PI * 2 * p;
  const span = end - RING_START;
  const out: { a0: number; a1: number; t: number }[] = [];
  for (let i = 0; i < n; i++) {
    const a0 = RING_START + (span * i) / n;
    const a1 = Math.min(end, RING_START + (span * (i + 1)) / n + SEGMENT_OVERLAP);
    out.push({ a0, a1, t: n === 1 ? 1 : (i + 0.5) / n });
  }
  return out;
}


/**
 * The band's colour at `t` along it (0 = start, 1 = head), as CSS. Light → dark
 * teal, darkest at the head; the two ends are CSS variables set on the ring so
 * dark mode can move the ramp up (head = the dark theme's #2D9DB3).
 */
export function ringColorAt(t: number): string {
  const k = Math.round(Math.min(1, Math.max(0, t)) * 100);
  return `color-mix(in srgb, var(--ring-dark) ${k}%, var(--ring-light))`;
}
