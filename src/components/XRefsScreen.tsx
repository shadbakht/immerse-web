'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { fetchSelectionsByUser } from '@/lib/fetchAnnotationSelections';
import { pushXref, deleteRemote } from '@/lib/annotationSync';
import { ContextMenu, type MenuOption } from './ContextMenu';
import { loadCatalog, loadSlugMaps, type CatalogBook } from '@/lib/catalog';
import { makeTraditionResolver } from '@/lib/tradition';
import { useTranslation } from '@/contexts/LanguageProvider';
import type { TranslationKey, TranslateVars } from '@immerse/i18n';
import { groupXrefsByPair } from '@/lib/xrefGrouping';
import { exportAsDocx, exportAsPdf, exportAsCsv, exportAsMarkdown, type XRefExportRow } from '@/lib/xrefExport';
import {
  traditionPairOf,
  pruneDeletedXrefsFromShares,
  createXrefShareLink,
  findXrefShareForSelection,
  revokeSharedSet,
} from '@/lib/sharedSets';

interface XRefRow {
  id:           string;
  label:        string | null;
  createdAt:    string;
  selectionAId: string;
  selectionBId: string;
  snapshotA:  string; citationA:  string; bookIdA:  string; passageIdA: string;
  snapshotB:  string; citationB:  string; bookIdB:  string; passageIdB: string;
  bookTitleA: string;
  bookTitleB: string;
  pairKey:    string;  // sorted tradId1+'↔'+tradId2
  pairName:   string;  // "Bahá'í ↔ Christianity"
}

interface XRefsScreenProps {
  userId: string;
  onOpenBook: (bookId: string, passageId?: string, passageSnapshot?: string) => void;
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
  row, searchQuery, onOpenBook, onDelete, onLabelSave, selected, onToggleSelected,
}: {
  row: XRefRow;
  searchQuery: string;
  onOpenBook: (b: string, p?: string, s?: string) => void;
  onDelete: (id: string) => void;
  onLabelSave: (id: string, label: string | null) => void;
  selected: boolean;
  onToggleSelected: () => void;
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
    { key: 'a', snapshot: row.snapshotA, citation: row.citationA, bookId: row.bookIdA, passageId: row.passageIdA, bookTitle: row.bookTitleA },
    { key: 'b', snapshot: row.snapshotB, citation: row.citationB, bookId: row.bookIdB, passageId: row.passageIdB, bookTitle: row.bookTitleB },
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
        <button
          onClick={e => { e.stopPropagation(); onToggleSelected(); }}
          className="shrink-0 w-[18px] h-[18px] rounded border-2 flex items-center justify-center transition-colors"
          style={{ borderColor: selected ? '#1B6B7B' : '#CBD5E1', background: selected ? '#1B6B7B' : 'transparent' }}
          aria-label={t('xrefs.exportSelected')}
        >
          {selected && <span className="text-white text-[10px] leading-none font-bold">✓</span>}
        </button>
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
          <button onClick={startEdit} className="flex-1 text-sm font-semibold text-[#1B6B7B] dark:text-[#2D9DB3] text-start hover:opacity-70 transition-opacity truncate">
            {row.label}
          </button>
        ) : (
          <button onClick={startEdit} className="flex-1 text-sm text-gray-400 dark:text-[#5C7A8E] text-start hover:text-gray-500 dark:hover:text-[#8FA4B8] transition-colors">
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
              <Highlight text={side.citation || side.bookTitle} q={searchQuery} />
            </p>
            {/* Synced imported books have no web reader (empty passage_id). */}
            {expanded && side.bookId && side.passageId && (
              <button
                onClick={e => { e.stopPropagation(); onOpenBook(side.bookId, side.passageId, side.snapshot); }}
                className="text-xs text-[#1B6B7B] dark:text-[#2D9DB3] font-medium hover:underline text-start"
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const toggleSelected = (id: string) =>
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const [showExportMenu, setShowExportMenu] = useState(false);
  const [exporting, setExporting] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // Phase 8 — share link for the currently-selected set of xrefs.
  const [shareInfo, setShareInfo]   = useState<{ id: string; url: string } | null>(null);
  const [shareBusy, setShareBusy]   = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const closeExportMenu = () => {
    setShowExportMenu(false);
    setShareInfo(null);
    setLinkCopied(false);
  };

  function toggleExportMenu() {
    if (showExportMenu) { closeExportMenu(); return; }
    setShowExportMenu(true);
    if (selectedIds.size > 0 && userId) {
      findXrefShareForSelection([...selectedIds], userId).then(setShareInfo).catch(() => setShareInfo(null));
    }
  }

  // The set of selected xrefs changed while the menu was open — any pre-fetched
  // link no longer describes the current selection.
  useEffect(() => { setShareInfo(null); setLinkCopied(false); }, [selectedIds]);

  useEffect(() => {
    if (!showExportMenu) return;
    const h = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) closeExportMenu();
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [showExportMenu]);

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
      const [{ data: xrefData, error: xrefErr }, selMap, catalog, { uuidToSlug }] = await Promise.all([
        supabase.from('xrefs').select('id, created_at, selection_a_id, selection_b_id, label').eq('user_id', userId).order('created_at', { ascending: false }),
        fetchSelectionsByUser(userId),
        loadCatalog(),
        loadSlugMaps(supabase),
      ]);

      const bookMap = new Map<string, CatalogBook>(catalog.books.map(b => [b.id, b]));

      // Shared with the public /c/<id> xref share page so both group by the
      // same tradition pairs (Phase 8).
      const getTradition = makeTraditionResolver(catalog, uuidToSlug, t('common.otherTradition'));

      function getSel(id: string) {
        const s = selMap[id] ?? { snapshot_text: '', citation: '', passage_id: '', book_id: '', book_title: '' };
        return { snapshot: s.snapshot_text, citation: s.citation, bookId: s.book_id, passageId: s.passage_id, bookTitle: s.book_title ?? '' };
      }

      const bookTitle = (bookUuid: string): string => {
        const slug = uuidToSlug.get(bookUuid) ?? '';
        return (slug ? bookMap.get(slug)?.title : '') ?? '';
      };

      const loaded: XRefRow[] = (xrefData ?? []).map((x: any) => {
        const a    = getSel(x.selection_a_id);
        const b    = getSel(x.selection_b_id);
        const tradA = getTradition(a.bookId);
        const tradB = getTradition(b.bookId);

        // Normalize the pair via the shared helper so the on-screen grouping and
        // the public /c/<id> xref-share page can't drift (Phase 8).
        const { pairKey, pairName } = traditionPairOf(tradA, tradB);

        return {
          id:           x.id,
          label:        x.label ?? null,
          createdAt:    x.created_at,
          selectionAId: x.selection_a_id,
          selectionBId: x.selection_b_id,
          snapshotA: a.snapshot,  citationA:  a.citation,  bookIdA:  a.bookId,  passageIdA: a.passageId,
          snapshotB: b.snapshot,  citationB:  b.citation,  bookIdB:  b.bookId,  passageIdB: b.passageId,
          bookTitleA: bookTitle(a.bookId) || a.bookTitle,
          bookTitleB: bookTitle(b.bookId) || b.bookTitle,
          pairKey,
          pairName,
        };
      });
      setRows(loaded);
      // PRUNE SAFETY: only on the success path, only with a list from a
      // fetch that did not error (an errored fetch yields [], which would
      // otherwise wipe every xref share).
      if (!xrefErr) {
        void pruneDeletedXrefsFromShares(userId, (xrefData ?? []).map((x: any) => x.id)).catch(() => {});
      }
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

  // Default title for a new xref share link: the single shared pair name when
  // every selected xref sits in the same tradition pair, else a generic label.
  function defaultShareTitle(): string {
    const chosen = rows.filter(r => selectedIds.has(r.id));
    const keys = new Set(chosen.map(r => r.pairKey));
    if (keys.size === 1 && chosen[0]) return chosen[0].pairName;
    return t('xrefs.title');
  }

  async function handleCreateShareLink() {
    if (shareBusy || selectedIds.size === 0) return;
    const entered = window.prompt(t('share.createLink'), defaultShareTitle());
    if (entered === null) return;
    setShareBusy(true);
    try {
      const { id, url } = await createXrefShareLink([...selectedIds], entered || defaultShareTitle(), userId);
      setShareInfo({ id, url });
      try {
        await navigator.clipboard.writeText(url);
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 2000);
      } catch { /* clipboard blocked — link is still created */ }
    } catch {
      /* create failed — no link */
    } finally {
      setShareBusy(false);
    }
  }

  async function handleRevokeShareLink() {
    if (shareBusy || !shareInfo) return;
    if (!confirm(t('share.revokeConfirm'))) return;
    setShareBusy(true);
    try {
      await revokeSharedSet(shareInfo.id, userId);
      setShareInfo(null);
    } catch {
      /* revoke failed — leave the link visible */
    } finally {
      setShareBusy(false);
    }
  }

  async function handleExport(format: 'pdf' | 'docx' | 'csv' | 'markdown') {
    closeExportMenu();
    setExporting(true);
    try {
      const chosen: XRefExportRow[] = rows
        .filter(r => selectedIds.has(r.id))
        .map(r => ({
          id: r.id, label: r.label, createdAt: r.createdAt,
          pairKey: r.pairKey, pairName: r.pairName,
          a: { snapshotText: r.snapshotA, bookTitle: r.bookTitleA, citation: r.citationA },
          b: { snapshotText: r.snapshotB, bookTitle: r.bookTitleB, citation: r.citationB },
        }));
      if (format === 'pdf')      await exportAsPdf(chosen);
      if (format === 'docx')     await exportAsDocx(chosen);
      if (format === 'csv')      await exportAsCsv(chosen);
      if (format === 'markdown') await exportAsMarkdown(chosen);
    } catch (e) {
      console.error('[XRefExport] failed:', e);
    } finally {
      setExporting(false);
    }
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

  const hierarchy = useMemo(() =>
    groupXrefsByPair(filtered, {
      getLabel:     r => r.label,
      getCreatedAt: r => r.createdAt,
      getPairKey:   r => r.pairKey,
      getPairName:  r => r.pairName,
    }).map(g => ({ pairKey: g.pairKey, name: g.pairName, xrefs: g.items })),
  [filtered]);

  const togglePair = (pairKey: string) =>
    setOpenPairKeys(prev => { const next = new Set(prev); next.has(pairKey) ? next.delete(pairKey) : next.add(pairKey); return next; });

  // Wider than the other annotation screens: an xref card splits its width
  // across two quotes, so 7xl is what puts each side at roughly the max-w-2xl
  // a single Tags quote gets.
  return (
    <div className="h-full flex flex-col max-w-7xl mx-auto w-full bg-white dark:bg-[#1B2A38]">
      {/* Header + search */}
      <div className="px-4 pt-4 pb-3 border-b border-gray-100 dark:border-[#2D4050] shrink-0">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-[#E2EAF2]">{t('xrefs.title')}</h1>
          {selectedIds.size > 0 && (
            <div className="relative" ref={exportMenuRef}>
              <button
                onClick={toggleExportMenu}
                disabled={exporting}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1B6B7B] dark:bg-[#2D9DB3] text-white text-sm font-medium rounded-lg hover:bg-[#1B6B7B]/90 dark:hover:bg-[#2D9DB3]/90 disabled:opacity-60 transition-colors"
                title={t('xrefs.exportSelected')}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/>
                  <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                {exporting ? t('tags.exporting') : `${t('tags.export')} (${selectedIds.size})`}
              </button>
              {showExportMenu && (
                <div className="absolute end-0 top-full mt-1 bg-white dark:bg-[#1B2A38] rounded-xl shadow-lg border border-gray-200 dark:border-[#2D4050] z-20 min-w-[200px]">
                  <div className="py-1">
                    {([
                      { label: 'PDF',                 format: 'pdf'      },
                      { label: t('export.docxShort'), format: 'docx'     },
                      { label: 'CSV',                 format: 'csv'      },
                      { label: 'MD',                  format: 'markdown' },
                    ] as const).map(({ label, format }) => (
                      <button
                        key={format}
                        onClick={() => handleExport(format)}
                        className="w-full text-start px-4 py-2 text-sm text-gray-700 dark:text-[#B8C7D6] hover:bg-gray-50 dark:hover:bg-[#243040] transition-colors"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="py-1 border-t border-gray-100 dark:border-[#2D4050]">
                    {!shareInfo ? (
                      <button
                        disabled={shareBusy}
                        onClick={handleCreateShareLink}
                        className="w-full text-start px-4 py-2 hover:bg-gray-50 dark:hover:bg-[#243040] transition-colors disabled:opacity-60"
                      >
                        <span className="block text-sm text-gray-700 dark:text-[#B8C7D6]">
                          {linkCopied ? t('share.linkCopied') : t('share.createLink')}
                        </span>
                        <span className="block text-[11px] text-gray-400 dark:text-[#5C7A8E]">{t('share.createLinkXrefHint')}</span>
                      </button>
                    ) : (
                      <div className="px-4 py-2">
                        <p className="font-mono text-xs text-gray-500 dark:text-[#8FA4B8] truncate" title={shareInfo.url}>
                          {shareInfo.url}
                        </p>
                        <div className="flex items-center gap-3 mt-2">
                          <button
                            disabled={shareBusy}
                            onClick={() => {
                              navigator.clipboard.writeText(shareInfo.url)
                                .then(() => {
                                  setLinkCopied(true);
                                  setTimeout(() => setLinkCopied(false), 2000);
                                })
                                .catch(() => {});
                            }}
                            className="text-sm font-medium text-[#1B6B7B] dark:text-[#2D9DB3] hover:opacity-70 disabled:opacity-60"
                          >
                            {linkCopied ? t('share.linkCopied') : t('share.copyLink')}
                          </button>
                          <button
                            disabled={shareBusy}
                            onClick={handleRevokeShareLink}
                            className="text-sm font-medium text-red-600 dark:text-red-400 hover:opacity-70 disabled:opacity-60"
                          >
                            {t('share.revoke')}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="relative">
          <svg className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-[#5C7A8E] w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={t('xrefs.searchPlaceholder')}
            className="w-full ps-9 pe-14 py-2 text-sm text-gray-900 dark:text-[#E2EAF2] border border-gray-200 dark:border-[#2D4050] rounded-xl outline-none focus:ring-2 focus:ring-[#1B6B7B]/30 dark:focus:ring-[#2D9DB3]/30 focus:border-[#1B6B7B] dark:focus:border-[#2D9DB3] bg-gray-50 dark:bg-[#243040]"
          />
          {(searchQuery || selectedIds.size > 0) && (
            <button onClick={() => { setSearchQuery(''); setSelectedIds(new Set()); }} className="absolute end-3 top-1/2 -translate-y-1/2 text-xs font-medium text-[#1B6B7B] dark:text-[#2D9DB3] hover:text-[#0f4a56]">{t('common.clear')}</button>
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
                    className="w-full flex items-center gap-2 px-4 py-3.5 hover:bg-gray-50 dark:hover:bg-[#243040] transition-colors text-start select-none"
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
                          selected={selectedIds.has(row.id)}
                          onToggleSelected={() => toggleSelected(row.id)}
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
