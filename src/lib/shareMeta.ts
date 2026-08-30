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
