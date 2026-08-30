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
