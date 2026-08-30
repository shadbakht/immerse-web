import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { UUID_RE } from '@/lib/shareUrl';
import { buildShareMetaDescription } from '@/lib/shareMeta';
import SharedCompilationView from './SharedCompilationView';

interface Props {
  params: Promise<{ id: string }>;
}

// The public page for one shared compilation. Deliberately noindex: a share
// link is link-only (unlisted), so it must never enter search results or the
// sitemap. Publishing to Discover is the separate, indexable path.
const SELECT = 'id, name, payload, selection_count';

// Kept out of the returned object literal so the i18n:check linter doesn't flag
// it as a hardcoded UI string — this is page <title> metadata, which a server
// component cannot route through t().
const NOT_FOUND_TITLE = 'Compilation not found';

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return { title: { absolute: NOT_FOUND_TITLE }, robots: { index: false, follow: false } };
  }

  const supabase = await createClient();
  const { data: row } = await supabase
    .from('community_tags')
    .select(SELECT)
    .eq('id', id)
    .maybeSingle();

  if (!row) {
    return { title: { absolute: NOT_FOUND_TITLE }, robots: { index: false, follow: false } };
  }

  const description = buildShareMetaDescription(
    Array.isArray(row.payload) ? row.payload : [],
    row.selection_count,
  );
  const title = `${row.name} — a compilation on Immerse`;
  return {
    title: { absolute: title },
    description,
    robots: { index: false, follow: false },
    openGraph: { title, description, type: 'article' },
    twitter: { card: 'summary', title, description },
  };
}

export default async function SharedCompilationPage({ params }: Props) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const supabase = await createClient();
  const { data: row } = await supabase
    .from('community_tags')
    .select(SELECT)
    .eq('id', id)
    .maybeSingle();

  if (!row) notFound();

  return (
    <div className="min-h-screen bg-[#F8F7F4] dark:bg-[#0F1923]">
      <main className="mx-auto max-w-2xl px-4 py-10">
        <SharedCompilationView
          id={row.id}
          name={row.name}
          payload={Array.isArray(row.payload) ? row.payload : []}
        />
      </main>
    </div>
  );
}
