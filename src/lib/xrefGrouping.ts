/**
 * xrefGrouping.ts — group a flat list of cross-references into tradition-pair
 * buckets and order them the way the XRefs screen does. Generic over the row
 * type so the screen and the export builder share one implementation.
 *
 *   • Pairs: most cross-references first; pair name A→Z as tiebreak.
 *   • Within a pair: labelled xrefs A→Z first, then unlabelled newest-created first.
 */
export interface XrefAccessors<T> {
  getLabel:     (row: T) => string | null;
  getCreatedAt: (row: T) => string;
  getPairKey:   (row: T) => string;
  getPairName:  (row: T) => string;
}

export interface XrefPairGroup<T> {
  pairKey:  string;
  pairName: string;
  items:    T[];
}

export function groupXrefsByPair<T>(rows: T[], acc: XrefAccessors<T>): XrefPairGroup<T>[] {
  const map = new Map<string, XrefPairGroup<T>>();

  for (const row of rows) {
    const key = acc.getPairKey(row);
    let group = map.get(key);
    if (!group) {
      group = { pairKey: key, pairName: acc.getPairName(row), items: [] };
      map.set(key, group);
    }
    group.items.push(row);
  }

  for (const group of map.values()) {
    group.items.sort((a, b) => {
      const la = acc.getLabel(a)?.trim() || null;
      const lb = acc.getLabel(b)?.trim() || null;
      if (la && lb) return la.localeCompare(lb);
      if (la)       return -1;
      if (lb)       return  1;
      return acc.getCreatedAt(b).localeCompare(acc.getCreatedAt(a));
    });
  }

  return [...map.values()].sort((a, b) =>
    b.items.length !== a.items.length
      ? b.items.length - a.items.length
      : a.pairName.localeCompare(b.pairName),
  );
}
