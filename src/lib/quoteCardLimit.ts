/**
 * How much text a shared quote card holds. Past this a selection is offered
 * as text instead (owner, 2026-11-23): the card's text would otherwise shrink
 * below a readable size. Counted in characters, not words, because word
 * length varies so much between languages (German compounds). Chinese and
 * Japanese characters are roughly twice as wide, so their limit is lower.
 * Both limits keep the card's text at about 15 pt or more. Same numbers on
 * mobile (src/utils/quoteCardLimit.ts) and web (src/lib/quoteCardLimit.ts) —
 * change both.
 */
export const QUOTE_CARD_MAX_CHARS = 600;
export const QUOTE_CARD_MAX_CHARS_CJK = 260;

export function quoteCardLimit(language: string | null | undefined): number {
  const base = (language ?? '').toLowerCase().split(/[-_]/)[0];
  return base === 'zh' || base === 'ja' ? QUOTE_CARD_MAX_CHARS_CJK : QUOTE_CARD_MAX_CHARS;
}

/** The passage's length as the card counts it: Unicode characters, trimmed. */
export function quoteCardLength(text: string): number {
  return Array.from(text.trim()).length;
}

/** True when the passage fits a quote card. */
export function fitsQuoteCard(text: string, language: string | null | undefined): boolean {
  return quoteCardLength(text) <= quoteCardLimit(language);
}

/** The numbers for the too-long message: the limit, the selection's length, and the excess. */
export function quoteCardOverage(text: string, language: string | null | undefined): { limit: number; count: number; over: number } {
  const limit = quoteCardLimit(language);
  const count = quoteCardLength(text);
  return { limit, count, over: Math.max(0, count - limit) };
}
