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

interface SearchResult {
  passageId:   string;
  bookId:      string;
  bookTitle:   string;
  authorName:  string;
  chapterLabel: string | null;
  sectionTitle: string | null;
  content:     string;
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
  const [bookCounts, setBookCounts] = useState<Record<string, number>>({});  // keyed by authorId
  const [books, setBooks] = useState<Record<string, Book[]>>({});            // keyed by authorId
  const [openTraditions, setOpenTraditions] = useState<Set<string>>(new Set());
  const [openAuthors, setOpenAuthors] = useState<Set<string>>(new Set());
  const [loadingBooks, setLoadingBooks] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (activeTab !== 'library') return;
    load();
  }, [activeTab]);

  async function load() {
    setLoading(true);
    try {
      const [{ data: trad }, { data: auth }, { data: counts }] = await Promise.all([
        supabase.from('traditions').select('id, name, sort_order').order('sort_order').order('name'),
        supabase.from('authors').select('id, name, tradition_id, sort_order').order('sort_order').order('name'),
        supabase.from('books').select('author_id').eq('is_user_imported', false),
      ]);
      setTraditions(trad ?? []);
      setAuthors(auth ?? []);
      const countMap: Record<string, number> = {};
      for (const b of counts ?? []) countMap[b.author_id] = (countMap[b.author_id] ?? 0) + 1;
      setBookCounts(countMap);
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

  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) { setSearchResults([]); return; }
    const timer = setTimeout(() => doSearch(q), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  async function doSearch(q: string) {
    setSearchLoading(true);
    try {
      const { data } = await supabase
        .from('passages')
        .select('id, content, chapter_label, section_title, books(id, title, authors(name))')
        .textSearch('content', q, { type: 'plain', config: 'english' })
        .limit(40);

      setSearchResults((data ?? []).map((p: any) => ({
        passageId:    p.id,
        bookId:       p.books?.id ?? '',
        bookTitle:    p.books?.title ?? '',
        authorName:   p.books?.authors?.name ?? '',
        chapterLabel: p.chapter_label,
        sectionTitle: p.section_title,
        content:      p.content,
      })));
    } finally {
      setSearchLoading(false);
    }
  }

  function getSnippet(content: string, query: string): string {
    const words = query.trim().split(/\s+/).filter(Boolean);
    const lower = content.toLowerCase();
    let bestIdx = -1;
    for (const w of words) {
      const idx = lower.indexOf(w.toLowerCase());
      if (idx !== -1) { bestIdx = idx; break; }
    }
    if (bestIdx === -1) return content.slice(0, 200);
    const start = Math.max(0, bestIdx - 80);
    const end   = Math.min(content.length, bestIdx + 200);
    return (start > 0 ? '…' : '') + content.slice(start, end) + (end < content.length ? '…' : '');
  }

  function highlightQuery(text: string, query: string) {
    const words = query.trim().split(/\s+/).filter(Boolean);
    if (!words.length) return <span>{text}</span>;
    const pattern = new RegExp(`(${words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
    const parts = text.split(pattern);
    return (
      <>
        {parts.map((part, i) =>
          pattern.test(part)
            ? <mark key={i} className="bg-yellow-100 text-yellow-900 rounded px-0.5">{part}</mark>
            : <span key={i}>{part}</span>
        )}
      </>
    );
  }

  if (activeTab !== 'library') {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
        {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} — coming soon
      </div>
    );
  }

  const isSearching = searchQuery.trim().length > 0;

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-4 pb-3 border-b border-gray-100">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Library</h2>
        {/* Search input */}
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search all books…"
            className="w-full pl-9 pr-8 py-2 text-sm border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#1B6B7B]/30 focus:border-[#1B6B7B] bg-gray-50"
          />
          {searchQuery && (
            <button
              onClick={() => { setSearchQuery(''); setSearchResults([]); }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-lg leading-none"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {loading && !isSearching ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-[#1B6B7B] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : isSearching ? (
        /* ── Search results ── */
        <div className="flex-1 overflow-y-auto">
          {searchLoading ? (
            <div className="flex justify-center py-10">
              <div className="w-5 h-5 border-2 border-[#1B6B7B] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : searchResults.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-10">No results for "{searchQuery}"</p>
          ) : (
            <div>
              <p className="text-xs text-gray-400 px-4 py-2">{searchResults.length} results</p>
              {searchResults.map(result => {
                const isExpanded = expandedResults.has(result.passageId);
                const snippet = getSnippet(result.content, searchQuery);
                const location = result.chapterLabel || result.sectionTitle;
                return (
                  <div key={result.passageId} className="border-b border-gray-100">
                    <button
                      className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors"
                      onClick={() => {
                        setExpandedResults(prev => {
                          const next = new Set(prev);
                          next.has(result.passageId) ? next.delete(result.passageId) : next.add(result.passageId);
                          return next;
                        });
                      }}
                      onDoubleClick={() => onOpenBook(result.bookId, result.passageId)}
                    >
                      <p className="text-xs text-[#1B6B7B] font-medium mb-1 truncate">
                        {result.bookTitle}{location ? ` · ${location}` : ''}
                      </p>
                      <p className="text-sm text-gray-700 leading-relaxed">
                        {highlightQuery(snippet, searchQuery)}
                      </p>
                      <p className="text-xs text-gray-400 mt-1.5">
                        {isExpanded ? 'Click to collapse · Double-click to open in reader' : 'Click to expand · Double-click to open in reader'}
                      </p>
                    </button>
                    {isExpanded && (
                      <div className="px-4 pb-3 bg-gray-50">
                        <p className="text-sm text-gray-700 leading-relaxed">
                          {highlightQuery(result.content, searchQuery)}
                        </p>
                        <button
                          onClick={() => onOpenBook(result.bookId, result.passageId)}
                          className="mt-2 text-xs text-[#1B6B7B] font-medium hover:underline"
                        >
                          Open in reader →
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
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
                        <div className="flex items-center gap-2">
                          {(bookCounts[author.id] ?? 0) > 0 && (
                            <span className="text-xs text-gray-400">{bookCounts[author.id]}</span>
                          )}
                          <span className={`text-gray-400 text-xs transition-transform duration-150 inline-block ${isAuthorOpen ? 'rotate-90' : ''}`}>›</span>
                        </div>
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

