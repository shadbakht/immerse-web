import type { ImmTagExport } from './communitySync';

export function buildShareMetaDescription(
  payload: ImmTagExport[],
  selectionCount: number,
): string {
  const firstQuote = payload
    .flatMap(t => t.selections ?? [])
    .map(s => (s.snapshotText ?? '').trim())
    .find(Boolean);

  if (firstQuote) {
    if (firstQuote.length <= 160) return firstQuote;
    return firstQuote.slice(0, 160).trimEnd() + '…';
  }
  const noun = selectionCount === 1 ? 'passage' : 'passages';
  return `${selectionCount} ${noun} across the world’s scriptures.`;
}

interface XrefMetaEntry { a?: { snapshot_text?: string | null } | null }

export function buildXrefShareMetaDescription(
  entries: XrefMetaEntry[],
  count: number,
): string {
  const first = entries.map(e => (e.a?.snapshot_text ?? '').trim()).find(Boolean);
  if (first) {
    if (first.length <= 160) return first;
    return first.slice(0, 160).trimEnd() + '…';
  }
  const noun = count === 1 ? 'cross-reference' : 'cross-references';
  return `${count} ${noun} across the world’s scriptures.`;
}

/**
 * The heading for a shared compilation: the payload's single root node name.
 * Discover bundle shares used to store the source card's name as the row title
 * even when only a sub-compilation was shared, so the stored title can name a
 * parent the payload does not contain. Owner shares keep title == root name and
 * multi-root bundles carry a synthetic wrapper root, so this is a no-op for
 * them. Falls back to the row title when the payload has no single root.
 */
export function shareHeading(payload: ImmTagExport[], title: string): string {
  const roots = payload.filter(t => !t.parentExportId);
  return roots.length === 1 && roots[0].name ? roots[0].name : title;
}
