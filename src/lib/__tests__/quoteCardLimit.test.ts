import { fitsQuoteCard, quoteCardLimit, quoteCardOverage, QUOTE_CARD_MAX_CHARS, QUOTE_CARD_MAX_CHARS_CJK } from "../quoteCardLimit";

describe("quoteCardLimit", () => {
  it("counts characters, not words, with a lower limit for Chinese and Japanese", () => {
    expect(quoteCardLimit("en")).toBe(QUOTE_CARD_MAX_CHARS);
    expect(quoteCardLimit("de")).toBe(QUOTE_CARD_MAX_CHARS);
    expect(quoteCardLimit("zh-Hans")).toBe(QUOTE_CARD_MAX_CHARS_CJK);
    expect(quoteCardLimit(undefined)).toBe(QUOTE_CARD_MAX_CHARS);
  });
  it("fits up to the limit and not past it", () => {
    expect(fitsQuoteCard("a".repeat(QUOTE_CARD_MAX_CHARS), "en")).toBe(true);
    expect(fitsQuoteCard("a".repeat(QUOTE_CARD_MAX_CHARS + 1), "en")).toBe(false);
    // A few long German compounds still count by their letters.
    expect(fitsQuoteCard("Gottesoffenbarungsbotschaft ".repeat(25), "de")).toBe(false);
    expect(fitsQuoteCard("道".repeat(QUOTE_CARD_MAX_CHARS_CJK + 1), "zh")).toBe(false);
  });
  it("ignores surrounding whitespace and counts emoji-free text by code point", () => {
    expect(fitsQuoteCard("  " + "a".repeat(QUOTE_CARD_MAX_CHARS) + "\n", "en")).toBe(true);
  });
  it("reports the limit, the selection's length and how far over it is", () => {
    expect(quoteCardOverage("a".repeat(842), "en")).toEqual({ limit: 600, count: 842, over: 242 });
    expect(quoteCardOverage("a".repeat(100), "en").over).toBe(0);
  });
});
