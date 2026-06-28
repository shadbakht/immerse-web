'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { loadCatalog, loadSlugMaps, collectionName } from '@/lib/catalog';
import type { Catalog } from '@/lib/catalog';
import { ContextMenu, type MenuOption } from './ContextMenu';

interface Stats {
  tags: number;
  notes: number;
  xrefs: number;
}

interface RecentBook {
  bookId:     string;   // Supabase UUID (for opening the reader)
  passageId:  string | null;
  title:      string;
  subtitle:   string;
  updatedAt:  string;
  fraction:   number;
}

interface HomePanelProps {
  userId:      string;
  onOpenBook:  (bookId: string, passageId?: string) => void;
  onTabChange: (tab: string) => void;
}

export default function HomePanel({ userId, onOpenBook, onTabChange }: HomePanelProps) {
  const supabase = createClient();
  const [stats, setStats]           = useState<Stats>({ tags: 0, notes: 0, xrefs: 0 });
  const [recentBooks, setRecentBooks] = useState<RecentBook[]>([]);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    load();
  }, [userId]);

  async function load() {
    setLoading(true);
    try {
      const [
        { count: tagCount },
        { count: noteCount },
        { count: xrefCount },
        { data: progressData },
        catalog,
        { uuidToSlug },
      ] = await Promise.all([
        supabase.from('tags').select('id', { count: 'exact', head: true }).eq('user_id', userId),
        supabase.from('notes').select('id', { count: 'exact', head: true }).eq('user_id', userId),
        supabase.from('xrefs').select('id', { count: 'exact', head: true }).eq('user_id', userId),
        supabase
          .from('reading_progress')
          .select('book_id, passage_id, updated_at, fraction')
          .eq('user_id', userId)
          .order('updated_at', { ascending: false })
          .limit(8),
        loadCatalog(),
        loadSlugMaps(supabase),
      ]);

      setStats({ tags: tagCount ?? 0, notes: noteCount ?? 0, xrefs: xrefCount ?? 0 });

      if (progressData?.length) {
        const catalogBookMap = new Map(catalog.books.map(b => [b.id, b]));

        const recent: RecentBook[] = progressData.map(p => {
          // Prefer catalog title/subtitle (matches iOS exactly)
          const slug = uuidToSlug.get(p.book_id);
          const catBook = slug ? catalogBookMap.get(slug) : null;
          const title    = catBook?.title ?? '—';
          const subtitle = catBook ? collectionName(catalog, catBook.categoryId) : '';

          return {
            bookId:    p.book_id,
            passageId: p.passage_id ?? null,
            title,
            subtitle,
            updatedAt: p.updated_at,
            fraction:  p.fraction ?? 0,
          };
        }).filter(b => b.title !== '—');

        setRecentBooks(recent);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleRemoveRecentBook(bookId: string) {
    try { await supabase.from('reading_progress').delete().eq('user_id', userId).eq('book_id', bookId); } catch {}
    setRecentBooks(prev => prev.filter(b => b.bookId !== bookId));
  }

  function formatDate(iso: string) {
    const d = new Date(iso);
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 3600)   return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400)  return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  const statItems = [
    { label: 'Tags',   count: stats.tags,  color: '#3B82F6', tab: 'tags'  },
    { label: 'Notes',  count: stats.notes, color: '#F59E0B', tab: 'notes' },
    { label: 'X-Refs', count: stats.xrefs, color: '#10B981', tab: 'xrefs' },
  ];

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto px-8 py-10">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-[#E2EAF2] mb-8">Home</h1>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-6 h-6 border-2 border-[#1B6B7B] dark:border-[#2D9DB3] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 mb-10">
              {statItems.map(({ label, count, color, tab }) => (
                <button
                  key={label}
                  onClick={() => onTabChange(tab)}
                  className="bg-white dark:bg-[#1B2A38] rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-[#2D4050] text-left hover:border-[#1B6B7B]/30 dark:hover:border-[#2D9DB3]/30 hover:shadow-md transition-all"
                >
                  <div className="text-5xl font-light text-gray-900 dark:text-[#E2EAF2] mb-1">{count}</div>
                  <div className="text-xs font-bold tracking-widest uppercase" style={{ color }}>
                    {label}
                  </div>
                </button>
              ))}
            </div>

            {/* Recently read */}
            <h2 className="text-sm font-semibold text-gray-400 dark:text-[#5C7A8E] uppercase tracking-widest mb-4">
              Recently Read
            </h2>
            {!userId ? (
              <div className="bg-white dark:bg-[#1B2A38] rounded-2xl border border-gray-100 dark:border-[#2D4050] shadow-sm px-6 py-8 text-center">
                <p className="text-sm text-gray-600 dark:text-[#8FA4B8] leading-relaxed mb-4">
                  Sign in to see your recently read books, annotations, and more across all your devices.
                </p>
                <a
                  href="/login"
                  className="inline-block bg-[#1B6B7B] dark:bg-[#2D9DB3] text-white font-semibold py-2.5 px-6 rounded-xl hover:bg-[#155a68] dark:hover:bg-[#2589A0] transition-colors text-sm"
                >
                  Sign In or Create Account
                </a>
              </div>
            ) : recentBooks.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-[#5C7A8E]">No reading history yet. Open a book from the Library to get started.</p>
            ) : (
              <div className="space-y-2">
                {recentBooks.map(book => {
                  const pct = Math.min(100, Math.max(0, Math.round(book.fraction * 100)));
                  const menuOptions: MenuOption[] = [{
                    label: 'Remove from recently read',
                    icon: '✕',
                    color: 'danger',
                    onClick: () => handleRemoveRecentBook(book.bookId),
                  }];
                  return (
                    <div
                      key={book.bookId}
                      className="flex items-center bg-white dark:bg-[#1B2A38] rounded-xl shadow-sm border border-gray-100 dark:border-[#2D4050] hover:border-[#1B6B7B]/30 dark:hover:border-[#2D9DB3]/30 hover:bg-[#1B6B7B]/5 dark:hover:bg-[#2D9DB3]/5 transition-colors"
                    >
                      <button
                        onClick={() => onOpenBook(book.bookId, book.passageId ?? undefined)}
                        className="flex-1 min-w-0 text-left px-5 py-4"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="min-w-0 mr-4">
                            <div className="text-sm text-gray-800 dark:text-[#D2DCE8] truncate">{book.title}</div>
                            {book.subtitle && (
                              <div className="text-xs text-gray-400 dark:text-[#5C7A8E] mt-0.5 truncate">{book.subtitle}</div>
                            )}
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-xs font-medium text-[#1B6B7B] dark:text-[#2D9DB3]">{pct}%</div>
                            <div className="text-xs text-gray-300 dark:text-[#4A6478] mt-0.5">{formatDate(book.updatedAt)}</div>
                          </div>
                        </div>
                        <div className="h-1 bg-gray-100 dark:bg-[#2D4050] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#1B6B7B] dark:bg-[#2D9DB3] rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </button>
                      <div className="shrink-0 pr-2">
                        <ContextMenu options={menuOptions} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
