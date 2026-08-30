'use client';

export interface Tradition { id: string; name: string }
export interface TraditionPair { pairKey: string; pairName: string }

/** Order-independent, duplicate-insensitive set equality for xref id lists. */
export function xrefIdSetEquals(a: string[], b: string[]): boolean {
  const sa = new Set(a);
  const sb = new Set(b);
  if (sa.size !== sb.size) return false;
  for (const id of sa) if (!sb.has(id)) return false;
  return true;
}

/** Normalise a pair of traditions so A↔B and B↔A collapse to one bucket.
 *  Mirrors XRefsScreen / xrefExport exactly (sort by name; key by id in name order). */
export function traditionPairOf(a: Tradition, b: Tradition): TraditionPair {
  const [nameFirst, nameSecond] = [a.name, b.name].sort();
  const [idFirst, idSecond] = a.name <= b.name ? [a.id, b.id] : [b.id, a.id];
  return {
    pairKey: `${idFirst}↔${idSecond}`,
    pairName: nameFirst === nameSecond ? `${nameFirst} ↔ ${nameFirst}` : `${nameFirst} ↔ ${nameSecond}`,
  };
}
