export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

import { SITE_URL } from './siteUrl';

// Always absolute: the link is copied into messages, so a bare /c/<id> (what an
// unset NEXT_PUBLIC_SITE_URL used to produce) would lead nowhere.
export function shareUrl(id: string, base = SITE_URL): string {
  return `${base.replace(/\/+$/, '')}/c/${id}`;
}

export function parseSharePath(
  pathname: string,
  search: string,
): { id: string; save: boolean } | null {
  const m = pathname.match(/^\/c\/([^/?#]+)\/?$/);
  if (!m || !UUID_RE.test(m[1])) return null;
  const save = new URLSearchParams(search).get('save') === '1';
  return { id: m[1], save };
}
