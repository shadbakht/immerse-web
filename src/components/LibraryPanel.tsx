'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { NavTab } from './AppShell';

interface Tradition {
  id: string;
  name: string;
  bookCount: number;
}

interface Book {
  id: string;
  title: string;
  author: string;
  traditionId: string;
}

interface LibraryPanelProps {
  activeTab:   NavTab;
  userId:      string;
  onOpenBook:  (bookId: string, passageId?: string) => void;
}

export default function LibraryPanel({ activeTab, userId, onOpenBook }: LibraryPanelProps) {
  const supabase = createClient();
  const [traditions, setTraditions] = useState<Tradition[]>([]);
  const [books, setBooks] = useState<Record<string, Book[]>>({});
  const [openTraditions, setOpenTraditions] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (activeTab !== 'library') return;
    loadTraditions();
  }, [activeTab]);

  async function loadTraditions() {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('traditions')
        .select('id, name')
        .order('name');

      if (!data) return;

      // Get book counts per tradition
      const { data: counts } = await supabase
        .from('books')
        .select('tradition_id')
        .eq('is_imported', false);

      const countMap: Record<string, number> = {};
      counts?.forEach(b => {
        countMap[b.tradition_id] = (countMap[b.tradition_id] ?? 0) + 1;
      });

      setTraditions(data.map(t => ({ id: t.id, name: t.name, bookCount: countMap[t.id] ?? 0 })));
    } finally {
      setLoading(false);
    }
  }

  async function loadBooks(traditionId: string) {
    if (books[traditionId]) return;
    const { data } = await supabase
      .from('books')
      .select('id, title, author_id, authors(name)')
      .eq('tradition_id', traditionId)
      .eq('is_imported', false)
      .order('title');

    if (data) {
      setBooks(prev => ({
        ...prev,
        [traditionId]: data.map((b: any) => ({
          id: b.id,
          title: b.title,
          author: b.authors?.name ?? '',
          traditionId,
        })),
      }));
    }
  }

  function toggleTradition(id: string) {
    setOpenTraditions(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        loadBooks(id);
      }
      return next;
    });
  }

  if (activeTab !== 'library') {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
        {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} — coming soon
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-4 border-b border-gray-100">
        <h2 className="text-lg font-semibold text-gray-900">Library</h2>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-[#1B6B7B] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {traditions.map(tradition => {
            const isOpen = openTraditions.has(tradition.id);
            return (
              <div key={tradition.id}>
                <button
                  onClick={() => toggleTradition(tradition.id)}
                  className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 transition-colors border-b border-gray-100"
                >
                  <span className="text-sm font-medium text-gray-800">{tradition.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">{tradition.bookCount}</span>
                    <span className={`text-gray-400 text-xs transition-transform ${isOpen ? 'rotate-90' : ''}`}>›</span>
                  </div>
                </button>

                {isOpen && (
                  <div className="bg-gray-50">
                    {(books[tradition.id] ?? []).map(book => (
                      <button
                        key={book.id}
                        onClick={() => onOpenBook(book.id)}
                        className="w-full text-left px-6 py-3 border-b border-gray-100 hover:bg-gray-100 transition-colors"
                      >
                        <div className="text-sm text-gray-800">{book.title}</div>
                        {book.author && (
                          <div className="text-xs text-gray-400 mt-0.5">{book.author}</div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
