'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { NavTab } from './AppShell';
import TagPanel from './TagPanel';

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
  const [bookCounts, setBookCounts] = useState<Record<string, number>>({});    // keyed by authorId
  const [allBookIds, setAllBookIds] = useState<Record<string, string[]>>({});  // authorId -> bookIds (upfront)
  const [books, setBooks] = useState<Record<string, Book[]>>({});              // keyed by authorId (lazy titles)
  const [openTraditions, setOpenTraditions] = useState<Set<string>>(new Set());
  const [openAuthors, setOpenAuthors] = useState<Set<string>>(new Set());
  const [loadingBooks, setLoadingBooks] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set());
  // Checkbox selection
  const [selectedBookIds, setSelectedBookIds] = useState<Set<string>>(new Set());
  const [checkedResultIds, setCheckedResultIds] = useState<Set<string>>(new Set());
  const [tagPanelVisible, setTagPanelVisible] = useState(false);

  useEffect(() => {
    if (activeTab !== 'library') return;
    load();
  }, [activeTab]);

  async function load() {
    setLoading(true);
    try {
      const [{ data: trad }, { data: auth }, { data: bookData }] = await Promise.all([
        supabase.from('traditions').select('id, name, sort_order').order('sort_order').order('name'),
        supabase.from('authors').select('id, name, tradition_id, sort_order').order('sort_order').order('name'),
        supabase.from('books').select('id, author_id').eq('is_user_imported', false),
      ]);
      setTraditions(trad ?? []);
      setAuthors(auth ?? []);
      const countMap: Record<string, number> = {};
      const idMap: Record<string, string[]> = {};
      for (const b of bookData ?? []) {
        countMap[b.author_id] = (countMap[b.author_id] ?? 0) + 1;
        if (!idMap[b.author_id]) idMap[b.author_id] = [];
        idMap[b.author_id].push(b.id);
      }
      setBookCounts(countMap);
      setAllBookIds(idMap);
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

  // ── Checkbox helpers ──────────────────────────────────────────────────────────

  // Get all book IDs under an author (from upfront-loaded map)
  function bookIdsForAuthor(authorId: string): string[] {
    return allBookIds[authorId] ?? [];
  }

  // Get all book IDs under a tradition
  function bookIdsForTradition(traditionId: string): string[] {
    return authors
      .filter(a => a.tradition_id === traditionId)
      .flatMap(a => allBookIds[a.id] ?? []);
  }

  function checkStateFor(ids: string[]): 'checked' | 'indeterminate' | 'unchecked' {
    if (ids.length === 0) return 'unchecked';
    const n = ids.filter(id => selectedBookIds.has(id)).length;
    if (n === ids.length) return 'checked';
    if (n > 0) return 'indeterminate';
    return 'unchecked';
  }

  function toggleBookIds(ids: string[]) {
    if (ids.length === 0) return;
    setSelectedBookIds(prev => {
      const checkedCount = ids.filter(id => prev.has(id)).length;
      const next = new Set(prev);
      if (checkedCount === ids.length) {
        ids.forEach(id => next.delete(id)); // all checked → uncheck
      } else {
        ids.forEach(id => next.add(id));    // partial or none → check all
      }
      return next;
    });
  }

  function toggleSingleBook(bookId: string) {
    setSelectedBookIds(prev => {
      const next = new Set(prev);
      next.has(bookId) ? next.delete(bookId) : next.add(bookId);
      return next;
    });
  }

  async function handleTagSelected() {
    if (!userId) return;
    // Gather a representative selection text from the first selected book/result
    // For search results, use first checked result; otherwise use book IDs as targets
    setTagPanelVisible(true);
  }

  async function handleTagSave(tagIds: string[]) {
    if (!userId || tagIds.length === 0) return;
    const now = new Date().toISOString();
    const checkedResults = searchResults.filter(r => checkedResultIds.has(r.passageId));
    for (const result of checkedResults) {
      const { data: sel } = await supabase
        .from('selections')
        .insert({ user_id: userId, passage_id: result.passageId, start_offset: 0, end_offset: result.content.length, snapshot_text: result.content.slice(0, 300), created_at: now })
        .select('id').single();
      if (!sel) continue;
      await Promise.all(tagIds.map(tagId =>
        supabase.from('selection_tags').insert({ selection_id: sel.id, tag_id: tagId, created_at: now })
      ));
    }
    setCheckedResultIds(new Set());
    setTagPanelVisible(false);
  }

  // ── Search ────────────────────────────────────────────────────────────────────

  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) { setSearchResults([]); return; }
    const timer = setTimeout(() => doSearch(q), 300);
    return () => clearTimeout(timer);
  }, [searchQuery, selectedBookIds]);

  async function doSearch(q: string) {
    setSearchLoading(true);
    try {
      let query = supabase
        .from('passages')
        .select('id, content, chapter_label, section_title, books(id, title, authors(name))')
        .textSearch('content', q, { type: 'plain', config: 'english' })
        .limit(40);
      if (selectedBookIds.size > 0) {
        query = query.in('book_id', [...selectedBookIds]);
      }
      const { data } = await query;

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
            placeholder={selectedBookIds.size > 0 ? `Search ${selectedBookIds.size} selected book${selectedBookIds.size !== 1 ? 's' : ''}…` : 'Search all books…'}
            className="w-full pl-9 pr-8 py-2 text-sm text-gray-900 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#1B6B7B]/30 focus:border-[#1B6B7B] bg-gray-50"
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
                const isChecked = checkedResultIds.has(result.passageId);
                const snippet = getSnippet(result.content, searchQuery);
                const location = result.chapterLabel || result.sectionTitle;
                return (
                  <div key={result.passageId} className={`border-b border-gray-100 ${isChecked ? 'bg-[#1B6B7B]/5' : ''}`}>
                    <div className="flex items-start">
                      <Checkbox
                        state={isChecked ? 'checked' : 'unchecked'}
                        onChange={() => setCheckedResultIds(prev => {
                          const next = new Set(prev);
                          next.has(result.passageId) ? next.delete(result.passageId) : next.add(result.passageId);
                          return next;
                        })}
                        className="pl-3 pr-1 pt-3.5 shrink-0"
                      />
                      <button
                        className="flex-1 text-left pr-4 py-3 hover:bg-gray-50 transition-colors"
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
                        {isExpanded ? (
                          <>
                            <p className="text-sm text-gray-700 leading-relaxed mt-1">
                              {highlightQuery(result.content, searchQuery)}
                            </p>
                            <button
                              onClick={e => { e.stopPropagation(); onOpenBook(result.bookId, result.passageId); }}
                              className="mt-2 text-xs text-[#1B6B7B] font-medium hover:underline"
                            >
                              Open in reader →
                            </button>
                          </>
                        ) : (
                          <p className="text-sm text-gray-700 leading-relaxed">
                            {highlightQuery(snippet, searchQuery)}
                          </p>
                        )}
                      </button>
                    </div>
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
            const tradBookIds = bookIdsForTradition(tradition.id);
            const tradState = checkStateFor(tradBookIds);

            return (
              <div key={tradition.id}>
                {/* Tradition row */}
                <div className="flex items-center border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <Checkbox
                    state={tradState}
                    onChange={() => toggleBookIds(tradBookIds)}
                    className="pl-3 pr-1 py-3.5 shrink-0"
                  />
                  <button
                    onClick={() => toggleTradition(tradition.id)}
                    className="flex-1 flex items-center justify-between pr-4 py-3.5 text-left"
                  >
                    <span className="text-sm font-medium text-gray-800">{tradition.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">{tradAuthors.length}</span>
                      <span className={`text-gray-400 text-xs transition-transform duration-150 inline-block ${isOpen ? 'rotate-90' : ''}`}>›</span>
                    </div>
                  </button>
                </div>

                {/* Authors */}
                {isOpen && tradAuthors.map(author => {
                  const isAuthorOpen = openAuthors.has(author.id);
                  const authorBooks = books[author.id] ?? [];
                  const authorBookIds = bookIdsForAuthor(author.id);
                  const authorState = checkStateFor(authorBookIds);

                  return (
                    <div key={author.id}>
                      <div className="flex items-center border-b border-gray-100 bg-gray-50/50 hover:bg-gray-50 transition-colors">
                        <Checkbox
                          state={authorState}
                          onChange={() => toggleBookIds(authorBookIds)}
                          className="pl-6 pr-1 py-3 shrink-0"
                        />
                        <button
                          onClick={() => toggleAuthor(author.id)}
                          className="flex-1 flex items-center justify-between pr-4 py-3 text-left"
                        >
                          <span className="text-sm text-gray-700">{author.name}</span>
                          <div className="flex items-center gap-2">
                            {(bookCounts[author.id] ?? 0) > 0 && (
                              <span className="text-xs text-gray-400">{bookCounts[author.id]}</span>
                            )}
                            <span className={`text-gray-400 text-xs transition-transform duration-150 inline-block ${isAuthorOpen ? 'rotate-90' : ''}`}>›</span>
                          </div>
                        </button>
                      </div>

                      {/* Books */}
                      {isAuthorOpen && (
                        <div className="bg-white">
                          {loadingBooks.has(author.id) ? (
                            <div className="flex justify-center py-3">
                              <div className="w-4 h-4 border-2 border-[#1B6B7B] border-t-transparent rounded-full animate-spin" />
                            </div>
                          ) : authorBooks.map(book => {
                            const isBookChecked = selectedBookIds.has(book.id);
                            return (
                              <div key={book.id} className="flex items-center border-b border-gray-100 hover:bg-gray-50 transition-colors">
                                <Checkbox
                                  state={isBookChecked ? 'checked' : 'unchecked'}
                                  onChange={() => toggleSingleBook(book.id)}
                                  className="pl-9 pr-1 py-3 shrink-0"
                                />
                                <button
                                  onClick={() => onOpenBook(book.id)}
                                  className="flex-1 text-left pr-4 py-3"
                                >
                                  <div className="text-sm text-gray-800">{book.title}</div>
                                </button>
                              </div>
                            );
                          })}
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

      {/* Action bar — search results only */}
      {checkedResultIds.size > 0 && (
        <div className="border-t border-gray-200 px-4 py-3 bg-white flex items-center justify-between gap-3 shrink-0">
          <button
            onClick={() => setCheckedResultIds(new Set())}
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => setTagPanelVisible(true)}
            className="flex-1 bg-[#1B6B7B] text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-[#155a68] transition-colors"
          >
            Tag ({checkedResultIds.size})
          </button>
        </div>
      )}

      <TagPanel
        visible={tagPanelVisible}
        onClose={() => setTagPanelVisible(false)}
        userId={userId}
        selectionText={searchResults.filter(r => checkedResultIds.has(r.passageId)).map(r => r.content.slice(0, 80)).join(' · ')}
        onSave={handleTagSave}
      />
    </div>
  );
}

// ── Checkbox component ─────────────────────────────────────────────────────────

function Checkbox({ state, onChange, className }: {
  state: 'checked' | 'indeterminate' | 'unchecked';
  onChange: () => void;
  className?: string;
}) {
  return (
    <button
      onClick={e => { e.stopPropagation(); onChange(); }}
      className={`flex items-center justify-center ${className}`}
    >
      <div className={`w-4.5 h-4.5 w-[18px] h-[18px] rounded border-2 flex items-center justify-center transition-colors shrink-0 ${
        state === 'checked'       ? 'bg-[#1B6B7B] border-[#1B6B7B]' :
        state === 'indeterminate' ? 'border-[#1B6B7B]' :
                                    'border-gray-300'
      }`}>
        {state === 'checked'       && <span className="text-white text-[10px] leading-none font-bold">✓</span>}
        {state === 'indeterminate' && <div className="w-2 h-0.5 bg-[#1B6B7B] rounded-full" />}
      </div>
    </button>
  );
}

