import { render, screen, act } from '@testing-library/react';
import ReadingRing, { resetReadingRingMemory, ringPercent } from '../ReadingRing';
import { ringSegments, ringColorAt, RING_START } from '@/lib/readingRingGeometry';

beforeEach(() => {
  resetReadingRingMemory();
  jest.useFakeTimers();
});
afterEach(() => jest.useRealTimers());

function flushFrames(ms: number) {
  act(() => { jest.advanceTimersByTime(ms); });
}

it('sweeps up to the percentage', () => {
  render(<ReadingRing fraction={0.63} ringKey="a" />);
  flushFrames(1200);
  expect(screen.getByText('63%')).toBeTruthy();
});

it('shows a check, not "100%", for a finished book', () => {
  render(<ReadingRing fraction={1} ringKey="b" />);
  flushFrames(2000);
  expect(screen.queryByText('100%')).toBeNull();
});

it('only calls 100% the true end', () => {
  expect(ringPercent(0.994)).toBe(99);
  expect(ringPercent(0.995)).toBe(100);
});

it('shades the band from the light end to the dark end', () => {
  const segs = ringSegments(0.5);
  expect(segs[0].a0).toBeCloseTo(RING_START);
  expect(ringColorAt(0)).toContain('var(--ring-dark) 0%');
  expect(ringColorAt(1)).toContain('var(--ring-dark) 100%');
});
