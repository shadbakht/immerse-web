'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { NavTab } from './AppShell';
import TagPanel from './TagPanel';

// ── Catalog types (mirrors corpus.json structure) ─────────────────────────────

interface CatalogCategory {
  id: string;
  parentId: string | null;
  name: string;
  sortOrder: number;
  kind: 'tradition' | 'collection' | 'imported' | null;
}

interface CatalogBook {
  id: string;          // corpus slug, e.g. "bible-kjv-genesis"
  categoryId: string;
  title: string;
}

interface Catalog {
  version: string;
  categories: CatalogCategory[];
  books: CatalogBook[];
}

interface SearchResult {
  passageId:    string;
  bookId:       string;   // Supabase UUID
  bookTitle:    string;
  authorName:   string;
  chapterLabel: string | null;
  sectionTitle: string | null;
  content:      string;
}

interface LibraryPanelProps {
  activeTab:  NavTab;
  userId:     string;
  onOpenBook: (bookId: string, passageId?: string, highlightQuery?: string) => void;
  onCollapse?: () => void;
}

// Catalog is tiny (75 KB) — cache it for the session so we only fetch once.
const CORPUS_VERSION = '947b54af95c21dd0';
const CATALOG_URL = `https://github.com/shadbakht/immerse-corpus/releases/download/corpus-${CORPUS_VERSION}/catalog.json`;
let _catalogCache: Catalog | null = null;
let _slugMapCache: Map<string, string> | null = null; // slug → Supabase UUID

export default function LibraryPanel({ activeTab, userId, onOpenBook, onCollapse }: LibraryPanelProps) {
  const supabase = createClient();

  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [slugMap, setSlugMap] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  // Expand state
  const [openRoots, setOpenRoots]       = useState<Set<string>>(new Set());
  const [openChildren, setOpenChildren] = useState<Set<string>>(new Set());

  // Checkbox selection (slugs)
  const [selectedSlugs, setSelectedSlugs] = useState<Set<string>>(new Set());

  // Search
  const [searchQuery, setSearchQuery]       = useState('');
  const [searchResults, setSearchResults]   = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading]   = useState(false);
  const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set());
  const [checkedResultIds, setCheckedResultIds] = useState<Set<string>>(new Set());
  const [tagPanelVisible, setTagPanelVisible]   = useState(false);

  // ── Load catalog + slug map ──────────────────────────────────────────────────

  useEffect(() => {
    if (activeTab !== 'library') return;
    loadCatalog();
  }, [activeTab]);

  async function loadCatalog() {
    setLoading(true);
    try {
      // Catalog
      if (!_catalogCache) {
        const res = await fetch(CATALOG_URL);
        _catalogCache = await res.json() as Catalog;
      }

      // Slug → UUID map (book_slug_map table, 527 rows, ~30 KB)
      if (!_slugMapCache) {
        const { data } = await supabase
          .from('book_slug_map')
          .select('local_id, book_id');
        _slugMapCache = new Map((data ?? []).map((r: any) => [r.local_id, r.book_id]));
      }

      setCatalog(_catalogCache);
      setSlugMap(_slugMapCache);
    } catch (err) {
      console.error('[LibraryPanel] Failed to load catalog:', err);
    } finally {
      setLoading(false);
    }
  }

  // Translate a corpus slug to a Supabase UUID for the reader
  function uuidForSlug(slug: string): string {
    return slugMap.get(slug) ?? slug; // fall back to slug if not found
  }

  // ── Tree helpers ─────────────────────────────────────────────────────────────

  const roots = (catalog?.categories ?? [])
    .filter(c => c.parentId === null && c.kind !== 'imported')
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));

  function childrenOf(parentId: string): CatalogCategory[] {
    return (catalog?.categories ?? [])
      .filter(c => c.parentId === parentId)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  }

  function booksInCategory(catId: string): CatalogBook[] {
    return (catalog?.books ?? [])
      .filter(b => b.categoryId === catId)
      .sort((a, b) => a.title.localeCompare(b.title));
  }

  // ── Checkbox helpers ─────────────────────────────────────────────────────────

  function slugsUnderRoot(rootId: string): string[] {
    const direct = booksInCategory(rootId).map(b => b.id);
    const childSlugs = childrenOf(rootId).flatMap(c => booksInCategory(c.id).map(b => b.id));
    return [...direct, ...childSlugs];
  }

  function slugsUnderChild(childId: string): string[] {
    return booksInCategory(childId).map(b => b.id);
  }

  function checkState(slugs: string[]): 'checked' | 'indeterminate' | 'unchecked' {
    if (slugs.length === 0) return 'unchecked';
    const n = slugs.filter(s => selectedSlugs.has(s)).length;
    if (n === slugs.length) return 'checked';
    if (n > 0) return 'indeterminate';
    return 'unchecked';
  }

  function toggleSlugs(slugs: string[]) {
    if (slugs.length === 0) return;
    setSelectedSlugs(prev => {
      const allChecked = slugs.every(s => prev.has(s));
      const next = new Set(prev);
      if (allChecked) slugs.forEach(s => next.delete(s));
      else slugs.forEach(s => next.add(s));
      return next;
    });
  }

  // ── Search ───────────────────────────────────────────────────────────────────

  const SYNONYM_GROUPS = [
    ['god', 'allah', 'lord', 'creator'],
    ['prayer', 'supplication', 'invocation'],
    ['soul', 'spirit', 'self'],
    ['love', 'affection', 'devotion'],
    ['heart', 'mind', 'conscience'],
    ['faith', 'belief', 'trust'],
    ['light', 'radiance', 'illumination'],
    ['truth', 'reality', 'fact'],
    ['peace', 'tranquility', 'serenity'],
    ['unity', 'oneness', 'harmony'],
  ];
  const synonymMap = new Map<string, string[]>();
  for (const group of SYNONYM_GROUPS) {
    for (const word of group) synonymMap.set(word, group);
  }

  function normalize(s: string) {
    return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  }

  function expandSynonyms(q: string): string {
    if (/\b(AND|OR|NOT)\b/.test(q) || q.includes('"') || q.includes('*')) return q;
    return q.trim().split(/\s+/).map(token => {
      const group = synonymMap.get(token.toLowerCase());
      return group ? `(${group.join(' | ')})` : token;
    }).join(' & ');
  }

  // Scope search to Supabase UUIDs of selected slugs
  function selectedUUIDs(): string[] {
    return [...selectedSlugs].map(s => slugMap.get(s)).filter(Boolean) as string[];
  }

  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) { setSearchResults([]); return; }
    const timer = setTimeout(() => doSearch(q), 300);
    return () => clearTimeout(timer);
  }, [searchQuery, selectedSlugs]);

  async function doSearch(q: string) {
    setSearchLoading(true);
    try {
      const scope = selectedSlugs.size > 0 ? selectedUUIDs() : null;
      const results = await runFtsSearch(q, scope);
      setSearchResults(results.length > 0 ? results : await runFuzzySearch(q, scope));
    } finally {
      setSearchLoading(false);
    }
  }

  async function runFtsSearch(q: string, scope: string[] | null): Promise<SearchResult[]> {
    const expanded = expandSynonyms(q);
    const hasOps = /[|&!()"]/.test(expanded);
    const tsQuery = hasOps ? expanded : q.trim().split(/\s+/).filter(Boolean).map(t => `${t}:*`).join(' & ');
    let query = supabase
      .from('passages')
      .select('id, content, chapter_label, section_title, books(id, title, authors(name))')
      .textSearch('content', tsQuery, { type: 'websearch', config: 'english' })
      .limit(40);
    if (scope) query = query.in('book_id', scope);
    const { data } = await query;
    return mapResults(data ?? []);
  }

  async function runFuzzySearch(q: string, scope: string[] | null): Promise<SearchResult[]> {
    const words = q.trim().split(/\s+/).filter(w => w.length >= 2);
    if (words.length === 0) return [];
    let query = supabase
      .from('passages')
      .select('id, content, chapter_label, section_title, books(id, title, authors(name))')
      .ilike('content', `%${words[0]}%`)
      .limit(60);
    if (scope) query = query.in('book_id', scope);
    const { data } = await query;
    const filtered = (data ?? []).filter((p: any) =>
      words.every(w => normalize(p.content).includes(normalize(w)))
    );
    return mapResults(filtered.slice(0, 40));
  }

  function mapResults(data: any[]): SearchResult[] {
    return data.map((p: any) => ({
      passageId:    p.id,
      bookId:       p.books?.id ?? '',
      bookTitle:    p.books?.title ?? '',
      authorName:   p.books?.authors?.name ?? '',
      chapterLabel: p.chapter_label,
      sectionTitle: p.section_title,
      content:      p.content,
    }));
  }

  function getSnippet(content: string, query: string): string {
    const words = query.trim().split(/\s+/).filter(Boolean);
    const normContent = normalize(content);
    let bestIdx = -1;
    for (const w of words) {
      const idx = normContent.indexOf(normalize(w.replace(/[*":]/g, '')));
      if (idx >= 0 && (bestIdx < 0 || idx < bestIdx)) bestIdx = idx;
    }
    if (bestIdx < 0) return content.slice(0, 220);
    const start = Math.max(0, bestIdx - 80);
    const end   = Math.min(content.length, bestIdx + 220);
    return (start > 0 ? '…' : '') + content.slice(start, end) + (end < content.length ? '…' : '');
  }

  function highlightQuery(text: string, query: string) {
    const words = query.trim().split(/\s+/)
      .map(w => w.replace(/[*":()&|]/g, '').trim())
      .filter(w => w.length >= 2);
    if (!words.length) return <span>{text}</span>;
    const normText = normalize(text);
    const ranges: { start: number; end: number }[] = [];
    for (const w of words) {
      const normW = normalize(w);
      let idx = normText.indexOf(normW);
      while (idx >= 0) {
        ranges.push({ start: idx, end: idx + normW.length });
        idx = normText.indexOf(normW, idx + 1);
      }
      const group = synonymMap.get(w.toLowerCase());
      if (group) {
        for (const syn of group) {
          const normSyn = normalize(syn);
          let sidx = normText.indexOf(normSyn);
          while (sidx >= 0) {
            ranges.push({ start: sidx, end: sidx + normSyn.length });
            sidx = normText.indexOf(normSyn, sidx + 1);
          }
        }
      }
    }
    if (!ranges.length) return <span>{text}</span>;
    ranges.sort((a, b) => a.start - b.start);
    const merged = [ranges[0]];
    for (let i = 1; i < ranges.length; i++) {
      const last = merged[merged.length - 1];
      if (ranges[i].start <= last.end) last.end = Math.max(last.end, ranges[i].end);
      else merged.push({ ...ranges[i] });
    }
    const parts: { t: string; hi: boolean }[] = [];
    let pos = 0;
    for (const { start, end } of merged) {
      if (pos < start) parts.push({ t: text.slice(pos, start), hi: false });
      parts.push({ t: text.slice(start, end), hi: true });
      pos = end;
    }
    if (pos < text.length) parts.push({ t: text.slice(pos), hi: false });
    return (
      <>
        {parts.map((p, i) =>
          p.hi
            ? <mark key={i} className="bg-yellow-100 text-yellow-900 font-semibold rounded px-0.5">{p.t}</mark>
            : <span key={i}>{p.t}</span>
        )}
      </>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────────

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
      {/* Header + search */}
      <div className="px-4 pt-4 pb-3 border-b border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900">Library</h2>
          {onCollapse && (
            <button
              onClick={onCollapse}
              className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors text-base"
              title="Collapse Library"
            >
              ‹
            </button>
          )}
        </div>
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={selectedSlugs.size > 0 ? `Search ${selectedSlugs.size} selected book${selectedSlugs.size !== 1 ? 's' : ''}…` : 'Search all books…'}
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

      {/* Body */}
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
                const isChecked  = checkedResultIds.has(result.passageId);
                const snippet    = getSnippet(result.content, searchQuery);
                const location   = result.chapterLabel || result.sectionTitle;
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
                      <div
                        className="flex-1 text-left pr-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
                        onClick={() => setExpandedResults(prev => {
                          const next = new Set(prev);
                          next.has(result.passageId) ? next.delete(result.passageId) : next.add(result.passageId);
                          return next;
                        })}
                      >
                        <p className="text-xs text-[#1B6B7B] font-medium mb-1 truncate">
                          {result.bookTitle}{location ? ` · ${location}` : ''}
                        </p>
                        <p className="text-sm text-gray-700 leading-relaxed">
                          {isExpanded
                            ? highlightQuery(result.content, searchQuery)
                            : highlightQuery(snippet, searchQuery)
                          }
                        </p>
                        {isExpanded && (
                          <button
                            onClick={e => { e.stopPropagation(); onOpenBook(result.bookId, result.passageId, searchQuery.trim()); }}
                            className="mt-2 text-xs text-[#1B6B7B] font-medium hover:underline"
                          >
                            Open in reader →
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* ── Library tree (from catalog.json) ── */
        <div className="flex-1 overflow-y-auto">
          {roots.map(root => {
            const isRootOpen  = openRoots.has(root.id);
            const rootSlugs   = slugsUnderRoot(root.id);
            const rootState   = checkState(rootSlugs);
            const children    = childrenOf(root.id);
            const directBooks = booksInCategory(root.id);
            const totalBooks  = rootSlugs.length;

            return (
              <div key={root.id}>
                {/* Tradition row */}
                <div className="flex items-center border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <Checkbox state={rootState} onChange={() => toggleSlugs(rootSlugs)} className="pl-3 pr-1 py-3.5 shrink-0" />
                  <button
                    onClick={() => setOpenRoots(prev => { const n = new Set(prev); n.has(root.id) ? n.delete(root.id) : n.add(root.id); return n; })}
                    className="flex-1 flex items-center justify-between pr-4 py-3.5 text-left"
                  >
                    <span className="text-sm font-medium text-gray-800">{root.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">{totalBooks}</span>
                      <span className={`text-gray-400 text-xs transition-transform duration-150 inline-block ${isRootOpen ? 'rotate-90' : ''}`}>›</span>
                    </div>
                  </button>
                </div>

                {isRootOpen && (
                  <>
                    {/* Child categories (author / collection) */}
                    {children.map(child => {
                      const isChildOpen  = openChildren.has(child.id);
                      const childSlugs   = slugsUnderChild(child.id);
                      const childState   = checkState(childSlugs);
                      const childBooks   = booksInCategory(child.id);

                      return (
                        <div key={child.id}>
                          <div className="flex items-center border-b border-gray-100 bg-gray-50/50 hover:bg-gray-50 transition-colors">
                            <Checkbox state={childState} onChange={() => toggleSlugs(childSlugs)} className="pl-6 pr-1 py-3 shrink-0" />
                            <button
                              onClick={() => setOpenChildren(prev => { const n = new Set(prev); n.has(child.id) ? n.delete(child.id) : n.add(child.id); return n; })}
                              className="flex-1 flex items-center justify-between pr-4 py-3 text-left"
                            >
                              <span className="text-sm text-gray-700">{child.name}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-400">{childSlugs.length}</span>
                                <span className={`text-gray-400 text-xs transition-transform duration-150 inline-block ${isChildOpen ? 'rotate-90' : ''}`}>›</span>
                              </div>
                            </button>
                          </div>

                          {isChildOpen && childBooks.map(book => {
                            const isChecked = selectedSlugs.has(book.id);
                            return (
                              <div key={book.id} className="flex items-center border-b border-gray-100 hover:bg-gray-50 transition-colors">
                                <Checkbox state={isChecked ? 'checked' : 'unchecked'} onChange={() => toggleSlugs([book.id])} className="pl-9 pr-1 py-3 shrink-0" />
                                <button onClick={() => onOpenBook(uuidForSlug(book.id))} className="flex-1 text-left pr-4 py-3">
                                  <div className="text-sm text-gray-800">{book.title}</div>
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}

                    {/* Books directly under the root (no child category) */}
                    {directBooks.map(book => {
                      const isChecked = selectedSlugs.has(book.id);
                      return (
                        <div key={book.id} className="flex items-center border-b border-gray-100 bg-gray-50/50 hover:bg-gray-50 transition-colors">
                          <Checkbox state={isChecked ? 'checked' : 'unchecked'} onChange={() => toggleSlugs([book.id])} className="pl-6 pr-1 py-3 shrink-0" />
                          <button onClick={() => onOpenBook(uuidForSlug(book.id))} className="flex-1 text-left pr-4 py-3">
                            <div className="text-sm text-gray-800">{book.title}</div>
                          </button>
                        </div>
                      );
                    })}
                  </>
                )}
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
        onSave={async (tagIds: string[]) => {
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
        }}
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
      <div className={`w-[18px] h-[18px] rounded border-2 flex items-center justify-center transition-colors shrink-0 ${
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
