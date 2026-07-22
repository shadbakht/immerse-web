'use client';

import { useEffect, useState, useCallback, useRef, useMemo, Fragment } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { NavTab } from './AppShell';
import TagPanel from './TagPanel';
import { loadCatalog, loadSlugMaps } from '@/lib/catalog';
import { resolveIsPro } from '@/lib/proStatus';
import type { Catalog, CatalogCategory, CatalogBook } from '@/lib/catalog';
import { importBook, removeImportedBook } from '@/lib/bookImportWeb';
import { listLocalBooks, getLocalBook } from '@/lib/importedBooksDb';
import { semanticSearch, reciprocalRankFusion, SEMANTIC_SEARCH_ENABLED } from '@/lib/semanticSearch';
import { useTranslation } from '@/contexts/LanguageProvider';
import { LANGUAGE_LABELS } from '@immerse/i18n';

// Categories whose books have no canonical order and should display
// alphabetically (mirrors the mobile LibraryScreen normalised sort).
// Scripture categories (Bible, Tanakh, Qur'an, GGS, etc.) are left in their
// catalog (canonical) order.
const ALPHA_SORTED_CATEGORIES = new Set([
  'cat-bahai-bahullh',        // Bahá'u'lláh
  'cat-bahai-abdulbah',       // ‘Abdu'l-Bahá
  'cat-bahai-shoghi-effendi', // Shoghi Effendi
]);

// Normalised alphabetical key: strip diacritics and leading punctuation
// (e.g. the curly apostrophe in "‘Abdu'l-Bahá in London") so titles sort by
// their first letter rather than by code point.
const titleSortKey = (s: string): string => (s || '')
  .normalize('NFD')
  .replace(/\p{M}/gu, '')
  .replace(/^[^\p{L}\p{N}]+/u, '')
  .toLowerCase();

interface SearchResult {
  passageId:    string;
  bookId:       string;   // Supabase UUID
  bookTitle:    string;
  authorName:   string;
  chapterLabel: string | null;
  sectionTitle: string | null;
  content:      string;
  semantic?:    boolean;  // meaning-based ("Related") hit
}

interface LibraryPanelProps {
  activeTab:  NavTab;
  userId:     string;
  onOpenBook: (bookId: string, passageId?: string, highlightQuery?: string) => void;
  onCollapse?: () => void;
}

// (Caching is handled by src/lib/catalog.ts)

interface ImportedBook {
  id: string;
  title: string;
}

export default function LibraryPanel({ activeTab, userId, onOpenBook, onCollapse }: LibraryPanelProps) {
  const supabase = createClient();
  const { t } = useTranslation();

  const [catalog, setCatalog]   = useState<Catalog | null>(null);
  const [slugMap, setSlugMap]   = useState<Map<string, string>>(new Map());
  const [loading, setLoading]   = useState(true);
  const [openNodes, setOpenNodes] = useState<Set<string>>(new Set());
  const [selectedSlugs, setSelectedSlugs] = useState<Set<string>>(new Set());

  // Which content language the library is scoped to. Mirrors the mobile scope
  // switcher: books carry a language tag and the tree shows one language at a
  // time. Persisted so a Spanish reader stays in Spanish across sessions.
  const [contentLang, setContentLangState] = useState('en');
  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('immerse:contentLang') : null;
    if (saved) setContentLangState(saved);
  }, []);
  const setContentLang = useCallback((lang: string) => {
    setContentLangState(lang);
    try { localStorage.setItem('immerse:contentLang', lang); } catch { /* ignore */ }
    setOpenNodes(new Set());   // collapse: the previous language's open nodes don't apply
  }, []);

  // My Books
  const [isPro, setIsPro]                 = useState(false);
  const [importedBooks, setImportedBooks] = useState<ImportedBook[]>([]);
  const [myBooksOpen, setMyBooksOpen]     = useState(true);
  const [importing, setImporting]         = useState(false);
  const [importMsg, setImportMsg]         = useState<{ text: string; isError: boolean } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Search
  const [searchQuery,       setSearchQuery]       = useState('');
  const [searchResults,     setSearchResults]     = useState<SearchResult[]>([]);
  const [semanticOn,        setSemanticOn]        = useState(false); // opt-in "Related" (semantic) search
  const [searchLoading,     setSearchLoading]     = useState(false);
  const [expandedResults,   setExpandedResults]   = useState<Set<string>>(new Set());
  const [checkedResultIds,  setCheckedResultIds]  = useState<Set<string>>(new Set());
  const [tagPanelVisible,   setTagPanelVisible]   = useState(false);

  // ── Load ──────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (userId) {
      resolveIsPro(supabase, userId).then(setIsPro);
    }
  }, [userId]);

  useEffect(() => {
    if (activeTab !== 'library') return;
    load();
  }, [activeTab]);

  async function load() {
    setLoading(true);
    try {
      const [cat, { slugToUuid }] = await Promise.all([
        loadCatalog(),
        loadSlugMaps(supabase),
      ]);
      setCatalog(cat);
      setSlugMap(slugToUuid);
      await loadImportedBooks();
    } catch (err) {
      console.error('[LibraryPanel] Failed to load catalog:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadImportedBooks() {
    const rows = await listLocalBooks();
    setImportedBooks(rows.map(r => ({ id: `imported:${r.id}`, title: r.title })));
  }

  // ── Import handlers ───────────────────────────────────────────────────────────

  function handleImportClick() {
    if (!userId) return;
    if (!isPro) {
      setImportMsg({ text: t('library.importProFeature'), isError: false });
      setTimeout(() => setImportMsg(null), 4000);
      return;
    }
    setImportMsg(null);
    fileInputRef.current?.click();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !userId) return;
    e.target.value = '';

    setImporting(true);
    setImportMsg(null);

    const result = await importBook(file);

    setImporting(false);

    if (!result.success) {
      setImportMsg({ text: result.error ?? t('library.importFailed'), isError: true });
    } else {
      setImportMsg({ text: t('library.importSucceeded', { title: result.title ?? '' }), isError: false });
      setTimeout(() => setImportMsg(null), 3000);
      await loadImportedBooks();
    }
  }

  async function handleDeleteBook(bookId: string) {
    await removeImportedBook(bookId);
    setImportedBooks(prev => prev.filter(b => b.id !== bookId));
  }

  // ── Tree helpers ─────────────────────────────────────────────────────────────

  const bookLang = (b: CatalogBook) => b.language ?? 'en';

  // Content languages present in the catalog, English first, then the rest by count.
  const availableLanguages = useMemo(() => {
    const counts = new Map<string, number>();
    for (const b of catalog?.books ?? []) counts.set(bookLang(b), (counts.get(bookLang(b)) ?? 0) + 1);
    return [...counts.keys()].sort((a, b) => (a === 'en' ? -1 : b === 'en' ? 1 : a.localeCompare(b)));
  }, [catalog]);

  // Categories that contain at least one book in the active language, at any
  // depth. Categories are shared across languages, so without this the Spanish
  // scope would still show every empty English branch.
  const inScopeCats = useMemo(() => {
    const withBooks = new Set<string>();
    for (const b of catalog?.books ?? []) if (bookLang(b) === contentLang) withBooks.add(b.categoryId);
    const parentOf = new Map((catalog?.categories ?? []).map(c => [c.id, c.parentId]));
    // Walk each book-bearing category up to the root so ancestors stay visible.
    for (const start of [...withBooks]) {
      let cur: string | null | undefined = start;
      while (cur) { withBooks.add(cur); cur = parentOf.get(cur); }
    }
    return withBooks;
  }, [catalog, contentLang]);

  const childrenOf = useCallback((parentId: string): CatalogCategory[] => {
    return (catalog?.categories ?? [])
      .filter(c => c.parentId === parentId && inScopeCats.has(c.id))
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  }, [catalog, inScopeCats]);

  const booksInCategory = useCallback((catId: string): CatalogBook[] => {
    const books = (catalog?.books ?? []).filter(b => b.categoryId === catId && bookLang(b) === contentLang);
    if (ALPHA_SORTED_CATEGORIES.has(catId)) {
      return [...books].sort((a, b) => {
        const ak = titleSortKey(a.title), bk = titleSortKey(b.title);
        return ak < bk ? -1 : ak > bk ? 1 : 0;
      });
    }
    return books;
  }, [catalog, contentLang]);

  // Recursively collect all book slugs under a category at any depth
  const allSlugsUnder = useCallback((catId: string): string[] => {
    const direct = booksInCategory(catId).map(b => b.id);
    const nested = childrenOf(catId).flatMap(c => allSlugsUnder(c.id));
    return [...direct, ...nested];
  }, [booksInCategory, childrenOf]);

  // ── Checkbox helpers ─────────────────────────────────────────────────────────

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

  function toggleNode(id: string) {
    setOpenNodes(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // ── Recursive tree renderer ───────────────────────────────────────────────────
  // level 0 = root traditions (rendered as top-level section rows)
  // level 1+ = sub-categories and books, indented by level

  function renderChildren(parentId: string, level: number) {
    const children  = childrenOf(parentId);
    const books     = booksInCategory(parentId);
    if (children.length === 0 && books.length === 0) return null;

    // Padding: 12px base + 12px per level for categories; extra 24px for books
    const catPadLeft  = 12 + level * 14;
    const bookPadLeft = catPadLeft; // books at same indent as sibling sub-categories

    return (
      <>
        {books.map(book => {
          const isChecked = selectedSlugs.has(book.id);
          const uuid = slugMap.get(book.id) ?? book.id;
          return (
            <Fragment key={book.id}>
            <div
              className="flex items-center hover:bg-gray-50 dark:hover:bg-[#243040] transition-colors"
              style={{ paddingLeft: bookPadLeft }}
            >
              <Checkbox
                state={isChecked ? 'checked' : 'unchecked'}
                onChange={() => toggleSlugs([book.id])}
                className="pe-1 py-2.5 shrink-0"
              />
              <button
                onClick={() => onOpenBook(uuid)}
                className="flex-1 text-start pe-4 py-2.5 min-w-0"
              >
                <div className="text-sm text-gray-800 dark:text-[#D2DCE8] truncate">{book.title}</div>
              </button>
            </div>
            <Divider id={book.id} />
            </Fragment>
          );
        })}

        {children.map(child => {
          const childSlugs     = allSlugsUnder(child.id);
          const childImmediate = childrenOf(child.id).length + booksInCategory(child.id).length;
          const isOpen         = openNodes.has(child.id);
          const state          = checkState(childSlugs);

          return (
            <div key={child.id}>
              <div
                className="flex items-center hover:bg-gray-50 dark:hover:bg-[#243040] transition-colors"
                style={{ paddingLeft: catPadLeft }}
              >
                <Checkbox
                  state={state}
                  onChange={() => toggleSlugs(childSlugs)}
                  className="pe-1 py-3 shrink-0"
                />
                <button
                  onClick={() => toggleNode(child.id)}
                  className="flex-1 flex items-center justify-between pe-4 py-3 text-start min-w-0"
                >
                  <span className={`truncate ${level === 0 ? 'text-sm font-medium text-gray-800 dark:text-[#D2DCE8]' : 'text-sm text-gray-700 dark:text-[#B8C7D6]'}`}>
                    {child.name}
                  </span>
                  <div className="flex items-center gap-2 shrink-0 ms-2">
                    <span className="text-xs text-gray-400 dark:text-[#5C7A8E]">{childImmediate}</span>
                    <span className={`text-gray-400 dark:text-[#5C7A8E] text-sm transition-transform duration-150 inline-block ${isOpen ? 'rotate-90' : ''}`}>›</span>
                  </div>
                </button>
              </div>
              <Divider id={child.id} />
              {isOpen && (
                <div className={level === 0 ? 'bg-gray-50/30' : ''}>
                  {renderChildren(child.id, level + 1)}
                </div>
              )}
            </div>
          );
        })}
      </>
    );
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

  // Remember the "Related" toggle across sessions.
  useEffect(() => {
    if (typeof window !== 'undefined' && window.localStorage.getItem('search.semanticOn.v1') === '1') {
      setSemanticOn(true);
    }
  }, []);
  function toggleSemantic() {
    setSemanticOn(prev => {
      const next = !prev;
      try { window.localStorage.setItem('search.semanticOn.v1', next ? '1' : '0'); } catch {}
      return next;
    });
  }

  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) { setSearchResults([]); return; }
    const timer = setTimeout(() => doSearch(q), 300);
    return () => clearTimeout(timer);
  }, [searchQuery, selectedSlugs, semanticOn]);

  async function doSearch(q: string) {
    setSearchLoading(true);
    try {
      const importedSelected = [...selectedSlugs].filter(s => s.startsWith('imported:'));
      const regularSlugs     = [...selectedSlugs].filter(s => !s.startsWith('imported:'));
      // Resolve the scope against a freshly-loaded slug map rather than the
      // `slugMap` React state. If the state map is cold/empty, selectedUUIDs()
      // would resolve every selected book to nothing → scope=[] → runFtsSearch
      // early-returns [] and the search silently shows "No results" even though
      // matches exist. loadSlugMaps is module-cached, so this is cheap.
      let regularUUIDs: string[] | null = null;
      if (regularSlugs.length > 0) {
        const { slugToUuid } = await loadSlugMaps(supabase);
        regularUUIDs = regularSlugs.map(s => slugToUuid.get(s)).filter(Boolean) as string[];
      }

      // Remote (Supabase) search: run when no filter, or when regular books are selected.
      // If only imported books are selected, skip remote to avoid empty-IN query.
      let remoteResults: SearchResult[] = [];
      const onlyImportedSelected = selectedSlugs.size > 0 && importedSelected.length === selectedSlugs.size;
      if (!onlyImportedSelected) {
        remoteResults = await runFtsSearch(q, regularUUIDs);
        if (remoteResults.length === 0) remoteResults = await runFuzzySearch(q, regularUUIDs);
      }

      // Local (IndexedDB) search: run when no filter (search all local books),
      // or when My Books / specific imported books are selected.
      const localBookIds = selectedSlugs.size === 0
        ? importedBooks.map(b => b.id)
        : importedSelected;
      const localResults = await searchLocalBooks(q, localBookIds);

      const keyword = [...localResults, ...remoteResults];
      setSearchResults(keyword);
      setSearchLoading(false);

      // Semantic search is opt-in (the "Related" toggle) and whole-library only,
      // so keyword search stays fast/local by default.
      if (!SEMANTIC_SEARCH_ENABLED || !semanticOn || selectedSlugs.size > 0) return;
      const hits = await semanticSearch(supabase, q, undefined, 40);
      if (hits.length === 0) return;
      const semItems: SearchResult[] = hits.map(h => ({
        passageId:    h.passageId,
        bookId:       h.bookId,
        bookTitle:    h.bookTitle,
        authorName:   '',
        chapterLabel: null,
        sectionTitle: null,
        content:      h.snippet,
        semantic:     true,
      }));
      setSearchResults(reciprocalRankFusion([keyword, semItems], r => r.passageId));
    } finally {
      setSearchLoading(false);
    }
  }

  async function searchLocalBooks(q: string, bookIds: string[]): Promise<SearchResult[]> {
    if (bookIds.length === 0) return [];
    const words = q.trim().split(/\s+/).filter(w => w.length >= 2);
    if (words.length === 0) return [];

    const results: SearchResult[] = [];
    await Promise.all(bookIds.map(async bookId => {
      const localId = bookId.startsWith('imported:') ? bookId.slice('imported:'.length) : bookId;
      const record  = await getLocalBook(localId);
      if (!record || record.paragraphs.length === 0) return;
      for (let i = 0; i < record.paragraphs.length; i++) {
        const para = record.paragraphs[i];
        if (words.every(w => normalize(para).includes(normalize(w)))) {
          results.push({
            passageId:    `local-${localId}-${i}`,
            bookId:       `imported:${localId}`,
            bookTitle:    record.title,
            authorName:   '',
            chapterLabel: null,
            sectionTitle: null,
            content:      para,
          });
          if (results.length >= 40) break;
        }
      }
    }));
    return results.slice(0, 40);
  }

  async function runFtsSearch(q: string, scope: string[] | null): Promise<SearchResult[]> {
    // scope=[] means only imported books selected — no remote results needed
    if (scope !== null && scope.length === 0) return [];
    const expanded = expandSynonyms(q);
    const hasOps = /[|&!()"]/.test(expanded);
    const tsQuery = hasOps ? expanded : q.trim().split(/\s+/).filter(Boolean).map(t => `${t}:*`).join(' & ');
    // Routed through the search_passages RPC rather than a direct
    // .textSearch(...).limit(40): the LIMIT made the planner pick a Seq Scan
    // over ~250k rows for rare terms (~7s → anon statement timeout). The RPC
    // pins enable_seqscan=off so the GIN index is used (~0.2s). It applies the
    // same websearch_to_tsquery + 40-row cap and the same visibility rule, so
    // results are unchanged.
    const { data } = await supabase
      .rpc('search_passages', {
        search_query: tsQuery,
        book_scope: scope && scope.length > 0 ? scope : null,
      })
      .select('id, content, chapter_label, section_title, books(id, title, authors(name))');
    // supabase types .rpc().select() as object|array; the RPC returns rows and
    // mapResults handles the array. Cast keeps `next build` type-checking (the
    // union broke it since the search_passages rewiring).
    return mapResults((data as any[]) ?? []);
  }

  async function runFuzzySearch(q: string, scope: string[] | null): Promise<SearchResult[]> {
    if (scope !== null && scope.length === 0) return [];
    const words = q.trim().split(/\s+/).filter(w => w.length >= 2);
    if (words.length === 0) return [];
    let query = supabase
      .from('passages')
      .select('id, content, chapter_label, section_title, books(id, title, authors(name))')
      .ilike('content', `%${words[0]}%`)
      .limit(60);
    if (scope && scope.length > 0) query = query.in('book_id', scope);
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
      while (idx >= 0) { ranges.push({ start: idx, end: idx + normW.length }); idx = normText.indexOf(normW, idx + 1); }
      const group = synonymMap.get(w.toLowerCase());
      if (group) {
        for (const syn of group) {
          const normSyn = normalize(syn);
          let sidx = normText.indexOf(normSyn);
          while (sidx >= 0) { ranges.push({ start: sidx, end: sidx + normSyn.length }); sidx = normText.indexOf(normSyn, sidx + 1); }
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
      <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-[#5C7A8E] text-sm">
        {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} — coming soon
      </div>
    );
  }

  const isSearching = searchQuery.trim().length > 0;

  // Root traditions (parentId = null, not imported), scoped to the active language.
  const roots = (catalog?.categories ?? [])
    .filter(c => c.parentId === null && c.kind !== 'imported' && inScopeCats.has(c.id))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));

  // Depth-aware dividers (match the Tags/mobile-Library treatment): a full-width
  // line only BETWEEN top-level categories; sub-levels get a line inset to the
  // next row's indentation; none after the last visible row. Built by flattening
  // the currently-expanded tree so the lookahead crosses subtree boundaries.
  const dividerInset = useMemo(() => {
    const rows: { id: string; level: number }[] = [];
    const walk = (parentId: string, level: number) => {
      for (const b of booksInCategory(parentId)) rows.push({ id: b.id, level });
      for (const c of childrenOf(parentId)) {
        rows.push({ id: c.id, level });
        if (openNodes.has(c.id)) walk(c.id, level + 1);
      }
    };
    for (const root of roots) {
      rows.push({ id: root.id, level: 0 });
      if (openNodes.has(root.id)) walk(root.id, 1);
    }
    const map = new Map<string, number | null>();
    for (let i = 0; i < rows.length; i++) {
      const next = rows[i + 1];
      map.set(rows[i].id, !next ? null : next.level === 0 ? 0 : 12 + next.level * 14);
    }
    return map;
  }, [roots, openNodes, childrenOf, booksInCategory]);

  const Divider = ({ id }: { id: string }) => {
    const inset = dividerInset.get(id);
    if (inset == null) return null;
    return <div className="h-px bg-gray-100 dark:bg-[#2D4050]" style={inset > 0 ? { marginLeft: inset } : undefined} />;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,.epub,.docx,.rtf,.pdf"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Header + search */}
      <div className="px-4 pt-4 pb-3 border-b border-gray-100 dark:border-[#2D4050]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-[#E2EAF2]">{t('library.title')}</h2>
            {/* The active language always reads out, and sits in its own pill:
                a bare chevron on the heading looked like decoration, so nobody
                found the switcher. */}
            {availableLanguages.length > 1 && (
              <label className="relative inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-gray-200 dark:border-[#2D4050] bg-gray-50 dark:bg-[#243040] text-xs font-medium text-gray-600 dark:text-[#8FA4B8] cursor-pointer hover:border-[#1B6B7B] hover:text-[#1B6B7B] dark:hover:border-[#2D9DB3] dark:hover:text-[#2D9DB3] transition-colors">
                {LANGUAGE_LABELS[contentLang] ?? contentLang}
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
                </svg>
                <select
                  aria-label={t('library.languageSheetTitle')}
                  value={contentLang}
                  onChange={e => setContentLang(e.target.value)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                >
                  {availableLanguages.map(l => (
                    <option key={l} value={l}>{LANGUAGE_LABELS[l] ?? l}</option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {userId && (
              <button
                onClick={handleImportClick}
                title={t('library.importTitle')}
                disabled={importing}
                className="w-7 h-7 flex items-center justify-center text-[#1B6B7B] dark:text-[#2D9DB3] hover:text-[#145860] bg-[#1B6B7B]/10 dark:bg-[#2D9DB3]/10 hover:bg-[#1B6B7B]/20 dark:hover:bg-[#2D9DB3]/20 rounded-lg transition-colors disabled:opacity-50"
              >
                {importing ? (
                  <div className="w-3.5 h-3.5 border-2 border-[#1B6B7B] dark:border-[#2D9DB3] border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 3V14M5 9l5 5 5-5" />
                    <path d="M3 17h14" />
                  </svg>
                )}
              </button>
            )}
            {onCollapse && (
              <button
                onClick={onCollapse}
                className="w-7 h-7 flex items-center justify-center text-[#1B6B7B] dark:text-[#2D9DB3] hover:text-[#145860] bg-[#1B6B7B]/10 dark:bg-[#2D9DB3]/10 hover:bg-[#1B6B7B]/20 dark:hover:bg-[#2D9DB3]/20 rounded-lg transition-colors text-base"
                title={t('common.collapseLibrary')}
              >
                ‹
              </button>
            )}
          </div>
        </div>
        {importMsg && (
          <p className={`text-xs mb-2 px-1 ${importMsg.isError ? 'text-red-600' : 'text-[#1B6B7B] dark:text-[#2D9DB3]'}`}>
            {importMsg.text}
          </p>
        )}

        <div className="relative">
          <svg className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-[#5C7A8E] w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={selectedSlugs.size > 0 ? t('library.searchSelected', { count: selectedSlugs.size }) : t('library.searchAll')}
            className="w-full ps-9 pe-14 py-2 text-sm text-gray-900 dark:text-[#E2EAF2] border border-gray-200 dark:border-[#2D4050] rounded-xl outline-none focus:ring-2 focus:ring-[#1B6B7B]/30 dark:focus:ring-[#2D9DB3]/30 focus:border-[#1B6B7B] dark:focus:border-[#2D9DB3] bg-gray-50 dark:bg-[#243040]"
          />
          {(searchQuery || selectedSlugs.size > 0 || checkedResultIds.size > 0) && (
            <button
              onClick={() => { setSearchQuery(''); setSearchResults([]); setSelectedSlugs(new Set()); setCheckedResultIds(new Set()); }}
              className="absolute end-3 top-1/2 -translate-y-1/2 text-xs font-medium text-[#1B6B7B] dark:text-[#2D9DB3] hover:text-[#0f4a56]"
            >{t('common.clear')}</button>
          )}
        </div>
        {SEMANTIC_SEARCH_ENABLED && searchQuery.trim() && selectedSlugs.size === 0 && (
          <button
            onClick={toggleSemantic}
            className={`mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full border transition-colors ${
              semanticOn
                ? 'border-[#1B6B7B] dark:border-[#2D9DB3] text-[#1B6B7B] dark:text-[#2D9DB3] bg-[#1B6B7B]/8 dark:bg-[#2D9DB3]/10'
                : 'border-gray-200 dark:border-[#2D4050] text-gray-400 dark:text-[#5C7A8E]'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
            {t('library.relatedPassages')}{semanticOn ? ` · ${t('library.relatedOn')}` : ''}
          </button>
        )}
      </div>

      {/* Body */}
      {loading && !isSearching ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-[#1B6B7B] dark:border-[#2D9DB3] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : isSearching ? (
        /* ── Search results ── */
        <div className="flex-1 overflow-y-auto">
          {searchLoading ? (
            <div className="flex justify-center py-10">
              <div className="w-5 h-5 border-2 border-[#1B6B7B] dark:border-[#2D9DB3] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : searchResults.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-[#5C7A8E] text-center py-10">{t('library.noResultsFor', { query: searchQuery })}</p>
          ) : (
            <div>
              <p className="text-xs text-gray-400 dark:text-[#5C7A8E] px-4 py-2">{t('library.result', { count: searchResults.length })}</p>
              {searchResults.map(result => {
                const isExpanded = expandedResults.has(result.passageId);
                const isChecked  = checkedResultIds.has(result.passageId);
                const snippet    = getSnippet(result.content, searchQuery);
                const location   = result.chapterLabel || result.sectionTitle;
                return (
                  <div key={result.passageId} className={`border-b border-gray-100 dark:border-[#2D4050] ${isChecked ? 'bg-[#1B6B7B]/5 dark:bg-[#2D9DB3]/5' : ''}`}>
                    <div className="flex items-start">
                      <Checkbox
                        state={isChecked ? 'checked' : 'unchecked'}
                        onChange={() => setCheckedResultIds(prev => { const n = new Set(prev); n.has(result.passageId) ? n.delete(result.passageId) : n.add(result.passageId); return n; })}
                        className="ps-3 pe-1 pt-3.5 shrink-0"
                      />
                      <div
                        className="flex-1 text-start pe-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-[#243040] transition-colors"
                        onClick={() => setExpandedResults(prev => { const n = new Set(prev); n.has(result.passageId) ? n.delete(result.passageId) : n.add(result.passageId); return n; })}
                      >
                        <p className="text-xs text-[#1B6B7B] dark:text-[#2D9DB3] font-medium mb-1 truncate">
                          {result.semantic ? `${t('library.relatedPrefix')} · ` : ''}{result.bookTitle}{location ? ` · ${location}` : ''}
                        </p>
                        <p className="font-serif text-gray-700 dark:text-[#B8C7D6] leading-relaxed" style={{ fontSize: 'var(--quote-font-size)' }}>
                          {isExpanded ? highlightQuery(result.content, searchQuery) : highlightQuery(snippet, searchQuery)}
                        </p>
                        {isExpanded && (
                          <button
                            onClick={e => { e.stopPropagation(); onOpenBook(result.bookId, result.passageId, searchQuery.trim()); }}
                            className="mt-2 text-xs text-[#1B6B7B] dark:text-[#2D9DB3] font-medium hover:underline"
                          >
                            {t('common.openInReader')} →
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
        /* ── Library tree ── */
        <div className="flex-1 overflow-y-auto">
          {roots.map(root => {
            const rootSlugs    = allSlugsUnder(root.id);
            const immediateCount = childrenOf(root.id).length + booksInCategory(root.id).length;
            const isOpen    = openNodes.has(root.id);
            const state     = checkState(rootSlugs);

            return (
              <div key={root.id}>
                <div className="flex items-center hover:bg-gray-50 dark:hover:bg-[#243040] transition-colors">
                  <Checkbox state={state} onChange={() => toggleSlugs(rootSlugs)} className="ps-3 pe-1 py-3.5 shrink-0" />
                  <button
                    onClick={() => toggleNode(root.id)}
                    className="flex-1 flex items-center justify-between pe-4 py-3.5 text-start min-w-0"
                  >
                    <span className="text-sm font-medium text-gray-800 dark:text-[#D2DCE8] truncate">{root.name}</span>
                    <div className="flex items-center gap-2 shrink-0 ms-2">
                      <span className="text-xs text-gray-400 dark:text-[#5C7A8E]">{immediateCount}</span>
                      <span className={`text-gray-400 dark:text-[#5C7A8E] text-sm transition-transform duration-150 inline-block ${isOpen ? 'rotate-90' : ''}`}>›</span>
                    </div>
                  </button>
                </div>
                <Divider id={root.id} />
                {isOpen && renderChildren(root.id, 1)}
              </div>
            );
          })}

          {/* ── My Books ── */}
          {(importedBooks.length > 0 || (userId && isPro)) && (
            <div className="border-t border-gray-200 dark:border-[#2D4050] mt-1">
              <div className="flex items-center border-b border-gray-100 dark:border-[#2D4050] hover:bg-gray-50 dark:hover:bg-[#243040] transition-colors">
                <Checkbox
                  state={checkState(importedBooks.map(b => b.id))}
                  onChange={() => toggleSlugs(importedBooks.map(b => b.id))}
                  className="ps-3 pe-1 py-3.5 shrink-0"
                />
                <button
                  onClick={() => setMyBooksOpen(v => !v)}
                  className="flex-1 flex items-center justify-between pe-4 py-3.5 text-start min-w-0"
                >
                  <span className="text-sm font-medium text-gray-800 dark:text-[#D2DCE8] truncate">{t('library.myBooks')}</span>
                  <div className="flex items-center gap-2 shrink-0 ms-2">
                    {importedBooks.length > 0 && (
                      <span className="text-xs text-gray-400 dark:text-[#5C7A8E]">{importedBooks.length}</span>
                    )}
                    <span className={`text-gray-400 dark:text-[#5C7A8E] text-sm transition-transform duration-150 inline-block ${myBooksOpen ? 'rotate-90' : ''}`}>›</span>
                  </div>
                </button>
              </div>
              {myBooksOpen && (
                <div className="bg-gray-50/30">
                  {importedBooks.length === 0 ? (
                    <p className="text-xs text-gray-400 dark:text-[#5C7A8E] ps-9 pe-4 py-3">
                      {t('library.noImportedBooks')}
                    </p>
                  ) : (
                    importedBooks.map(book => (
                      <ImportedBookRow
                        key={book.id}
                        book={book}
                        onOpen={() => onOpenBook(book.id)}
                        onDelete={() => handleDeleteBook(book.id)}
                      />
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tag action bar */}
      {checkedResultIds.size > 0 && (
        <div className="border-t border-gray-200 dark:border-[#2D4050] px-4 py-3 bg-white dark:bg-[#1B2A38] flex items-center justify-between gap-3 shrink-0">
          <button onClick={() => setCheckedResultIds(new Set())} className="text-sm text-gray-500 dark:text-[#8FA4B8] hover:text-gray-700 dark:hover:text-[#B8C7D6] transition-colors">{t('common.cancel')}</button>
          <button
            onClick={() => setTagPanelVisible(true)}
            className="flex-1 bg-[#1B6B7B] dark:bg-[#2D9DB3] text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-[#155a68] dark:hover:bg-[#2589A0] transition-colors"
          >
            {t('library.tagAction')} ({checkedResultIds.size})
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
          for (const result of searchResults.filter(r => checkedResultIds.has(r.passageId))) {
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

// ── ImportedBookRow ───────────────────────────────────────────────────────────

function ImportedBookRow({ book, onOpen, onDelete }: {
  book: { id: string; title: string };
  onOpen: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (confirmDelete) {
    return (
      <div className="flex items-center border-b border-gray-100 dark:border-[#2D4050] px-4 py-2.5 bg-red-50/60">
        <span className="text-xs text-gray-600 dark:text-[#8FA4B8] flex-1 truncate pe-2">{t('library.deleteBookConfirm', { title: book.title })}</span>
        <button
          onClick={() => { setConfirmDelete(false); onDelete(); }}
          className="text-xs text-red-600 font-medium hover:text-red-700 me-3 shrink-0"
        >
          {t('common.delete')}
        </button>
        <button
          onClick={() => setConfirmDelete(false)}
          className="text-xs text-gray-500 dark:text-[#8FA4B8] hover:text-gray-700 dark:hover:text-[#B8C7D6] shrink-0"
        >
          {t('common.cancel')}
        </button>
      </div>
    );
  }

  return (
    <div
      className="flex items-center border-b border-gray-100 dark:border-[#2D4050] hover:bg-gray-50 dark:hover:bg-[#243040] transition-colors group"
      style={{ paddingLeft: 36 }}
    >
      <button onClick={onOpen} className="flex-1 text-start py-2.5 min-w-0 pe-2">
        <div className="text-sm text-gray-800 dark:text-[#D2DCE8] truncate">{book.title}</div>
      </button>
      <button
        onClick={() => setConfirmDelete(true)}
        title={t('common.delete')}
        className="opacity-0 group-hover:opacity-100 shrink-0 p-1.5 text-gray-400 dark:text-[#5C7A8E] hover:text-red-500 transition-all me-1"
      >
        <svg width="13" height="13" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M9 3h2a1 1 0 0 1 1 1v1H8V4a1 1 0 0 1 1-1zm4 2V4a3 3 0 0 0-3-3H9a3 3 0 0 0-3 3v1H4a1 1 0 0 0 0 2h.1l.9 10.1A2 2 0 0 0 7 19h6a2 2 0 0 0 2-1.9L15.9 7H16a1 1 0 0 0 0-2h-3z" clipRule="evenodd" />
        </svg>
      </button>
    </div>
  );
}

// ── Checkbox ──────────────────────────────────────────────────────────────────

function Checkbox({ state, onChange, className }: {
  state: 'checked' | 'indeterminate' | 'unchecked';
  onChange: () => void;
  className?: string;
}) {
  return (
    <button onClick={e => { e.stopPropagation(); onChange(); }} className={`flex items-center justify-center ${className}`}>
      <div className={`w-[18px] h-[18px] rounded border-2 flex items-center justify-center transition-colors shrink-0 ${
        state === 'checked'       ? 'bg-[#1B6B7B] dark:bg-[#2D9DB3] border-[#1B6B7B] dark:border-[#2D9DB3]' :
        state === 'indeterminate' ? 'border-[#1B6B7B] dark:border-[#2D9DB3]' : 'border-gray-300 dark:border-[#3A4D60]'
      }`}>
        {state === 'checked'       && <span className="text-white text-[10px] leading-none font-bold">✓</span>}
        {state === 'indeterminate' && <div className="w-2 h-0.5 bg-[#1B6B7B] dark:bg-[#2D9DB3] rounded-full" />}
      </div>
    </button>
  );
}
