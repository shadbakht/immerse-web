/**
 * traditionKey.ts — one language-neutral key per tradition.
 *
 * Every language's library has its own root categories (`cat-bahai`,
 * `cat-fr-bahai`, `cat-zh-bahai`, …) named in that language, so grouping
 * cross-references by root category split one tradition into a group per
 * language ("Christian", "Hristiyanlık", "基督教"). The key collapses them, and
 * the label comes from the reader's UI language instead of the book's.
 *
 * Same code (only this line differs) in the mobile app's `src/utils/traditionKey.ts` — keep in step.
 */

export type TraditionKey =
  | 'bahai' | 'buddhist' | 'christian' | 'hindu' | 'islamic' | 'jewish' | 'zoroastrian' | 'more';

const KEYS: readonly TraditionKey[] = [
  'bahai', 'buddhist', 'christian', 'hindu', 'islamic', 'jewish', 'zoroastrian', 'more',
];

/** `cat-bahai` / `cat-fr-bahai` → 'bahai'. null for anything that isn't a tradition root. */
export function traditionKeyFromRootCategoryId(id: string): TraditionKey | null {
  const m = /^cat-(?:[a-z]{2}-)?([a-z]+)$/.exec(id);
  const key = m?.[1] as TraditionKey | undefined;
  return key && KEYS.includes(key) ? key : null;
}

// Supabase `traditions.name` (one row per tradition, shared by every language).
const BY_SUPABASE_NAME: Record<string, TraditionKey> = {
  "Bahá'í": 'bahai', Buddhist: 'buddhist', Christian: 'christian', Hindu: 'hindu',
  Islam: 'islamic', Jewish: 'jewish', More: 'more', Zoroastrian: 'zoroastrian',
};

export function traditionKeyFromSupabaseName(name: string | null | undefined): TraditionKey | null {
  return (name && BY_SUPABASE_NAME[name]) || null;
}

/** The i18n key that names a tradition in the UI language. */
export function traditionLabelKey(key: TraditionKey) {
  return key === 'more' ? 'common.otherTradition' as const : `reminders.tradition.${key}` as const;
}

/** The grouping id for a tradition key — stable across languages. */
export function traditionGroupId(key: TraditionKey): string {
  return `tradition:${key}`;
}
