import { countReadingUnits, describeTimeLeft, formatMinutes, paceFor } from '../timeLeft';
import { layoutQuoteCard, wrapLines, CARD_SCALE } from '../quoteCardLayout';
import { badiBackgroundImageIndex, quoteCardBackgroundUrl } from '../quoteCardBackground';
import { markBookFinished } from '../finishedBooks';

const t = ((key: string, p?: Record<string, unknown>) => (p ? `${key}:${JSON.stringify(p)}` : key)) as never;

describe('timeLeft', () => {
  it('counts words, or characters for Chinese, ignoring tags and footnote markers', () => {
    expect(countReadingUnits('<b>In the</b> beginning[1] was', 'en')).toBe(4);
    expect(countReadingUnits('太初 有道', 'zh')).toBe(4);
    expect(countReadingUnits('   ', 'en')).toBe(0);
  });
  it('uses the same paces as mobile', () => {
    expect(paceFor('en')).toBe(228);
    expect(paceFor('fa-IR')).toBe(138);
    expect(paceFor('xx')).toBe(228);
  });
  it('words minutes and hours', () => {
    expect(formatMinutes(t, 12)).toBe('reader.durationMinutes:{"minutes":12}');
    expect(formatMinutes(t, 90)).toBe('reader.durationHoursMinutes:{"hours":1,"minutes":30}');
    expect(describeTimeLeft(t, 50, 'en')).toBe('reader.underMinuteLeftInChapter');
    expect(describeTimeLeft(t, 2280, 'en')).toContain('reader.timeLeftInChapter');
  });
});

describe('quoteCardLayout', () => {
  const measure = (s: string, px: number) => s.length * px * 0.5;
  it('breaks lines within the width', () => {
    const lines = wrapLines('one two three four five', (s) => s.length <= 9);
    expect(lines).toEqual(['one two', 'three', 'four five']);
  });
  it('starts large for a short quote', () => {
    const l = layoutQuoteCard('“Short.”', '— Book', 800, 1000, 'en', measure);
    expect(l.quotePx).toBe(24 * CARD_SCALE);
  });
  it('shrinks a long quote, and ends on an ellipsis only past the floor size', () => {
    const long = '“' + 'word '.repeat(2000).trim() + '”';
    const l = layoutQuoteCard(long, '— Book', 800, 1000, 'en', measure);
    expect(l.quotePx).toBe(13 * CARD_SCALE);
    expect(l.height).toBeLessThanOrEqual(1000);
    expect(l.quoteLines[l.quoteLines.length - 1].endsWith('…”')).toBe(true);
  });
});

describe('quoteCardBackground', () => {
  it('follows the Badí’ month like mobile', () => {
    expect(badiBackgroundImageIndex(new Date(2026, 2, 21))).toBe(1);   // Naw-Rúz
    expect(badiBackgroundImageIndex(new Date(2026, 10, 23))).toBe(14); // Qawl
    expect(badiBackgroundImageIndex(new Date(2027, 1, 27))).toBe(20);  // Ayyám-i-Há
    expect(badiBackgroundImageIndex(new Date(2027, 2, 5))).toBe(19);   // ‘Alá’
    expect(quoteCardBackgroundUrl(new Date(2026, 2, 21))).toBe('/daily-backgrounds/bg-01-baha.jpeg');
  });
});

describe('finishedBooks', () => {
  beforeEach(() => localStorage.clear());
  it('is true only the first time a book is finished', () => {
    expect(markBookFinished('a')).toBe(true);
    expect(markBookFinished('a')).toBe(false);
    expect(markBookFinished('b')).toBe(true);
  });
});
