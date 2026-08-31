/**
 * How many rows a fully-expanded TOC may show before a book opens with its
 * sub-chapters collapsed. Kept in sync with the mobile constant of the same
 * name (src/reader/tocCollapse.ts in the Immerse repo).
 */
export const TOC_EXPAND_ROW_BUDGET = 30;

interface TocRow {
  passageId: string;
  depth?: number;
}

/**
 * The set of section passageIds a book should start collapsed on its first
 * open (no persisted collapse choice yet). Empty when the TOC is flat or the
 * fully-expanded TOC fits the budget; otherwise every section that has
 * children.
 */
export function seedCollapsedToc(
  toc: TocRow[],
  budget: number = TOC_EXPAND_ROW_BUDGET,
): Set<string> {
  const sectionsWithChildren = new Set<string>();
  let current: string | null = null;

  for (const row of toc) {
    if (!row.depth) {
      current = row.passageId;
    } else if (current) {
      sectionsWithChildren.add(current);
    }
  }

  if (sectionsWithChildren.size === 0) return new Set();
  if (toc.length <= budget) return new Set();

  return sectionsWithChildren;
}
