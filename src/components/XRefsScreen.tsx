'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { fetchSelectionsByUser } from '@/lib/fetchAnnotationSelections';
import { pushXref, deleteRemote } from '@/lib/annotationSync';
import { ContextMenu, type MenuOption } from './ContextMenu';
import { loadCatalog, loadSlugMaps, type CatalogCategory, type CatalogBook } from '@/lib/catalog';
import { useTranslation } from '@/contexts/LanguageProvider';
import type { TranslationKey, TranslateVars } from '@immerse/i18n';

interface XRefRow {
  id:           string;
  label:        string | null;
  createdAt:    string;
  selectionAId: string;
  selectionBId: string;
  snapshotA:  string; citationA:  string; bookIdA:  string; passageIdA: string;
  snapshotB:  string; citationB:  string; bookIdB:  string; passageIdB: string;
  pairKey:    string;  // sorted tradId1+'↔'+tradId2
  pairName:   string;  // "Bahá'í ↔ Christianity"
}

interface XRefsScreenProps {
  userId: string;
  onOpenBook: (bookId: string, passageId?: string) => void;
}

function Highlight({ text, q }: { text: string; q: string }) {
  if (!q.trim()) return <>{text}</>;
  const pat = new RegExp(`(${q.trim().split(/\s+/).map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
  return <>{text.split(pat).map((p, i) => pat.test(p) ? <mark key={i} className="bg-yellow-100 text-yellow-900 rounded px-0.5">{p}</mark> : <span key={i}>{p}</span>)}</>;
}

// Module-level, so the locale has to be handed in rather than hooked for.
function formatDate(
  iso: string,
  t: (key: TranslationKey, vars?: TranslateVars) => string,
  uiLanguage: string,
) {
  const d = new Date(iso), diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 3600)   return t('common.minutesAgo', { count: Math.floor(diff / 60) });
  if (diff < 86400)  return t('common.hoursAgo',   { count: Math.floor(diff / 3600) });
  if (diff < 604800) return t('common.daysAgo',    { count: Math.floor(diff / 86400) });
  // Month names follow the UI language, not the browser's, so the row reads
  // in one language.
  return d.toLocaleDateString(uiLanguage, { month: 'short', day: 'numeric' });
}

function XRefCard({
  row, searchQuery, onOpenBook, onDelete, onLabelSave,
}: {
  row: XRefRow;
  searchQuery: string;
  onOpenBook: (b: string, p?: string) => void;
  onDelete: (id: string) => void;
  onLabelSave: (id: string, label: string | null) => void;
}) {
  const { t, uiLanguage }           = useTranslation();
  const [expanded, setExpanded]     = useState(false);
  const [editing, setEditing]       = useState(false);
  const [draftLabel, setDraftLabel] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  function startEdit() {
    setDraftLabel(row.label ?? '');
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 30);
  }

  function commitEdit() {
    if (!editing) return;
    setEditing(false);
    const trimmed = draftLabel.trim() || null;
    onLabelSave(row.id, trimmed);
  }

  const sides = [
    { key: 'a', snapshot: row.snapshotA, citation: row.citationA, bookId: row.bookIdA, passageId: row.passageIdA },
    { key: 'b', snapshot: row.snapshotB, citation: row.citationB, bookId: row.bookIdB, passageId: row.passageIdB },
  ];

  const menuOptions: MenuOption[] = [
    { label: t('common.delete'), icon: '🗑️', color: 'danger', onClick: () => { if (confirm(t('xrefs.deleteConfirm'))) onDelete(row.id); } },
  ];

  return (
    <div className="px-4 py-1.5">
    <div className="flex rounded-xl border border-gray-200 dark:border-[#2D4050] bg-white dark:bg-[#1B2A38] overflow-hidden">
      <div className="w-1 shrink-0 bg-[#5A9460] dark:bg-[#6BB073]" aria-hidden />
      <div className="flex-1 min-w-0">
      {/* Label row */}
      <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-gray-100 dark:border-[#2D4050]">
        {editing ? (
          <input
            ref={inputRef}
            value={draftLabel}
            onChange={e => setDraftLabel(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commitEdit(); } if (e.key === 'Escape') { setEditing(false); } }}
            placeholder={t('xrefs.addLabel')}
            className="flex-1 text-sm font-semibold text-[#1B6B7B] dark:text-[#2D9DB3] outline-none bg-transparent border-b border-[#1B6B7B]/40 dark:border-[#2D9DB3]/40 pb-0.5 placeholder:text-gray-400 dark:text-[#5C7A8E] placeholder:font-normal"
          />
        ) : row.label ? (
          <button onClick={startEdit} className="flex-1 text-sm font-semibold text-[#1B6B7B] dark:text-[#2D9DB3] text-left hover:opacity-70 transition-opacity truncate">
            {row.label}
          </button>
        ) : (
          <button onClick={startEdit} className="flex-1 text-sm text-gray-400 dark:text-[#5C7A8E] text-left hover:text-gray-500 dark:hover:text-[#8FA4B8] transition-colors">
            {t('xrefs.addLabel')}
          </button>
        )}
        <p className="text-xs text-gray-300 dark:text-[#4A6478] shrink-0">{formatDate(row.createdAt, t, uiLanguage)}</p>
        <div onClick={e => e.stopPropagation()}>
          <ContextMenu options={menuOptions} />
        </div>
      </div>

      {/* Two quotes side by side */}
      <div
        className="grid grid-cols-2 divide-x divide-gray-100 dark:divide-[#2D4050] cursor-pointer select-none hover:bg-gray-50 dark:hover:bg-[#243040] transition-colors"
        onClick={() => setExpanded(v => !v)}
      >
        {sides.map(side => (
          <div key={side.key} className="px-4 py-4 flex flex-col gap-2">
            <p className={`font-serif text-gray-700 dark:text-[#B8C7D6] leading-relaxed ${expanded ? '' : 'line-clamp-3'}`} style={{ fontSize: 'var(--quote-font-size)' }}>
              "<Highlight text={side.snapshot} q={searchQuery} />"
            </p>
            <p className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-[#5C7A8E] leading-snug">
              <Highlight text={side.citation} q={searchQuery} />
            </p>
            {expanded && side.bookId && (
              <button
                onClick={e => { e.stopPropagation(); onOpenBook(side.bookId, side.passageId); }}
                className="text-xs text-[#1B6B7B] dark:text-[#2D9DB3] font-medium hover:underline text-left"
              >
                {t('common.openInReader')} →
              </button>
            )}
          </div>
        ))}
      </div>
      </div>
    </div>
    </div>
  );
}

export default function XRefsScreen({ userId, onOpenBook }: XRefsScreenProps) {
  const supabase = createClient();
  const { t } = useTranslation();
  const [rows, setRows]               = useState<XRefRow[]>([]);
  const [loading, setLoading]         = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [openPairKeys, setOpenPairKeys] = useState<Set<string>>(new Set());

  useEffect(() => { if (userId) load(); }, [userId]);

  const loadRef = useRef(load);
  useEffect(() => { loadRef.current = load; });

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`xrefs-live-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'xrefs', filter: `user_id=eq.${userId}` },
        () => { loadRef.current().catch(() => {}); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  async function load() {
    setLoading(true);
    try {
      const [{ data: xrefData }, selMap, catalog, { uuidToSlug }] = await Promise.all([
        supabase.from('xrefs').select('id, created_at, selection_a_id, selection_b_id, label').eq('user_id', userId).order('created_at', { ascending: false }),
        fetchSelectionsByUser(userId),
        loadCatalog(),
        loadSlugMaps(supabase),
      ]);

      const catMap  = new Map<string, CatalogCategory>(catalog.categories.map(c => [c.id, c]));
      const bookMap = new Map<string, CatalogBook>(catalog.books.map(b => [b.id, b]));

      const getRootCat = (catId: string): CatalogCategory | null => {
        let c = catMap.get(catId);
        while (c?.parentId) c = catMap.get(c.parentId) ?? undefined as any;
        return c ?? null;
      };

      const getTradition = (bookUuid: string): { id: string; name: string } => {
        const slug    = uuidToSlug.get(bookUuid) ?? '';
        const catBook = slug ? bookMap.get(slug) : null;
        const root    = catBook ? getRootCat(catBook.categoryId) : null;
        return { id: root?.id ?? bookUuid, name: root?.name ?? t('common.otherTradition') };
      };

      function getSel(id: string) {
        const s = selMap[id] ?? { snapshot_text: '', citation: '', passage_id: '', book_id: '' };
        return { snapshot: s.snapshot_text, citation: s.citation, bookId: s.book_id, passageId: s.passage_id };
      }

      const loaded: XRefRow[] = (xrefData ?? []).map((x: any) => {
        const a    = getSel(x.selection_a_id);
        const b    = getSel(x.selection_b_id);
        const tradA = getTradition(a.bookId);
        const tradB = getTradition(b.bookId);

        // Normalize pair: sort by name for consistent key
        const [nameFirst, nameSecond] = [tradA.name, tradB.name].sort();
        const [idFirst,   idSecond]   = tradA.name <= tradB.name
          ? [tradA.id, tradB.id]
          : [tradB.id, tradA.id];

        return {
          id:           x.id,
          label:        x.label ?? null,
          createdAt:    x.created_at,
          selectionAId: x.selection_a_id,
          selectionBId: x.selection_b_id,
          snapshotA: a.snapshot,  citationA:  a.citation,  bookIdA:  a.bookId,  passageIdA: a.passageId,
          snapshotB: b.snapshot,  citationB:  b.citation,  bookIdB:  b.bookId,  passageIdB: b.passageId,
          pairKey:  `${idFirst}↔${idSecond}`,
          pairName: nameFirst === nameSecond ? `${nameFirst} ↔ ${nameFirst}` : `${nameFirst} ↔ ${nameSecond}`,
        };
      });
      setRows(loaded);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    await deleteRemote('xrefs', id).catch(() => {});
    setRows(prev => prev.filter(r => r.id !== id));
  }

  async function handleLabelSave(id: string, label: string | null) {
    setRows(prev => prev.map(r => r.id === id ? { ...r, label } : r));
    const row = rows.find(r => r.id === id);
    if (!row) return;
    await pushXref({
      id,
      user_id:        userId,
      selection_a_id: row.selectionAId,
      selection_b_id: row.selectionBId,
      label,
    }).catch(() => {});
  }

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r =>
      r.snapshotA.toLowerCase().includes(q) || r.snapshotB.toLowerCase().includes(q) ||
      r.citationA.toLowerCase().includes(q) || r.citationB.toLowerCase().includes(q) ||
      (r.label ?? '').toLowerCase().includes(q),
    );
  }, [rows, searchQuery]);

  const hierarchy = useMemo(() => {
    type PairEntry = { name: string; xrefs: XRefRow[] };
    const pairMap = new Map<string, PairEntry>();

    for (const row of filtered) {
      let pair = pairMap.get(row.pairKey);
      if (!pair) { pair = { name: row.pairName, xrefs: [] }; pairMap.set(row.pairKey, pair); }
      pair.xrefs.push(row);
    }

    for (const pair of pairMap.values()) {
      pair.xrefs.sort((a, b) => {
        const la = a.label?.trim() || null;
        const lb = b.label?.trim() || null;
        if (la && lb) return la.localeCompare(lb);
        if (la)       return -1;
        if (lb)       return  1;
        return b.createdAt.localeCompare(a.createdAt);
      });
    }

    return [...pairMap.entries()]
      .sort(([, a], [, b]) =>
        b.xrefs.length !== a.xrefs.length
          ? b.xrefs.length - a.xrefs.length
          : a.name.localeCompare(b.name),
      )
      .map(([pairKey, pair]) => ({ pairKey, ...pair }));
  }, [filtered]);

  const togglePair = (pairKey: string) =>
    setOpenPairKeys(prev => { const next = new Set(prev); next.has(pairKey) ? next.delete(pairKey) : next.add(pairKey); return next; });

  return (
    <div className="h-full flex flex-col max-w-2xl mx-auto w-full">
      {/* Header + search */}
      <div className="px-4 pt-4 pb-3 border-b border-gray-100 dark:border-[#2D4050] shrink-0">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-[#E2EAF2] mb-3">{t('xrefs.title')}</h1>
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-[#5C7A8E] w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={t('xrefs.searchPlaceholder')}
            className="w-full pl-9 pr-14 py-2 text-sm text-gray-900 dark:text-[#E2EAF2] border border-gray-200 dark:border-[#2D4050] rounded-xl outline-none focus:ring-2 focus:ring-[#1B6B7B]/30 dark:focus:ring-[#2D9DB3]/30 focus:border-[#1B6B7B] dark:focus:border-[#2D9DB3] bg-gray-50 dark:bg-[#243040]"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-[#1B6B7B] dark:text-[#2D9DB3] hover:text-[#0f4a56]">{t('common.clear')}</button>
          )}
        </div>
      </div>

      {/* Hierarchy list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-6 h-6 border-2 border-[#1B6B7B] dark:border-[#2D9DB3] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : hierarchy.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-[#5C7A8E] text-center py-16 px-6">
            {searchQuery ? t('xrefs.noMatch') : t('xrefs.empty')}
          </p>
        ) : (
          <div>
            {hierarchy.map((pair, pi) => {
              const isOpen = openPairKeys.has(pair.pairKey);
              return (
                <div key={pair.pairKey}>
                  {/* Full-width divider between top-level pairs */}
                  {pi > 0 && <div className="bg-gray-100 dark:bg-[#2D4050]" style={{ height: 1 }} />}
                  {/* Pair header */}
                  <button
                    className="w-full flex items-center gap-2 px-4 py-3.5 hover:bg-gray-50 dark:hover:bg-[#243040] transition-colors text-left select-none"
                    onClick={() => togglePair(pair.pairKey)}
                  >
                    <span className="flex-1 text-sm font-medium text-gray-800 dark:text-[#D2DCE8]">{pair.name}</span>
                    <span className="text-xs text-gray-400 dark:text-[#5C7A8E] shrink-0">{pair.xrefs.length}</span>
                    <span className={`text-gray-400 dark:text-[#5C7A8E] text-sm shrink-0 transition-transform duration-150 inline-block ${isOpen ? 'rotate-90' : ''}`}>›</span>
                  </button>

                  {isOpen && (
                    <div>
                      {pair.xrefs.map(row => (
                        <XRefCard
                          key={row.id}
                          row={row}
                          searchQuery={searchQuery}
                          onOpenBook={onOpenBook}
                          onDelete={handleDelete}
                          onLabelSave={handleLabelSave}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
