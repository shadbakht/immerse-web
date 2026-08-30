// Cross-row phrase stitching for quoted-phrase proximity recall (v2.0 phase 4f).
//
// A web `passages` row is a single paragraph, so a quoted phrase that straddles
// a paragraph break ("…he may be found. Turn ye unto me…") matches no single
// row and is structurally invisible to every other search path. This finds it
// by joining 2–3 CONSECUTIVE rows and testing the phrase against the join —
// but only when NO single row in the window already contains the phrase, so it
// never duplicates the single-row proximity search.
//
// Pure and DB-free: the caller fetches the candidate window and injects its
// own `foldPunctuation`.

export interface RowLike {
  sort_order: number;
  content: string;
}

/**
 * @param rows          candidate rows for ONE book (any order; sorted here)
 * @param foldedPhrase  the phrase, already lower-cased AND punctuation-folded
 * @param fold          the app's foldPunctuation (injected to stay pure)
 * @returns the FIRST row of each 2–3-row consecutive window whose joined,
 *          folded, lower-cased text contains `foldedPhrase`, where the phrase
 *          genuinely straddles the boundary: no single row contains it, and it
 *          is not wholly within the window's tail (a tighter window rooted there
 *          would be the real match). Each distinct start row is returned once.
 */
export function stitchPhraseAcrossRows<T extends RowLike>(
  rows: T[],
  foldedPhrase: string,
  fold: (s: string) => string,
): T[] {
  if (!foldedPhrase) return [];
  const sorted = [...rows].sort((a, b) => a.sort_order - b.sort_order);
  const hits: T[] = [];
  const usedStart = new Set<number>();

  for (let i = 0; i < sorted.length; i++) {
    for (let span = 2; span <= 3; span++) {
      const window = sorted.slice(i, i + span);
      if (window.length < span) break;

      let consecutive = true;
      for (let k = 1; k < window.length; k++) {
        if (window[k].sort_order !== window[k - 1].sort_order + 1) { consecutive = false; break; }
      }
      if (!consecutive) continue;

      const noSingleRowHasIt = window.every(
        r => !fold(r.content).toLowerCase().includes(foldedPhrase),
      );
      if (!noSingleRowHasIt) continue;

      // The phrase must START in window[0]. If it is wholly inside the tail
      // (rows after the first), a tighter window rooted at that later row is
      // the correct match — this window would just misreport window[0].
      if (window.length > 1) {
        const tail = fold(window.slice(1).map(r => r.content).join(' ')).toLowerCase();
        if (tail.includes(foldedPhrase)) continue;
      }

      const joined = fold(window.map(r => r.content).join(' ')).toLowerCase();
      if (joined.includes(foldedPhrase) && !usedStart.has(window[0].sort_order)) {
        usedStart.add(window[0].sort_order);
        hits.push(window[0]);
        break; // don't also match the 3-span for this same start
      }
    }
  }
  return hits;
}
