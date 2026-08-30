export interface ShareState { id: string; listed: boolean }

export function decideShareUpsert(
  existing: ShareState | null,
): { action: 'insert' | 'none'; listed: boolean } {
  if (!existing) return { action: 'insert', listed: false };
  return { action: 'none', listed: existing.listed };
}
