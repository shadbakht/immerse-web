'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import SignInPrompt from './SignInPrompt';

interface Stats {
  tags: number;
  notes: number;
  xrefs: number;
}

interface RecentBook {
  bookId: string;
  title: string;
  authorName: string;
  updatedAt: string;
}

interface HomePanelProps {
  userId:      string;
  onOpenBook:  (bookId: string) => void;
  onTabChange: (tab: string) => void;
}

export default function HomePanel({ userId, onOpenBook, onTabChange }: HomePanelProps) {
  const supabase = createClient();
  const [stats, setStats] = useState<Stats>({ tags: 0, notes: 0, xrefs: 0 });
  const [recentBooks, setRecentBooks] = useState<RecentBook[]>([]);
  const [loading, setLoading] = useState(true);

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
      ] = await Promise.all([
        supabase.from('tags').select('id', { count: 'exact', head: true }).eq('user_id', userId),
        supabase.from('notes').select('id', { count: 'exact', head: true }).eq('user_id', userId),
        supabase.from('xrefs').select('id', { count: 'exact', head: true }).eq('user_id', userId),
        supabase
          .from('reading_progress')
          .select('book_id, updated_at')
          .eq('user_id', userId)
          .order('updated_at', { ascending: false })
          .limit(8),
      ]);

      setStats({ tags: tagCount ?? 0, notes: noteCount ?? 0, xrefs: xrefCount ?? 0 });

      if (progressData?.length) {
        const bookIds = progressData.map(p => p.book_id);
        const { data: bookData } = await supabase
          .from('books')
          .select('id, title, authors(name)')
          .in('id', bookIds);

        const bookMap = Object.fromEntries((bookData ?? []).map(b => [b.id, b]));
        setRecentBooks(
          progressData
            .filter(p => bookMap[p.book_id])
            .map(p => ({
              bookId:     p.book_id,
              title:      bookMap[p.book_id].title,
              authorName: (bookMap[p.book_id].authors as any)?.name ?? '',
              updatedAt:  p.updated_at,
            })),
        );
      }
    } finally {
      setLoading(false);
    }
  }

  function formatDate(iso: string) {
    const d = new Date(iso);
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
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
        <h1 className="text-2xl font-semibold text-gray-900 mb-8">Home</h1>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-6 h-6 border-2 border-[#1B6B7B] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 mb-10">
              {statItems.map(({ label, count, color, tab }) => (
                <button
                  key={label}
                  onClick={() => onTabChange(tab)}
                  className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 text-left hover:border-[#1B6B7B]/30 hover:shadow-md transition-all"
                >
                  <div className="text-5xl font-light text-gray-900 mb-1">{count}</div>
                  <div className="text-xs font-bold tracking-widest uppercase" style={{ color }}>
                    {label}
                  </div>
                </button>
              ))}
            </div>

            {/* Recently read */}
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-4">
              Recently Read
            </h2>
            {!userId ? (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-8 text-center">
                <p className="text-sm text-gray-600 leading-relaxed mb-4">
                  Sign in to see your recently read books, annotations, and more across all your devices.
                </p>
                <a
                  href="/login"
                  className="inline-block bg-[#1B6B7B] text-white font-semibold py-2.5 px-6 rounded-xl hover:bg-[#155a68] transition-colors text-sm"
                >
                  Sign In or Create Account
                </a>
              </div>
            ) : recentBooks.length === 0 ? (
              <p className="text-sm text-gray-400">No reading history yet. Open a book from the Library to get started.</p>
            ) : (
              <div className="space-y-2">
                {recentBooks.map(book => (
                  <button
                    key={book.bookId}
                    onClick={() => onOpenBook(book.bookId)}
                    className="w-full text-left bg-white rounded-xl px-5 py-4 shadow-sm border border-gray-100 hover:border-[#1B6B7B]/30 hover:bg-[#1B6B7B]/5 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{book.title}</div>
                        {book.authorName && (
                          <div className="text-xs text-gray-400 mt-0.5">{book.authorName}</div>
                        )}
                      </div>
                      <div className="text-xs text-gray-300 shrink-0 ml-4">{formatDate(book.updatedAt)}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
