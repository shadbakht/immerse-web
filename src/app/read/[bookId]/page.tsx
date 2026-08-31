import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import AppShell from '@/components/AppShell';
import { SITE_URL } from '@/lib/siteUrl';
import { loadCatalogServer, findBook, bookDescription } from '@/lib/catalogServer';
import { traditionName } from '@/lib/catalog';

interface Props {
  params: Promise<{ bookId: string }>;
  // ?p=<passageUuid> — a deep link into a specific paragraph (shared xref sets,
  // shared compilation quotes). ReaderPanel scrolls to it once the book loads.
  searchParams: Promise<{ p?: string }>;
}

// bookId is usually a catalog slug ("hidden-words") but can also be a
// Supabase uuid (old share links, imported books) — those aren't in
// catalog.json, so metadata/JSON-LD is skipped for them rather than guessed;
// the page itself still renders fine either way (AppShell resolves both).
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { bookId } = await params;
  const catalog = loadCatalogServer();
  const book = findBook(catalog, bookId);
  if (!book) return {};

  const description = bookDescription(catalog, bookId) ?? undefined;
  const url = `/read/${book.id}`;

  return {
    title: book.title,
    description,
    alternates: { canonical: url },
    openGraph: { title: book.title, description, url },
  };
}

// Reading is open to everyone, signed in or not — including Googlebot, which
// is the whole point (see queue item #1, project_session_aug21_growth_websync_queue.md):
// gating this behind /login made all 1,419 books invisible to search. The
// ?guest=1 requirement this route used to have is gone; AppShell/ReaderPanel
// already show a sign-in prompt on the specific actions that need an account
// (tag/note/xref/publish), so nothing else changes for a signed-out reader.
export default async function ReadPage({ params, searchParams }: Props) {
  const { bookId } = await params;
  const { p: initialPassageId } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const catalog = loadCatalogServer();
  const book = findBook(catalog, bookId);
  const jsonLd = book && {
    '@context': 'https://schema.org',
    '@type': 'Book',
    name: book.title,
    url: `${SITE_URL}/read/${book.id}`,
    inLanguage: book.language ?? 'en',
    genre: traditionName(catalog, book.categoryId) || undefined,
    isAccessibleForFree: true,
  };

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          // Static, server-derived data only (catalog.json fields) — never
          // user input, so this is safe to inject directly.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <AppShell user={user} initialBookId={bookId} initialPassageId={initialPassageId} />
    </>
  );
}
