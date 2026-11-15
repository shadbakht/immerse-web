// Strict quoted-phrase matching (mirror of mobile src/services/searchQuery.ts `hasExactPhrase`,
// and of the SQL search_phrase_exact / exact_fold — keep all three in step).
//
// A QUOTED search is tolerant of exactly two things: letter case and diacritics. Apostrophes,
// hyphens and every other punctuation mark must match literally, and the words must appear in
// exactly the typed order (user spec, 2026-09-25). "Kitab-i-Aqdas" finds "Kitáb-i-Aqdas" but NOT
// "Kitab i Aqdas"; "Before Abraham was I am" does NOT find "Before Abraham was, I am".
//
// Typographic VARIANTS of one mark are folded (’ ‘ ʻ ʼ → ' ; ‐ ‑ – — → - ; “ ” → ") because the
// corpus is typeset with curly quotes / non-breaking hyphens while a keyboard types the straight
// ones. That is recognising the same character, not tolerance of apostrophes/dashes: presence,
// absence and position of the mark stay strict.

export function exactFold(s: string): string {
  return (s ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[‘’‚‛ʼʻʽʾʿ`´]/g, "'")
    .replace(/[‐‑‒–—―−]/g, '-')
    .replace(/[“”„‟«»]/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

const CJK_RUN = /[\u3400-\u9fff\u3040-\u30ff]/;
const WORD_CHAR = /[\p{L}\p{M}\p{N}]/u;

/**
 * True when `text` contains `phrase` verbatim (modulo case + diacritics), as whole words: the
 * character on each side of the match must not be a letter or digit, so "light" never matches
 * "lights" or "delight". Han/Kana phrases have no spaces and use plain containment.
 */
export function hasExactPhrase(text: string, phrase: string): boolean {
  const np = exactFold(phrase);
  if (!np) return false;
  const nt = exactFold(text);
  if (CJK_RUN.test(np)) return nt.includes(np);
  for (let i = nt.indexOf(np); i !== -1; i = nt.indexOf(np, i + 1)) {
    const before = i === 0 ? '' : nt[i - 1];
    const after = nt[i + np.length] ?? '';
    if ((!before || !WORD_CHAR.test(before)) && (!after || !WORD_CHAR.test(after))) return true;
  }
  return false;
}

function foldChar(c: string): string {
  return c
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[‘’‚‛ʼʻʽʾʿ`´]/g, "'")
    .replace(/[‐‑‒–—―−]/g, '-')
    .replace(/[“”„‟«»]/g, '"');
}

/**
 * Every place `phrase` occurs in `text` under the exact same rules as hasExactPhrase, as
 * [start, end) offsets into the ORIGINAL `text` — so a result row can bold the phrase as one
 * continuous run instead of word by word. Folding changes string length (diacritics drop,
 * whitespace collapses), so the folded text keeps a per-character map back to `text`.
 */
export function findExactPhraseRanges(text: string, phrase: string): { start: number; end: number }[] {
  const np = exactFold(phrase);
  if (!np || !text) return [];
  let folded = '';
  const origStart: number[] = [];
  const origEnd: number[] = [];
  let i = 0;
  for (const c of text) {
    const len = c.length;
    if (/\s/.test(c)) {
      if (folded.length === 0 || folded[folded.length - 1] !== ' ') {
        folded += ' '; origStart.push(i); origEnd.push(i + len);
      } else {
        origEnd[origEnd.length - 1] = i + len;
      }
    } else {
      for (const f of foldChar(c)) {
        folded += f; origStart.push(i); origEnd.push(i + len);
      }
    }
    i += len;
  }
  const cjk = CJK_RUN.test(np);
  const out: { start: number; end: number }[] = [];
  for (let k = folded.indexOf(np); k !== -1; k = folded.indexOf(np, k + 1)) {
    if (!cjk) {
      const before = k === 0 ? '' : folded[k - 1];
      const after = folded[k + np.length] ?? '';
      if ((before && WORD_CHAR.test(before)) || (after && WORD_CHAR.test(after))) continue;
    }
    out.push({ start: origStart[k], end: origEnd[k + np.length - 1] });
  }
  return out;
}
