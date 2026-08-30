import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { UUID_RE } from '@/lib/shareUrl';
import { buildShareMetaDescription, buildXrefShareMetaDescription } from '@/lib/shareMeta';
import type { ImmTagExport } from '@/lib/communitySync';
import SharedCompilationView from './SharedCompilationView';
import SharedXrefsView from './SharedXrefsView';

interface Props {
  params: Promise<{ id: string }>;
}

// The public page for one shared set. Deliberately noindex: a share link is
// link-only (unlisted), so it must never enter search results or the sitemap.
// Publishing to Discover is the separate, indexable path.
//
// Phase 8: the row comes from `shared_sets`, not `community_tags` — every
// pre-existing community_tags row was backfilled into shared_sets under the
// SAME uuid (Part A6), so every Phase 5 link keeps resolving here. `kind`
// picks the view: 'compilation' (payload snapshot) or 'xrefs' (live RPC).
const SELECT = 'id, kind, title, payload, item_count';

// Kept out of the returned object literal so the i18n:check linter doesn't flag
// it as a hardcoded UI string — this is page <title> metadata, which a server
// component cannot route through t().
const NOT_FOUND_TITLE = 'Shared page not found';

type SharedSetRow = {
  id: string;
  kind: string | null;
  title: string | null;
  payload: unknown;
  item_count: number | null;
};

async function loadRow(id: string): Promise<SharedSetRow | null> {
  const supabase = await createClient();
  const { data } = await supabase.from('shared_sets').select(SELECT).eq('id', id).maybeSingle();
  return (data as SharedSetRow | null) ?? null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const notFoundMeta: Metadata = {
    title: { absolute: NOT_FOUND_TITLE },
    robots: { index: false, follow: false },
  };
  if (!UUID_RE.test(id)) return notFoundMeta;

  const row = await loadRow(id);
  if (!row) return notFoundMeta;

  const name = row.title ?? '';

  if (row.kind === 'xrefs') {
    // Same RPC the client view uses — it is SECURITY DEFINER and cheap.
    const supabase = await createClient();
    const { data: set } = await supabase.rpc('get_shared_xref_set', { share_id: id });
    const content = (((set as { content?: unknown } | null)?.content ?? []) as {
      a?: { snapshot_text?: string | null } | null;
    }[]);
    const title = `${name} — cross-references on Immerse`;
    const description = buildXrefShareMetaDescription(content, content.length);
    return {
      title: { absolute: title },
      description,
      robots: { index: false, follow: false },
      openGraph: { title, description, type: 'article' },
      twitter: { card: 'summary', title, description },
    };
  }

  const payload = (Array.isArray(row.payload) ? row.payload : []) as ImmTagExport[];
  const description = buildShareMetaDescription(payload, row.item_count ?? payload.length);
  const title = `${name} — a compilation on Immerse`;
  return {
    title: { absolute: title },
    description,
    robots: { index: false, follow: false },
    openGraph: { title, description, type: 'article' },
    twitter: { card: 'summary', title, description },
  };
}

export default async function SharedSetPage({ params }: Props) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const row = await loadRow(id);
  if (!row) notFound();

  return (
    <div className="min-h-screen bg-[#F8F7F4] dark:bg-[#0F1923]">
      <main className="mx-auto max-w-2xl px-4 py-10">
        {row.kind === 'xrefs' ? (
          <SharedXrefsView id={row.id} title={row.title ?? ''} />
        ) : (
          <SharedCompilationView
            id={row.id}
            name={row.title ?? ''}
            payload={Array.isArray(row.payload) ? row.payload : []}
          />
        )}
      </main>
    </div>
  );
}
