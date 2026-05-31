'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { NavTab } from './AppShell';

interface Tradition {
  id: string;
  name: string;
  sort_order: number;
}

interface Author {
  id: string;
  name: string;
  tradition_id: string;
  sort_order: number;
}

interface Book {
  id: string;
  title: string;
  authorName: string;
  authorId: string;
}

interface LibraryPanelProps {
  activeTab:  NavTab;
  userId:     string;
  onOpenBook: (bookId: string, passageId?: string) => void;
}

export default function LibraryPanel({ activeTab, userId, onOpenBook }: LibraryPanelProps) {
  const supabase = createClient();

  const [traditions, setTraditions] = useState<Tradition[]>([]);
  const [authors, setAuthors] = useState<Author[]>([]);
  const [books, setBooks] = useState<Record<string, Book[]>>({});           // keyed by authorId
  const [openTraditions, setOpenTraditions] = useState<Set<string>>(new Set());
  const [openAuthors, setOpenAuthors] = useState<Set<string>>(new Set());
  const [loadingBooks, setLoadingBooks] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (activeTab !== 'library') return;
    load();
  }, [activeTab]);

  async function load() {
    setLoading(true);
    try {
      const [{ data: trad }, { data: auth }] = await Promise.all([
        supabase.from('traditions').select('id, name, sort_order').order('sort_order').order('name'),
        supabase.from('authors').select('id, name, tradition_id, sort_order').order('sort_order').order('name'),
      ]);
      setTraditions(trad ?? []);
      setAuthors(auth ?? []);
    } finally {
      setLoading(false);
    }
  }

  async function loadBooks(authorId: string) {
    if (books[authorId] || loadingBooks.has(authorId)) return;
    setLoadingBooks(prev => new Set(prev).add(authorId));
    try {
      const { data } = await supabase
        .from('books')
        .select('id, title, author_id')
        .eq('author_id', authorId)
        .eq('is_user_imported', false)
        .order('sort_order')
        .order('title');
      const authorName = authors.find(a => a.id === authorId)?.name ?? '';
      setBooks(prev => ({
        ...prev,
        [authorId]: (data ?? []).map(b => ({ id: b.id, title: b.title, authorName, authorId: b.author_id })),
      }));
    } finally {
      setLoadingBooks(prev => { const next = new Set(prev); next.delete(authorId); return next; });
    }
  }

  function toggleTradition(id: string) {
    setOpenTraditions(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAuthor(id: string) {
    setOpenAuthors(prev => {
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
            const tradAuthors = authors.filter(a => a.tradition_id === tradition.id);
            const isOpen = openTraditions.has(tradition.id);
            return (
              <div key={tradition.id}>
                {/* Tradition row */}
                <button
                  onClick={() => toggleTradition(tradition.id)}
                  className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 transition-colors border-b border-gray-100"
                >
                  <span className="text-sm font-medium text-gray-800">{tradition.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">{tradAuthors.length}</span>
                    <span className={`text-gray-400 text-xs transition-transform duration-150 inline-block ${isOpen ? 'rotate-90' : ''}`}>›</span>
                  </div>
                </button>

                {/* Authors */}
                {isOpen && tradAuthors.map(author => {
                  const isAuthorOpen = openAuthors.has(author.id);
                  const authorBooks = books[author.id] ?? [];
                  return (
                    <div key={author.id}>
                      <button
                        onClick={() => toggleAuthor(author.id)}
                        className="w-full flex items-center justify-between pl-7 pr-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-100 bg-gray-50/50"
                      >
                        <span className="text-sm text-gray-700">{author.name}</span>
                        <span className={`text-gray-400 text-xs transition-transform duration-150 inline-block ${isAuthorOpen ? 'rotate-90' : ''}`}>›</span>
                      </button>

                      {/* Books */}
                      {isAuthorOpen && (
                        <div className="bg-white">
                          {loadingBooks.has(author.id) ? (
                            <div className="flex justify-center py-3">
                              <div className="w-4 h-4 border-2 border-[#1B6B7B] border-t-transparent rounded-full animate-spin" />
                            </div>
                          ) : authorBooks.map(book => (
                            <button
                              key={book.id}
                              onClick={() => onOpenBook(book.id)}
                              className="w-full text-left pl-11 pr-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors"
                            >
                              <div className="text-sm text-gray-800">{book.title}</div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
