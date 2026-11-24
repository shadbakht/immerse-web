/**
 * Line-breaking and font fitting for the web quote card (QuoteCardDialog).
 * Mirrors mobile DailyReadingCardScreen's composition: the quote starts at
 * 24 pt and shrinks one step at a time to a 13 pt floor until it and its
 * citation (0.58× the quote size, 0.9× gap) fit the parchment. Sizes are in
 * card points scaled to the 1080-px export (a ~400 pt wide card).
 */

export const CARD_W = 1080;
export const CARD_H = 1350; // 4:5, like mobile's export
export const CARD_SCALE = CARD_W / 400;

const START_SIZE = 24;
const MIN_SIZE = 13;
const QUOTE_LINE = 1.4;
const CITATION_RATIO = 0.58;
const CITATION_GAP = 0.9;
const CITATION_LINE = 1.3;

export type Measure = (text: string, px: number, italic: boolean) => number;

export interface QuoteCardLayout {
  quotePx: number;
  quoteLineH: number;
  quoteLines: string[];
  citationPx: number;
  citationLineH: number;
  citationGap: number;
  citationLines: string[];
  height: number;
}

/** Greedy line breaking; Chinese and Japanese break between any characters. */
export function wrapLines(text: string, fits: (s: string) => boolean, language?: string | null): string[] {
  const base = (language ?? '').toLowerCase().split(/[-_]/)[0];
  const cjk = base === 'zh' || base === 'ja';
  const tokens = cjk ? Array.from(text) : text.split(/\s+/).filter(Boolean);
  const join = cjk ? '' : ' ';
  const lines: string[] = [];
  let cur = '';
  for (const tok of tokens) {
    const next = cur ? cur + join + tok : tok;
    if (!cur || fits(next)) { cur = next; continue; }
    lines.push(cur);
    cur = tok;
  }
  if (cur) lines.push(cur);
  return lines;
}

export function layoutQuoteCard(
  quote: string,
  citation: string,
  boxW: number,
  boxH: number,
  language: string | null | undefined,
  measure: Measure,
): QuoteCardLayout {
  const S = CARD_SCALE;
  let last: QuoteCardLayout | null = null;
  for (let size = START_SIZE; size >= MIN_SIZE; size--) {
    const quotePx = size * S;
    const citationPx = Math.round(size * CITATION_RATIO) * S;
    const quoteLines = wrapLines(quote, (s) => measure(s, quotePx, false) <= boxW, language);
    const citationLines = citation
      ? wrapLines(citation, (s) => measure(s, citationPx, true) <= boxW, language)
      : [];
    const quoteLineH = quotePx * QUOTE_LINE;
    const citationLineH = citationPx * CITATION_LINE;
    const citationGap = citationLines.length ? size * CITATION_GAP * S : 0;
    const height = quoteLines.length * quoteLineH + citationGap + citationLines.length * citationLineH;
    last = { quotePx, quoteLineH, quoteLines, citationPx, citationLineH, citationGap, citationLines, height };
    if (height <= boxH) return last;
  }
  // Even the floor size overflows: keep what fits and end on an ellipsis.
  const l = last!;
  const room = boxH - l.citationGap - l.citationLines.length * l.citationLineH;
  const keep = Math.max(1, Math.floor(room / l.quoteLineH));
  if (keep < l.quoteLines.length) {
    const lines = l.quoteLines.slice(0, keep);
    lines[keep - 1] = `${lines[keep - 1].replace(/[\s,;:.”"]+$/, '')}…”`;
    return { ...l, quoteLines: lines, height: keep * l.quoteLineH + l.citationGap + l.citationLines.length * l.citationLineH };
  }
  return l;
}
