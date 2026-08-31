// Proximity-cluster anchoring for quoted-phrase / AI-phrase search recall.
//
// A loose (bag-of-words / cross-row) match hit because the phrase's words sit
// close together somewhere in a passage — but centring a snippet, or the search
// highlight, on the earliest single word instead lands on an unrelated part of
// the paragraph with "the" and "he" lit up. These helpers find WHERE the words
// actually cluster. Mirror of the mobile app's src/services/searchQuery.ts
// (proximityTokens / clusterCoverage / PROXIMITY_HL_STOP).
//
// Pure and framework-free: callers pass already-normalised text + tokens.

/** The words a loose phrase match keys on: > 2 chars, lower-cased, first 10. */
export function proximityTokens(phrase: string): string[] {
  return phrase
    .split(/\s+/)
    .map(w => w.replace(/[*":()&|]/g, '').toLowerCase())
    .filter(w => w.length > 2)
    .slice(0, 10);
}

// Articles / conjunctions / pronouns that survive the length > 2 filter but are
// pure noise to highlight (every "the" in a passage lighting up is not a match).
export const PROXIMITY_HL_STOP = new Set([
  'the', 'and', 'but', 'nor', 'for', 'yet', 'that', 'this', 'with', 'from',
  'unto', 'his', 'her', 'its', 'their', 'them', 'they', 'you', 'who', 'not',
]);

/**
 * The tightest window over `normText` covering the most of `tokens` (each already
 * normalised the same way as `normText`). `index` is where to anchor — the start
 * of the earliest covered token in that window — and `coverage` is how many
 * distinct tokens landed inside it. `{ index: -1, coverage: 0 }` when none occur.
 */
export function clusterCoverage(
  normText: string,
  tokens: string[],
  windowChars = 220,
): { index: number; coverage: number } {
  const occ: number[][] = tokens.map(tok => {
    const list: number[] = [];
    if (!tok) return list;
    let i = normText.indexOf(tok);
    while (i !== -1 && list.length < 400) {
      list.push(i);
      i = normText.indexOf(tok, i + tok.length);
    }
    return list;
  });

  let pivot = -1;
  let pivotCount = Infinity;
  for (let k = 0; k < occ.length; k++) {
    if (occ[k].length > 0 && occ[k].length < pivotCount) {
      pivotCount = occ[k].length;
      pivot = k;
    }
  }
  if (pivot === -1) return { index: -1, coverage: 0 };

  let bestIndex = -1;
  let bestCoverage = -1;
  for (const p of occ[pivot]) {
    let coverage = 0;
    let earliest = p;
    for (let k = 0; k < occ.length; k++) {
      let nearest = -1;
      let nd = Infinity;
      for (const q of occ[k]) {
        const d = q > p ? q - p : p - q;
        if (d < nd) { nd = d; nearest = q; }
      }
      if (nearest !== -1 && nd <= windowChars) {
        coverage++;
        if (nearest < earliest) earliest = nearest;
      }
    }
    if (coverage > bestCoverage) {
      bestCoverage = coverage;
      bestIndex = earliest;
    }
  }
  return { index: bestIndex, coverage: bestCoverage };
}
