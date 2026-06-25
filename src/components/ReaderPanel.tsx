'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { pushNote, pushXref, deleteRemote } from '@/lib/annotationSync';
import { buildCitation } from '@/lib/citationUtils';
import type { ReaderTarget, XRefPickFrom } from './AppShell';
import PanelSheet from './PanelSheet';
import TagPanel from './TagPanel';
import NotePanel from './NotePanel';
import AiPanel from './AiPanel';
import { ContextMenu, type MenuOption } from './ContextMenu';
import { TagIcon, NoteIcon, XRefIcon } from './Icons';
import { getLocalBook } from '@/lib/importedBooksDb';
import { resolveIsPro } from '@/lib/proStatus';

interface Passage {
  id: string;
  content: string;
  chapter_label: string | null;
  section_title: string | null;
  paragraph_number: number | null;
  sort_order: number;
}

interface BookMeta {
  title: string;
  authorName: string;
  citationFormat: string;
}

// Books whose TOC is genuinely two-level (chapter_label = chapter, section_title =
// sub-chapter). Opt-in by UUID so other books that use section_title for rubrics
// keep their flat TOC.
const NESTED_TOC_BOOKS = new Set<string>([
  '560e3d01-91f7-4cb6-9d88-5d9689ec353e', // The World Order of Bahá'u'lláh
  '19962b29-69bf-4c6a-b93c-7a885c50ad16', // Paris Talks (3 Parts → talks)
  '723f4d43-cb81-4e72-b6f0-c74211586048', // The Summons of the Lord of Hosts (Súriy-i-Haykal → 5 king tablets)
  '94f79149-ac9f-43b1-b004-20224eb7cb4c', // The Vishnu Purana
  'c40c3e99-32fc-418a-b12f-4df5b06951ca', // Riḍván 1992
]);

// Books rendered in the centered "prayer book" style: a comma-joined chapter_label
// ("Section, Title") is split into a centered section divider + title, the
// section_title becomes a muted subtitle, and a trailing "—Author" line in the
// content renders as a right-aligned italic attribution. Mirrors the mobile reader.
const PRAYER_STYLE_BOOKS = new Set<string>([
  '0585a670-a168-49e5-a748-44c040ec33d4', // Bahá'í Prayers
]);

// Genuine two-level books (chapter_label = chapter, section_title = subchapter)
// that get the same centered divider + title layout — driven straight from the
// metadata columns (no comma-split, no attribution/rubric handling). Curated:
// only books with multiple passages per subchapter (not flat 1:1 books).
const PRAYER_LAYOUT_BOOKS = new Set<string>([
  '19962b29-69bf-4c6a-b93c-7a885c50ad16', // Paris Talks
  '723f4d43-cb81-4e72-b6f0-c74211586048', // The Summons of the Lord of Hosts
  '560e3d01-91f7-4cb6-9d88-5d9689ec353e', // The World Order of Bahá'u'lláh
  '94f79149-ac9f-43b1-b004-20224eb7cb4c', // The Vishnu Purana
  'c40c3e99-32fc-418a-b12f-4df5b06951ca', // Riḍván 1992
]);

// Trailing attribution at the end of a prayer paragraph, e.g. "\n—Bahá'u'lláh".
const ATTRIBUTION_RE = /\n(—(?:Bahá’u’lláh|The Báb|‘Abdu’l-Bahá|Shoghi Effendi)[^\n]{0,4})\s*$/;

interface TocEntry {
  label: string;
  passageId: string;
  depth?: number;
}

interface SelectionBar {
  x: number;
  y: number;
  text: string;
  startPassageId: string;
  endPassageId: string;
  startOffset: number;
  endOffset: number;
}

interface ReaderPanelProps {
  target: ReaderTarget;
  userId: string;
  onOpenBook?: (bookId: string, passageId?: string) => void;
  xrefPickFrom?: XRefPickFrom | null;
  onStartXrefPick?: (from: XRefPickFrom) => void;
  onXrefPickDone?: () => void;
}

// Render a text fragment, turning [N] markers into tappable footnote sups.
function renderFootnotes(text: string, onFootnoteClick: (n: string) => void, kp: string) {
  return text.split(/(\[\d+\])/g).map((part, i) => {
    const m = part.match(/^\[(\d+)\]$/);
    if (m) {
      return (
        <sup
          key={kp + i}
          onClick={e => { e.stopPropagation(); onFootnoteClick(m[1]); }}
          className="text-[10px] text-[#1B6B7B] font-medium ml-0.5 cursor-pointer hover:text-[#0f4a56] select-none"
          title={`Footnote ${m[1]}`}
        >
          {m[1]}
        </sup>
      );
    }
    return <span key={kp + i}>{part}</span>;
  });
}

function PassageContent({ text, onFootnoteClick, highlight }: { text: string; onFootnoteClick: (n: string) => void; highlight?: string }) {
  const clean = text.replace(/\/\*[^*]*\*\//g, '');
  if (highlight) {
    const plain = clean.replace(/<\/?em>/g, '');
    const words = highlight.trim().split(/\s+/).filter(Boolean);
    const pattern = new RegExp(`(${words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
    const parts = plain.split(pattern);
    return (
      <>
        {parts.map((part, i) =>
          pattern.test(part)
            ? <mark key={i} className="search-highlight rounded px-0.5">{part}</mark>
            : <span key={i}>{part}</span>
        )}
      </>
    );
  }
  const segs = clean.split(/<em>([\s\S]*?)<\/em>/g);
  return (
    <>
      {segs.map((seg, i) =>
        i % 2 === 1
          ? <em key={`i${i}`}>{renderFootnotes(seg, onFootnoteClick, `i${i}-`)}</em>
          : <span key={`n${i}`}>{renderFootnotes(seg, onFootnoteClick, `n${i}-`)}</span>
      )}
    </>
  );
}

interface TagQuote {
  id: string;
  text: string;
  citation: string;
  bookId: string | null;
  passageId: string;
}

interface XrefViewEntry {
  xrefId: string;
  thisSelectionId: string;
  thisSnapshotText: string;
  thisStartOffset: number;
  thisEndOffset: number;
  otherPassageId: string;
  otherSnapshotText: string;
  otherBookId: string | null;
  otherBookTitle: string;
  otherCitation: string;
}

// A tag row in the tags view panel: tap to reveal its quotes + subtags (collapsed),
// with a rotating chevron — mirrors the mobile reader tag panel.
function TagViewNode({ tag, allTags, depth, fetchQuotes, onOpenBook }: {
  tag: { id: string; name: string };
  allTags: Array<{ id: string; name: string; parent_id: string | null }>;
  depth: number;
  fetchQuotes: (tagId: string) => Promise<TagQuote[]>;
  onOpenBook?: (bookId: string, passageId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [quotes, setQuotes] = useState<TagQuote[] | null>(null);
  const children = allTags.filter(t => t.parent_id === tag.id);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && quotes === null) {
      try { setQuotes(await fetchQuotes(tag.id)); } catch { setQuotes([]); }
    }
  }

  return (
    <div>
      <button
        onClick={toggle}
        className="w-full flex items-center gap-2 py-2.5 pr-4 hover:bg-gray-50 transition-colors text-left"
        style={{ paddingLeft: 20 + depth * 18 }}
      >
        <TagIcon size={16} />
        <span className="flex-1 text-sm font-medium text-gray-800 truncate">{tag.name}</span>
        <span className={`text-gray-400 text-xs shrink-0 transition-transform duration-150 inline-block ${open ? 'rotate-90' : ''}`}>›</span>
      </button>
      {open && (
        <div>
          <div style={{ paddingLeft: 20 + depth * 18 + 24 }} className="pr-4">
            {quotes === null ? (
              <p className="py-1.5 text-xs text-gray-400">Loading…</p>
            ) : quotes.length === 0 ? (
              <p className="py-1.5 text-xs text-gray-400">No quotes filed here.</p>
            ) : (
              <div className="space-y-1.5 pb-1.5">
                {quotes.map(q => <TagQuoteRow key={q.id} quote={q} onOpenBook={onOpenBook} />)}
              </div>
            )}
          </div>
          {children.map(c => (
            <TagViewNode key={c.id} tag={c} allTags={allTags} depth={depth + 1} fetchQuotes={fetchQuotes} onOpenBook={onOpenBook} />
          ))}
        </div>
      )}
    </div>
  );
}

function TagQuoteRow({ quote, onOpenBook }: { quote: TagQuote; onOpenBook?: (bookId: string, passageId: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="px-3 py-2 bg-gray-50 rounded-lg border border-gray-100">
      <div className="cursor-pointer select-none" onClick={() => setExpanded(v => !v)}>
        <p className={`font-serif text-sm text-gray-700 leading-relaxed ${expanded ? '' : 'line-clamp-2'}`}>
          "{quote.text}"
        </p>
      </div>
      {expanded && (
        <>
          {quote.citation && <p className="text-xs text-[#1B6B7B] font-medium mt-1.5">{quote.citation}</p>}
          {quote.bookId && onOpenBook && (
            <button
              onClick={() => onOpenBook(quote.bookId!, quote.passageId)}
              className="mt-1.5 text-xs text-[#1B6B7B] font-medium hover:underline"
            >
              Open in reader →
            </button>
          )}
        </>
      )}
    </div>
  );
}

function XrefEntryBlock({ entry, onOpenBook, onDelete }: {
  entry: XrefViewEntry;
  onOpenBook?: (bookId: string, passageId: string) => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const menuOptions: MenuOption[] = [{ label: 'Delete', icon: '🗑️', color: 'danger', onClick: onDelete }];
  return (
    <div className="bg-gray-50 rounded-xl border border-gray-100 overflow-hidden">
      <div className="px-4 py-3 flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-[#1B6B7B] font-medium mb-1.5 truncate">{entry.otherCitation}</p>
          <div className="cursor-pointer select-none flex items-start gap-2" onClick={() => setExpanded(v => !v)}>
            <p className={`flex-1 font-serif text-sm text-gray-700 leading-relaxed ${expanded ? '' : 'line-clamp-2'}`}>
              "{entry.otherSnapshotText}"
            </p>
            <span className={`text-gray-400 text-xs shrink-0 mt-0.5 transition-transform duration-150 inline-block ${expanded ? 'rotate-90' : ''}`}>›</span>
          </div>
          {expanded && entry.otherBookId && onOpenBook && (
            <button
              onClick={() => onOpenBook(entry.otherBookId!, entry.otherPassageId)}
              className="mt-2 text-xs text-[#1B6B7B] font-medium hover:underline"
            >
              Open in reader →
            </button>
          )}
        </div>
        <div className="shrink-0" onClick={e => e.stopPropagation()}>
          <ContextMenu options={menuOptions} />
        </div>
      </div>
    </div>
  );
}

export default function ReaderPanel({ target, userId, onOpenBook, xrefPickFrom, onStartXrefPick, onXrefPickDone }: ReaderPanelProps) {
  const supabase = createClient();
  const [passages, setPassages] = useState<Passage[]>([]);
  const [book, setBook] = useState<BookMeta | null>(null);
  const [loading, setLoading] = useState(false);
  const [tocOpen, setTocOpen] = useState(false);
  const [toc, setToc] = useState<TocEntry[]>([]);
  // Section keys (depth-0 passageIds) collapsed in the TOC. Default expanded;
  // persisted per book in localStorage.
  const [collapsedToc, setCollapsedToc] = useState<Set<string>>(new Set());
  const [footnoteMap, setFootnoteMap] = useState<Record<string, string>>({});
  const [activeFootnote, setActiveFootnote] = useState<{ num: string; text: string } | null>(null);
  const [selectionBar, setSelectionBar] = useState<SelectionBar | null>(null);
  const [savingAnnotation, setSavingAnnotation] = useState(false);
  const [activePanel, setActivePanel] = useState<'tag' | 'note' | 'ai' | 'signin' | null>(null);
  const [pickSaving, setPickSaving] = useState(false);
  const [isPro, setIsPro] = useState(false);
  const [searchHighlight, setSearchHighlight] = useState<{ passageId: string; query: string } | null>(null);
  const [taggedPassageIds, setTaggedPassageIds]   = useState<Set<string>>(new Set());
  const [notedPassageIds, setNotedPassageIds]     = useState<Set<string>>(new Set());
  const [xrefPassageIds, setXrefPassageIds]       = useState<Set<string>>(new Set());
  const [passageToNote, setPassageToNote] = useState<Map<string, { noteId: string; content: string; selectionId: string; snapshotText: string }>>(new Map());
  const [passageToTags, setPassageToTags] = useState<Map<string, { selectionId: string; snapshotText: string; tags: Array<{ id: string; name: string }> }>>(new Map());
  const [passageToXrefs, setPassageToXrefs] = useState<Map<string, XrefViewEntry[]>>(new Map());
  const [annotationPanel, setAnnotationPanel] = useState<{ type: 'note' | 'tags' | 'xrefs'; passageId: string } | null>(null);
  const [editNoteContent, setEditNoteContent] = useState('');
  // "Edit text selection": re-anchor an existing selection by highlighting new text.
  const [editingSel, setEditingSel] = useState<{ selectionIds: string[]; reopen: { type: 'note' | 'tags' | 'xrefs'; passageId: string } } | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  // Full tag tree (id/name/parent) for the tags view panel's collapsible subtags.
  const [allTags, setAllTags] = useState<Array<{ id: string; name: string; parent_id: string | null }>>([]);
  const [pdfUrl, setPdfUrl]         = useState<string | null>(null);
  const [isImported, setIsImported] = useState(false);
  const pdfUrlRef = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const readerRef = useRef<HTMLDivElement>(null);
  const selectionBarRef = useRef<HTMLDivElement>(null);
  // Persists the selection data while a panel is open (selectionBar state gets cleared by mousedown listener)
  const pendingSelectionRef = useRef<SelectionBar | null>(null);
  // Reading progress tracking
  const progressTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedPidRef   = useRef<string | null>(null);

  useEffect(() => {
    if (!target?.bookId) return;
    setTocOpen(false);
    setSelectionBar(null);
    loadBook(target.bookId, target.passageId);
  }, [target?.bookId]);

  useEffect(() => {
    if (!userId) return;
    resolveIsPro(supabase, userId).then(setIsPro);
  }, [userId]);

  // Pre-compute max sort_order once passages load (for fraction calculation)
  const maxSortOrder = useMemo(
    () => passages.length > 0 ? passages[passages.length - 1].sort_order : 1,
    [passages],
  );

  // Save reading progress to Supabase (debounced — called by IntersectionObserver)
  const saveProgress = useCallback(async (passageId: string) => {
    if (!userId || !target?.bookId) return;
    const passage = passages.find(p => p.id === passageId);
    const fraction = passage ? passage.sort_order / Math.max(maxSortOrder, 1) : 0;
    const { error } = await supabase.from('reading_progress').upsert(
      {
        user_id:            userId,
        book_id:            target.bookId,
        passage_id:         passageId,
        passage_sort_order: passage?.sort_order ?? 0,
        fraction,
        updated_at:         new Date().toISOString(),
      },
      { onConflict: 'user_id,book_id' },
    );
    if (error) console.error('[ReadingProgress] save failed:', error.message);
    else lastSavedPidRef.current = passageId;
  }, [userId, target?.bookId, passages, maxSortOrder]);

  // Track topmost visible passage via scroll events; debounce saves by 3s
  useEffect(() => {
    if (!userId || passages.length === 0 || !scrollRef.current) return;
    const container = scrollRef.current;

    function scheduleProgressSave() {
      if (progressTimerRef.current) clearTimeout(progressTimerRef.current);
      progressTimerRef.current = setTimeout(() => {
        // Scan passages in order; first whose bottom edge clears the container top is topmost visible
        const containerTop = container.getBoundingClientRect().top;
        let topmostId: string | null = null;
        for (const p of passages) {
          const el = document.getElementById(`p-${p.id}`);
          if (!el) continue;
          if (el.getBoundingClientRect().bottom > containerTop + 8) {
            topmostId = p.id;
            break;
          }
        }
        if (topmostId && topmostId !== lastSavedPidRef.current) {
          saveProgress(topmostId).catch(() => {});
        }
      }, 3000);
    }

    container.addEventListener('scroll', scheduleProgressSave, { passive: true });
    // Also fire once on setup so a stationary reader still saves after 3s
    scheduleProgressSave();

    return () => {
      container.removeEventListener('scroll', scheduleProgressSave);
      if (progressTimerRef.current) clearTimeout(progressTimerRef.current);
    };
  }, [passages, userId, saveProgress]);

  // Fetch annotation state for current passages — shared by initial load + Realtime handler.
  const loadAnnotations = useCallback(async (passageIds: string[]) => {
    if (!userId || passageIds.length === 0) return;
    const tagged = new Set<string>();
    const noted  = new Set<string>();
    const noteMap = new Map<string, { noteId: string; content: string; selectionId: string; snapshotText: string }>();
    const tagsMap = new Map<string, { selectionId: string; snapshotText: string; tags: Array<{ id: string; name: string }> }>();
    const selIdToPid = new Map<string, string>();
    const BATCH = 200;
    for (let i = 0; i < passageIds.length; i += BATCH) {
      const ids = passageIds.slice(i, i + BATCH);
      const { data } = await supabase
        .from('selections')
        .select('id, passage_id, snapshot_text, selection_tags(tag_id, tags(id, name)), notes(id, content)')
        .eq('user_id', userId)
        .in('passage_id', ids);
      for (const row of (data ?? []) as any[]) {
        selIdToPid.set(row.id, row.passage_id);
        const selTags  = (row.selection_tags as any[]) ?? [];
        const selNotes = (row.notes as any[]) ?? [];
        if (selTags.length > 0) {
          tagged.add(row.passage_id);
          tagsMap.set(row.passage_id, {
            selectionId: row.id,
            snapshotText: row.snapshot_text ?? '',
            tags: selTags.map((st: any) => ({ id: st.tags?.id ?? st.tag_id, name: st.tags?.name ?? '' })).filter((t: any) => t.name),
          });
        }
        if (selNotes.length > 0) {
          noted.add(row.passage_id);
          const note = selNotes[0];
          noteMap.set(row.passage_id, { noteId: note.id, content: note.content, selectionId: row.id, snapshotText: row.snapshot_text ?? '' });
        }
      }
    }
    // Detect which passages have xrefs (two-direction query)
    const xrefPids = new Set<string>();
    if (selIdToPid.size > 0) {
      const allSelIds = [...selIdToPid.keys()];
      for (let i = 0; i < allSelIds.length; i += BATCH) {
        const batch = allSelIds.slice(i, i + BATCH);
        const [{ data: xrefsA }, { data: xrefsB }] = await Promise.all([
          supabase.from('xrefs').select('selection_a_id').eq('user_id', userId).in('selection_a_id', batch),
          supabase.from('xrefs').select('selection_b_id').eq('user_id', userId).in('selection_b_id', batch),
        ]);
        for (const x of (xrefsA ?? []) as any[]) { const pid = selIdToPid.get(x.selection_a_id); if (pid) xrefPids.add(pid); }
        for (const x of (xrefsB ?? []) as any[]) { const pid = selIdToPid.get(x.selection_b_id); if (pid) xrefPids.add(pid); }
      }
    }
    setTaggedPassageIds(tagged);
    setNotedPassageIds(noted);
    setPassageToTags(tagsMap);
    setPassageToNote(noteMap);
    setXrefPassageIds(xrefPids);
    // Invalidate cached xref details so re-open fetches fresh data
    setPassageToXrefs(new Map());
  }, [userId]);

  // Realtime: refresh annotation indicators when selections or notes change.
  // Catches annotations created/edited on mobile while this web session is open.
  // notes is included so inline note edits (no new selection) still update the indicator.
  useEffect(() => {
    if (!userId || passages.length === 0) return;
    const passageIds = passages.map(p => p.id);
    const reload = () => { loadAnnotations(passageIds).catch(() => {}); };
    const channel = supabase
      .channel(`reader-annot-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'selections', filter: `user_id=eq.${userId}` }, reload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notes',      filter: `user_id=eq.${userId}` }, reload)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, passages, loadAnnotations]);

  async function createSelection(): Promise<string> {
    const bar = pendingSelectionRef.current ?? selectionBar;
    if (!bar || !target) throw new Error('No selection');
    const now = new Date().toISOString();

    // Resolve mobile-compatible passage data-pid and book slug via mapping tables
    const [{ data: pidRow }, { data: bookRow }] = await Promise.all([
      supabase.from('passage_pid_map').select('pid').eq('passage_id', bar.startPassageId).maybeSingle(),
      supabase.from('book_slug_map').select('local_id').eq('book_id', target.bookId ?? '').maybeSingle(),
    ]);
    const mobilePid    = pidRow?.pid    ?? null;   // data-pid hex string, or null if unmapped
    const bookLocalId  = bookRow?.local_id ?? null; // corpus slug, or null if unmapped

    const { data, error } = await supabase
      .from('selections')
      .insert({
        user_id:               userId,
        passage_id:            bar.startPassageId,
        start_pid:             mobilePid,
        end_pid:               mobilePid,
        book_local_id:         bookLocalId,
        anchor_schema_version: 1,
        start_offset:          bar.startOffset,
        end_offset:            bar.endOffset,
        snapshot_text:         bar.text,
        created_at:            now,
        updated_at:            now,
      })
      .select('id')
      .single();
    if (error) throw error;
    return data.id;
  }

  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (selectionBar && selectionBarRef.current && !selectionBarRef.current.contains(e.target as Node)) {
        setSelectionBar(null);
        window.getSelection()?.removeAllRanges();
      }
    }
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [selectionBar]);

  async function loadBook(bookId: string, scrollToId?: string) {
    // Revoke any previous blob URL to avoid memory leaks
    if (pdfUrlRef.current) {
      URL.revokeObjectURL(pdfUrlRef.current);
      pdfUrlRef.current = null;
    }

    setLoading(true);
    setPassages([]);
    setBook(null);
    setPdfUrl(null);
    setIsImported(false);
    setTaggedPassageIds(new Set());
    setNotedPassageIds(new Set());
    lastSavedPidRef.current = null;

    // ── Local (IndexedDB) imported book ──────────────────────────────────────
    if (bookId.startsWith('imported:')) {
      const localId = bookId.slice('imported:'.length);
      try {
        const record = await getLocalBook(localId);
        if (!record) {
          setBook({ title: 'Book not found', authorName: '', citationFormat: 'author_book_paragraph' });
          setLoading(false);
          return;
        }
        setBook({ title: record.title, authorName: '', citationFormat: 'author_book_paragraph' });
        setIsImported(true);

        if (record.pdfBlob) {
          const url = URL.createObjectURL(record.pdfBlob);
          pdfUrlRef.current = url;
          setPdfUrl(url);
        } else {
          // Convert paragraphs to fake Passage objects
          const ps: Passage[] = record.paragraphs.map((content, i) => ({
            id:               `local-${localId}-${i}`,
            content,
            chapter_label:    null,
            section_title:    null,
            paragraph_number: null,
            sort_order:       i,
          }));
          setPassages(ps);
          if (scrollToId) {
            setTimeout(() => {
              document.getElementById(`p-${scrollToId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);
          } else {
            scrollRef.current?.scrollTo({ top: 0 });
          }
        }
      } catch (err) {
        console.error('[ReaderPanel] local book load error:', err);
        setBook({ title: 'Could not load book', authorName: '', citationFormat: 'author_book_paragraph' });
      }
      setLoading(false);
      return;
    }
    // ── End local book ────────────────────────────────────────────────────────
    try {
      // Fetch book metadata and all passages in parallel.
      // Passages are fetched in batches of 1000 to bypass the PostgREST server-side
      // row cap (default 1000). We keep fetching until a batch returns fewer than 1000 rows.
      const BATCH = 1000;
      const fetchAllPassages = async () => {
        const all: any[] = [];
        let from = 0;
        while (true) {
          const { data: batch, error } = await supabase
            .from('passages')
            .select('id, content, chapter_label, section_title, paragraph_number, sort_order')
            .eq('book_id', bookId)
            .order('sort_order')
            .range(from, from + BATCH - 1);
          if (error || !batch || batch.length === 0) break;
          all.push(...batch);
          if (batch.length < BATCH) break; // last page
          from += BATCH;
        }
        return all;
      };

      const [{ data: bookData }, passageData] = await Promise.all([
        supabase.from('books').select('title, citation_format, authors(name), footnotes').eq('id', bookId).single(),
        fetchAllPassages(),
      ]);

      if (bookData) {
        setBook({ title: bookData.title, authorName: (bookData.authors as any)?.name ?? '', citationFormat: (bookData as any).citation_format ?? 'author_book_paragraph' });
        setFootnoteMap((bookData as any).footnotes ?? {});
      }

      const ps: Passage[] = passageData ?? [];
      setPassages(ps);

      // Load existing annotations asynchronously so the book renders immediately.
      if (ps.length > 0) {
        loadAnnotations(ps.map(p => p.id)).catch(() => {});
      }

      // Build TOC. Native-numbered books (e.g. The Hidden Words) nest each
      // numbered entry under its section (Arabic/Persian) as a depth-1 child,
      // anchored to the number-only passage ("1.", paragraph_number null).
      const tocEntries: TocEntry[] = [];
      if ((bookData as any)?.citation_format === 'author_book_section_native_number') {
        let lastChapter: string | null = null;
        for (const p of ps) {
          if (p.chapter_label && p.chapter_label !== lastChapter) {
            lastChapter = p.chapter_label;
            tocEntries.push({ label: p.chapter_label, passageId: p.id, depth: 0 });
          }
          const num = p.paragraph_number == null ? /^\s*(\d+)\.?\s*$/.exec(p.content || '') : null;
          if (num) tocEntries.push({ label: num[1], passageId: p.id, depth: 1 });
        }
      } else if (PRAYER_STYLE_BOOKS.has(bookId)) {
        // Bahá'í Prayers: chapter_label = "Chapter, Subchapter" → split into two levels.
        let lastChapter: string | null = null;
        let lastSub: string | null = null;
        for (const p of ps) {
          const cl = p.chapter_label || '';
          const ci = cl.indexOf(', ');
          const chap = ci !== -1 ? cl.slice(0, ci) : cl;
          const sub = ci !== -1 ? cl.slice(ci + 2).trim() : '';
          if (chap && chap !== lastChapter) {
            lastChapter = chap; lastSub = null;
            tocEntries.push({ label: chap, passageId: p.id, depth: 0 });
          }
          if (sub && sub !== lastSub) {
            lastSub = sub;
            tocEntries.push({ label: sub, passageId: p.id, depth: 1 });
          }
        }
      } else if (NESTED_TOC_BOOKS.has(bookId)) {
        // Books with a real two-level structure: chapter_label = chapter (depth 0),
        // section_title = sub-chapter (depth 1).
        let lastChapter: string | null = null;
        let lastSection: string | null = null;
        for (const p of ps) {
          if (p.chapter_label && p.chapter_label !== lastChapter) {
            lastChapter = p.chapter_label;
            lastSection = null;
            tocEntries.push({ label: p.chapter_label, passageId: p.id, depth: 0 });
          }
          if (p.section_title && p.section_title !== lastSection) {
            lastSection = p.section_title;
            tocEntries.push({ label: p.section_title, passageId: p.id, depth: 1 });
          }
        }
      } else {
        const seen = new Set<string>();
        for (const p of ps) {
          const label = p.chapter_label || p.section_title;
          if (label && !seen.has(label)) {
            seen.add(label);
            tocEntries.push({ label, passageId: p.id });
          }
        }
      }
      setToc(tocEntries);

      // Resolve scroll target: explicit passageId > saved cloud progress > top
      let resolvedScrollId = scrollToId;
      if (!resolvedScrollId && userId) {
        const { data: saved } = await supabase
          .from('reading_progress')
          .select('passage_id')
          .eq('user_id', userId)
          .eq('book_id', bookId)
          .maybeSingle();
        if (saved?.passage_id) resolvedScrollId = saved.passage_id;
      }

      // Dismiss the loading spinner now so passages are in the DOM before the scroll fires
      setLoading(false);

      if (resolvedScrollId) {
        lastSavedPidRef.current = resolvedScrollId;
        setTimeout(() => {
          document.getElementById(`p-${resolvedScrollId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
        if (target?.highlightQuery) {
          setSearchHighlight({ passageId: resolvedScrollId, query: target.highlightQuery });
          setTimeout(() => setSearchHighlight(null), 5000);
        }
      } else {
        scrollRef.current?.scrollTo({ top: 0 });
      }

      // Fire-and-forget: record this book open so it appears in Recently Read
      if (userId && ps.length > 0) {
        const pidToSave = resolvedScrollId ?? ps[0].id;
        const p = ps.find(p => p.id === pidToSave) ?? ps[0];
        const maxSo = ps[ps.length - 1].sort_order;
        lastSavedPidRef.current = pidToSave;
        await supabase.from('reading_progress').upsert(
          {
            user_id:            userId,
            book_id:            bookId,
            passage_id:         pidToSave,
            passage_sort_order: p.sort_order,
            fraction:           p.sort_order / Math.max(maxSo, 1),
            updated_at:         new Date().toISOString(),
          },
          { onConflict: 'user_id,book_id' },
        );
      }
    } finally {
      setLoading(false);
    }
  }

  // Handle text selection — show action bar on mouseup
  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.toString().trim()) {
      setSelectionBar(null);
      return;
    }

    const selectedText = sel.toString().trim();
    const range = sel.getRangeAt(0);

    // Find which passage elements the selection starts/ends in
    const startEl = (range.startContainer.nodeType === Node.TEXT_NODE
      ? range.startContainer.parentElement
      : range.startContainer as Element)?.closest('[data-pid]') as HTMLElement | null;
    const endEl = (range.endContainer.nodeType === Node.TEXT_NODE
      ? range.endContainer.parentElement
      : range.endContainer as Element)?.closest('[data-pid]') as HTMLElement | null;

    if (!startEl || !endEl) { setSelectionBar(null); return; }

    const startPassageId = startEl.dataset.pid!;
    const endPassageId   = endEl.dataset.pid!;

    // Use the bounding rect of the selection to position the bar
    const rect = range.getBoundingClientRect();
    const containerRect = readerRef.current?.getBoundingClientRect();
    if (!containerRect) return;

    setSelectionBar({
      x: rect.left + rect.width / 2 - containerRect.left,
      y: rect.top - containerRect.top - 48,
      text: selectedText,
      startPassageId,
      endPassageId,
      startOffset: range.startOffset,
      endOffset: range.endOffset,
    });
  }, []);

async function handleCopy() {
    if (!selectionBar) return;
    const passage = passages.find(p => p.id === selectionBar.startPassageId);

    let citation = '';
    const fmt = book?.citationFormat ?? 'author_book_paragraph';
    // Bahá'í Prayers: cite by sub-chapter only (no author), e.g.
    // "— Bahá'í Prayers, Aid and Assistance, p.3." Mirrors the mobile app.
    const BAHAI_PRAYERS_ID = '0585a670-a168-49e5-a748-44c040ec33d4';
    if (target?.bookId === BAHAI_PRAYERS_ID) {
      const cl = passage?.chapter_label ?? '';
      const ci = cl.indexOf(',');
      const sub = (ci >= 0 ? cl.slice(ci + 1) : cl).trim();
      const para = passage?.paragraph_number ? `p.${passage.paragraph_number}` : null;
      citation = '— ' + [book?.title, sub || null, para].filter(Boolean).join(', ');
    } else if (fmt === 'scripture_sura_verse') {
      const chapterNum = passage?.chapter_label?.match(/\d+/)?.[0] ?? '';
      const verse = passage?.paragraph_number ? String(passage.paragraph_number) : '';
      const loc = chapterNum && verse ? `${chapterNum}:${verse}` : chapterNum || verse;
      citation = `— ${book?.title ?? "The Qur'an"}${loc ? ` ${loc}` : ''}`;
    } else if (fmt === 'bible') {
      const chapterNum = passage?.chapter_label?.match(/\d+/)?.[0] ?? '';
      const verse = passage?.paragraph_number ? String(passage.paragraph_number) : '';
      const loc = chapterNum && verse ? `${chapterNum}:${verse}` : chapterNum || verse;
      const bookPart = book?.title ? `${book.title}${loc ? ` ${loc}` : ''}` : loc;
      citation = bookPart ? `— The Bible, ${bookPart}` : '— The Bible';
    } else if (fmt === 'tanakh') {
      const chapterNum = passage?.chapter_label?.match(/\d+/)?.[0] ?? '';
      const verse = passage?.paragraph_number ? String(passage.paragraph_number) : '';
      const loc = chapterNum && verse ? `${chapterNum}:${verse}` : chapterNum || verse;
      // Titles are "Hebrew (English)"; cite the English name to match mobile.
      const title = book?.title ? (book.title.match(/\(([^)]+)\)\s*$/)?.[1] ?? book.title) : '';
      const bookPart = title ? `${title}${loc ? ` ${loc}` : ''}` : loc;
      citation = bookPart ? `— Tanakh, ${bookPart}` : '— Tanakh';
    } else if (fmt === 'numbered_sections') {
      // Guru Granth Sahib: paragraph_number == Ang (SGGS page).
      citation = passage?.paragraph_number ? `— Guru Granth Sahib, Ang ${passage.paragraph_number}` : '— Guru Granth Sahib';
    } else if (fmt === 'author_book_section_native_number') {
      // The Hidden Words: section in chapter_label, native number in paragraph_number.
      const author = book?.authorName && book.authorName !== book?.title ? book.authorName : null;
      const loc = [passage?.chapter_label, passage?.paragraph_number].filter(v => v != null && v !== '').join(' ');
      citation = '— ' + [author, book?.title, loc].filter(Boolean).join(', ');
    } else {
      const author = book?.authorName && book.authorName !== book?.title ? book.authorName : null;
      const location = passage?.chapter_label || passage?.section_title || null;
      const para = passage?.paragraph_number ? `p.${passage.paragraph_number}` : null;
      const citationParts = [author, book?.title, location, para].filter(Boolean);
      citation = citationParts.length ? `— ${citationParts.join(', ')}` : '';
    }
    const textToCopy = citation ? `"${selectionBar.text}"\n${citation}` : selectionBar.text;
    await navigator.clipboard.writeText(textToCopy);
    setSelectionBar(null);
    window.getSelection()?.removeAllRanges();
  }

  async function handleTagIconClick(passageId: string) {
    // Load the full tag tree so the panel can show collapsible subtags.
    const { data } = await supabase
      .from('tags').select('id, name, parent_id').eq('user_id', userId);
    setAllTags((data ?? []) as Array<{ id: string; name: string; parent_id: string | null }>);
    setAnnotationPanel({ type: 'tags', passageId });
  }

  // ── Edit text selection (re-anchor) ──────────────────────────────────────────
  // Hide the panel and enter "highlight new text" mode; the next selection updates
  // the existing selection row (same id, new passage/offsets/snapshot).
  // selectionIds may hold more than one row: a single highlighted quote can spawn a
  // duplicate source selection per xref, and they must all re-anchor together.
  function startEditSelection(selectionIds: string[], reopen: { type: 'note' | 'tags' | 'xrefs'; passageId: string }) {
    if (selectionIds.length === 0) return;
    setEditingSel({ selectionIds, reopen });
    setAnnotationPanel(null);
    setSelectionBar(null);
    window.getSelection()?.removeAllRanges();
  }

  function cancelEditSelection() {
    const reopen = editingSel?.reopen ?? null;
    setEditingSel(null);
    setSelectionBar(null);
    window.getSelection()?.removeAllRanges();
    if (reopen) setAnnotationPanel(reopen);
  }

  async function confirmEditSelection() {
    if (!editingSel || !selectionBar || !target) return;
    setSavingEdit(true);
    try {
      const bar = selectionBar;
      const { data: pidRow } = await supabase
        .from('passage_pid_map').select('pid').eq('passage_id', bar.startPassageId).maybeSingle();
      const mobilePid = pidRow?.pid ?? null;
      const now = new Date().toISOString();
      // Re-anchor every selection row in the group (xref duplicates of one quote).
      await supabase.from('selections').update({
        passage_id:    bar.startPassageId,
        start_pid:     mobilePid,
        end_pid:       mobilePid,
        start_offset:  bar.startOffset,
        end_offset:    bar.endOffset,
        snapshot_text: bar.text,
        updated_at:    now,
      }).in('id', editingSel.selectionIds);
      // No pushSelection here: the direct update above already writes to the shared
      // Supabase selections table (source of truth; mobile pulls from it) and preserves
      // book_local_id, which pushSelection's upsert would null out.
      const reopen = editingSel.reopen;
      setEditingSel(null);
      setSelectionBar(null);
      window.getSelection()?.removeAllRanges();
      await loadAnnotations(passages.map(p => p.id));
      // Reopen the panel under the (possibly new) passage. Xrefs need a refetch.
      if (reopen.type === 'xrefs') await handleXrefIconClick(bar.startPassageId);
      else setAnnotationPanel({ type: reopen.type, passageId: bar.startPassageId });
    } finally {
      setSavingEdit(false);
    }
  }

  // Fetch all quotes (selections) filed under a tag, with citations, for the tags view.
  const fetchTagQuotes = useCallback(async (tagId: string): Promise<TagQuote[]> => {
    const { data: st } = await supabase.from('selection_tags').select('selection_id').eq('tag_id', tagId);
    const selIds = [...new Set((st ?? []).map((r: any) => r.selection_id as string))];
    if (selIds.length === 0) return [];
    const { data: sels } = await supabase
      .from('selections').select('id, snapshot_text, passage_id').in('id', selIds);
    const pIds = [...new Set((sels ?? []).map((s: any) => s.passage_id).filter(Boolean))];
    const { data: pass } = pIds.length > 0
      ? await supabase.from('passages').select('id, chapter_label, section_title, paragraph_number, book_id').in('id', pIds)
      : { data: [] as any[] };
    const passMap: Record<string, any> = {};
    for (const p of (pass ?? []) as any[]) passMap[p.id] = p;
    const bIds = [...new Set(Object.values(passMap).map((p: any) => p.book_id).filter(Boolean))];
    const { data: bks } = bIds.length > 0
      ? await supabase.from('books').select('id, title, citation_format').in('id', bIds)
      : { data: [] as any[] };
    const bookMap: Record<string, any> = {};
    for (const b of (bks ?? []) as any[]) bookMap[b.id] = b;
    return (sels ?? []).map((s: any) => {
      const p = passMap[s.passage_id];
      const b = p ? bookMap[p.book_id] : null;
      return {
        id: s.id,
        text: s.snapshot_text ?? '',
        citation: p ? buildCitation(p, b) : '',
        bookId: b?.id ?? null,
        passageId: s.passage_id as string,
      };
    });
  }, [supabase]);

  function handleNoteIconClick(passageId: string) {
    const data = passageToNote.get(passageId);
    if (!data) return;
    setEditNoteContent(data.content);
    setAnnotationPanel({ type: 'note', passageId });
  }

  function closeAnnotationPanel() {
    setAnnotationPanel(null);
    setEditNoteContent('');
  }

  async function handleSaveEditNote() {
    if (!annotationPanel || annotationPanel.type !== 'note') return;
    const data = passageToNote.get(annotationPanel.passageId);
    if (!data || !editNoteContent.trim()) return;
    const now = new Date().toISOString();
    try {
      await supabase.from('notes').update({ content: editNoteContent.trim(), updated_at: now }).eq('id', data.noteId);
      await pushNote({ id: data.noteId, user_id: userId, selection_id: data.selectionId, content: editNoteContent.trim(), updated_at: now }).catch(() => {});
      setPassageToNote(prev => { const next = new Map(prev); next.set(annotationPanel.passageId, { ...data, content: editNoteContent.trim() }); return next; });
      closeAnnotationPanel();
    } catch {}
  }

  async function handleDeleteNote() {
    if (!annotationPanel || annotationPanel.type !== 'note') return;
    const data = passageToNote.get(annotationPanel.passageId);
    if (!data || !confirm('Delete this note?')) return;
    try {
      await supabase.from('notes').delete().eq('id', data.noteId);
      deleteRemote('notes', data.noteId).catch(() => {});
      setNotedPassageIds(prev => { const next = new Set(prev); next.delete(annotationPanel.passageId); return next; });
      setPassageToNote(prev => { const next = new Map(prev); next.delete(annotationPanel.passageId); return next; });
      closeAnnotationPanel();
    } catch {}
  }

  async function handleXrefIconClick(passageId: string) {
    if (passageToXrefs.has(passageId)) {
      setAnnotationPanel({ type: 'xrefs', passageId });
      return;
    }
    const { data: sels } = await supabase
      .from('selections').select('id, snapshot_text, start_offset, end_offset').eq('user_id', userId).eq('passage_id', passageId);
    const selIds = (sels ?? []).map((s: any) => s.id as string);
    const selSnaps = new Map((sels ?? []).map((s: any) => [s.id as string, (s.snapshot_text as string) ?? '']));
    const selAnchors = new Map((sels ?? []).map((s: any) => [s.id as string, { startOffset: (s.start_offset as number) ?? 0, endOffset: (s.end_offset as number) ?? 0 }]));
    if (selIds.length === 0) return;
    const [{ data: xrefsA }, { data: xrefsB }] = await Promise.all([
      supabase.from('xrefs').select('id, selection_a_id, selection_b_id').in('selection_a_id', selIds),
      supabase.from('xrefs').select('id, selection_a_id, selection_b_id').in('selection_b_id', selIds),
    ]);
    const allXrefs = [...(xrefsA ?? []), ...(xrefsB ?? [])] as any[];
    const xrefById = new Map(allXrefs.map((x: any) => [x.id as string, x]));
    if (xrefById.size === 0) return;
    const selIdSet = new Set(selIds);
    const otherSelIds = [...xrefById.values()].map((x: any) =>
      selIdSet.has(x.selection_a_id) ? x.selection_b_id : x.selection_a_id
    );

    // Fetch other selections without FK join — selections.passage_id has no FK to passages,
    // so PostgREST embedded-resource syntax would fail silently. Use three separate queries instead.
    const { data: otherSelData } = await supabase
      .from('selections')
      .select('id, snapshot_text, passage_id')
      .in('id', otherSelIds);
    const otherPassageIds = [...new Set((otherSelData ?? []).map((s: any) => s.passage_id).filter(Boolean))];
    const { data: passData } = otherPassageIds.length > 0
      ? await supabase.from('passages').select('id, chapter_label, section_title, paragraph_number, book_id').in('id', otherPassageIds)
      : { data: [] as any[] };
    const passMap: Record<string, any> = {};
    for (const p of (passData ?? []) as any[]) passMap[p.id] = p;
    const bookIds = [...new Set(Object.values(passMap).map((p: any) => p.book_id).filter(Boolean))];
    const { data: bookDataArr } = bookIds.length > 0
      ? await supabase.from('books').select('id, title, citation_format').in('id', bookIds)
      : { data: [] as any[] };
    const bookMap: Record<string, any> = {};
    for (const b of (bookDataArr ?? []) as any[]) bookMap[b.id] = b;

    const otherSelMap = new Map((otherSelData ?? []).map((s: any) => [s.id as string, s]));
    const entries: XrefViewEntry[] = [];
    for (const [xrefId, xref] of xrefById) {
      const thisSelId = selIdSet.has(xref.selection_a_id) ? xref.selection_a_id : xref.selection_b_id;
      const otherSelId = selIdSet.has(xref.selection_a_id) ? xref.selection_b_id : xref.selection_a_id;
      const other = otherSelMap.get(otherSelId) as any;
      if (!other) continue;
      const passage = passMap[other.passage_id] as any;
      const bookObj = passage ? bookMap[passage.book_id] : null;
      entries.push({
        xrefId,
        thisSelectionId: thisSelId,
        thisSnapshotText: selSnaps.get(thisSelId) ?? '',
        thisStartOffset: selAnchors.get(thisSelId)?.startOffset ?? 0,
        thisEndOffset: selAnchors.get(thisSelId)?.endOffset ?? 0,
        otherPassageId: other.passage_id,
        otherSnapshotText: other.snapshot_text ?? '',
        otherBookId: bookObj?.id ?? null,
        otherBookTitle: bookObj?.title ?? '',
        otherCitation: buildCitation(passage, bookObj),
      });
    }
    setPassageToXrefs(prev => new Map(prev).set(passageId, entries));
    setAnnotationPanel({ type: 'xrefs', passageId });
  }

  async function handleDeleteXref(passageId: string, xrefId: string) {
    if (!confirm('Delete this cross-reference?')) return;
    try {
      await supabase.from('xrefs').delete().eq('id', xrefId);
      deleteRemote('xrefs', xrefId).catch(() => {});
      const remaining = (passageToXrefs.get(passageId) ?? []).filter(e => e.xrefId !== xrefId);
      if (remaining.length === 0) {
        setPassageToXrefs(prev => { const next = new Map(prev); next.delete(passageId); return next; });
        setXrefPassageIds(prev => { const s = new Set(prev); s.delete(passageId); return s; });
        setAnnotationPanel(null);
      } else {
        setPassageToXrefs(prev => new Map(prev).set(passageId, remaining));
      }
    } catch {}
  }

  function openPanel(panel: 'tag' | 'note' | 'ai') {
    pendingSelectionRef.current = selectionBar; // capture before mousedown clears it
    setActivePanel(userId ? panel : 'signin');
    window.getSelection()?.removeAllRanges();
  }

  function closePanel() {
    setActivePanel(null);
    setSelectionBar(null);
    pendingSelectionRef.current = null;
  }

  async function handleTagSave(tagIds: string[]) {
    const bar = pendingSelectionRef.current ?? selectionBar;
    const selId = await createSelection();
    const now = new Date().toISOString();
    await Promise.all(tagIds.map(tagId =>
      supabase.from('selection_tags').insert({ selection_id: selId, tag_id: tagId, created_at: now })
    ));
    if (bar) setTaggedPassageIds(prev => new Set(prev).add(bar.startPassageId));
  }

  async function handleNoteSave(content: string) {
    const bar = pendingSelectionRef.current ?? selectionBar;
    const selId = await createSelection();
    const now = new Date().toISOString();
    // Insert note
    const { data: noteData } = await supabase.from('notes').insert({ user_id: userId, selection_id: selId, content, created_at: now, updated_at: now }).select('id').single();
    // Push to sync service
    if (noteData) {
      await pushNote({
        id: noteData.id,
        user_id: userId,
        selection_id: selId,
        content,
        updated_at: now,
      }).catch(() => {});
    }
    if (bar) {
      setNotedPassageIds(prev => new Set(prev).add(bar.startPassageId));
      if (noteData) {
        setPassageToNote(prev => new Map(prev).set(bar.startPassageId, {
          noteId: noteData.id,
          content,
          selectionId: selId,
          snapshotText: bar.text,
        }));
      }
    }
  }

  // Called when user clicks "Xref" in the action bar — initiates pick-mode flow
  function handleXrefStart() {
    const bar = selectionBar;
    if (!bar || !target) return;
    const from: XRefPickFrom = {
      text: bar.text,
      startPassageId: bar.startPassageId,
      bookId: target.bookId,
      passageId: bar.startPassageId,
      startOffset: bar.startOffset,
      endOffset: bar.endOffset,
    };
    setSelectionBar(null);
    window.getSelection()?.removeAllRanges();
    onStartXrefPick?.(from);
  }

  // Creates selection A (the "from") using stored pick-from data
  // Find an existing selection covering the same range so a highlight cross-referenced
  // (or also tagged/noted) more than once shares one selection row instead of duplicating it.
  async function findSelectionIdByAnchor(passageId: string, startOffset: number, endOffset: number): Promise<string | null> {
    const { data } = await supabase
      .from('selections').select('id')
      .eq('user_id', userId)
      .eq('passage_id', passageId)
      .eq('start_offset', startOffset)
      .eq('end_offset', endOffset)
      .limit(1);
    return data?.[0]?.id ?? null;
  }

  async function createSelectionFrom(from: XRefPickFrom): Promise<string> {
    const existing = await findSelectionIdByAnchor(from.startPassageId, from.startOffset, from.endOffset);
    if (existing) return existing;
    const now = new Date().toISOString();
    const [{ data: pidRow }, { data: bookRow }] = await Promise.all([
      supabase.from('passage_pid_map').select('pid').eq('passage_id', from.startPassageId).maybeSingle(),
      supabase.from('book_slug_map').select('local_id').eq('book_id', from.bookId).maybeSingle(),
    ]);
    const { data, error } = await supabase
      .from('selections')
      .insert({
        user_id:               userId,
        passage_id:            from.startPassageId,
        start_pid:             pidRow?.pid ?? null,
        end_pid:               pidRow?.pid ?? null,
        book_local_id:         bookRow?.local_id ?? null,
        anchor_schema_version: 1,
        start_offset:          from.startOffset,
        end_offset:            from.endOffset,
        snapshot_text:         from.text,
        created_at:            now,
        updated_at:            now,
      })
      .select('id')
      .single();
    if (error) throw error;
    return data.id;
  }

  // Called when user clicks a passage while in pick mode
  async function handlePickPassage(targetPassageId: string, targetContent: string) {
    if (!xrefPickFrom || !userId || pickSaving) return;
    const from = xrefPickFrom;
    const sameBook = from.bookId === target?.bookId;
    setPickSaving(true);
    try {
      const now = new Date().toISOString();

      // Selection A: the user's original text selection
      const selIdA = await createSelectionFrom(from);

      // Selection B: the picked passage (whole passage as snapshot)
      const snapshotText = targetContent.slice(0, 500);
      const [{ data: pidRowB }, { data: passageDataB }] = await Promise.all([
        supabase.from('passage_pid_map').select('pid').eq('passage_id', targetPassageId).maybeSingle(),
        supabase.from('passages').select('book_id').eq('id', targetPassageId).maybeSingle(),
      ]);
      const { data: targetBookRow } = passageDataB?.book_id
        ? await supabase.from('book_slug_map').select('local_id').eq('book_id', passageDataB.book_id).maybeSingle()
        : { data: null };
      const existingB = await findSelectionIdByAnchor(targetPassageId, 0, snapshotText.length);
      let selBId: string;
      if (existingB) {
        selBId = existingB;
      } else {
        const { data: selB } = await supabase.from('selections').insert({
          user_id:               userId,
          passage_id:            targetPassageId,
          start_pid:             pidRowB?.pid ?? null,
          end_pid:               pidRowB?.pid ?? null,
          book_local_id:         targetBookRow?.local_id ?? null,
          anchor_schema_version: 1,
          start_offset:          0,
          end_offset:            snapshotText.length,
          snapshot_text:         snapshotText,
          created_at:            now,
          updated_at:            now,
        }).select('id').single();
        if (!selB) throw new Error('Could not create target selection');
        selBId = selB.id;
      }

      // Xref linking both selections
      const { data: xrefData } = await supabase.from('xrefs').insert({
        user_id:        userId,
        selection_a_id: selIdA,
        selection_b_id: selBId,
        created_at:     now,
        updated_at:     now,
      }).select('id').single();
      if (xrefData) {
        await pushXref({ id: xrefData.id, user_id: userId, selection_a_id: selIdA, selection_b_id: selBId, updated_at: now }).catch(() => {});
        // Auto-generate label in background
        supabase.functions.invoke('generate-xref-label', {
          body: { text_a: from.text, text_b: snapshotText },
        }).then(async ({ data }) => {
          if (data?.label) {
            await supabase.from('xrefs').update({ label: data.label }).eq('id', xrefData.id);
          }
        }).catch(() => {});
      }

      // Navigate back to the original passage
      onXrefPickDone?.();

      // For same-book picks, loadBook won't re-fire so reload annotations explicitly
      if (sameBook) {
        loadAnnotations(passages.map(p => p.id)).catch(() => {});
      }
    } catch (err) {
      console.error('[ReaderPanel] handlePickPassage failed:', err);
    } finally {
      setPickSaving(false);
    }
  }

  // Called when user clicks "Pick as X-Ref" in the selection bar while in pick mode.
  // Uses the selected text (potentially spanning multiple passages) as selection B.
  async function handlePickFromSelection() {
    const bar = selectionBar;
    if (!bar || !xrefPickFrom || !userId || pickSaving) return;
    const from = xrefPickFrom;
    const sameBook = from.bookId === target?.bookId;
    setPickSaving(true);
    setSelectionBar(null);
    window.getSelection()?.removeAllRanges();
    try {
      const now = new Date().toISOString();

      // Selection A: the user's original text selection
      const selIdA = await createSelectionFrom(from);

      // Selection B: the selected text in the target passage(s)
      const snapshotText = bar.text.slice(0, 500);
      const [{ data: pidRowB }, { data: passageDataB }] = await Promise.all([
        supabase.from('passage_pid_map').select('pid').eq('passage_id', bar.startPassageId).maybeSingle(),
        supabase.from('passages').select('book_id').eq('id', bar.startPassageId).maybeSingle(),
      ]);
      // Resolve end_pid separately when the selection spans multiple passages
      const { data: endPidRow } = bar.endPassageId !== bar.startPassageId
        ? await supabase.from('passage_pid_map').select('pid').eq('passage_id', bar.endPassageId).maybeSingle()
        : { data: pidRowB };
      const { data: targetBookRow } = passageDataB?.book_id
        ? await supabase.from('book_slug_map').select('local_id').eq('book_id', passageDataB.book_id).maybeSingle()
        : { data: null };
      const existingB = await findSelectionIdByAnchor(bar.startPassageId, bar.startOffset, bar.endOffset);
      let selBId: string;
      if (existingB) {
        selBId = existingB;
      } else {
        const { data: selB } = await supabase.from('selections').insert({
          user_id:               userId,
          passage_id:            bar.startPassageId,
          start_pid:             pidRowB?.pid ?? null,
          end_pid:               endPidRow?.pid ?? null,
          book_local_id:         targetBookRow?.local_id ?? null,
          anchor_schema_version: 1,
          start_offset:          bar.startOffset,
          end_offset:            bar.endOffset,
          snapshot_text:         snapshotText,
          created_at:            now,
          updated_at:            now,
        }).select('id').single();
        if (!selB) throw new Error('Could not create target selection');
        selBId = selB.id;
      }

      // Xref linking both selections
      const { data: xrefData } = await supabase.from('xrefs').insert({
        user_id:        userId,
        selection_a_id: selIdA,
        selection_b_id: selBId,
        created_at:     now,
        updated_at:     now,
      }).select('id').single();
      if (xrefData) {
        await pushXref({ id: xrefData.id, user_id: userId, selection_a_id: selIdA, selection_b_id: selBId, updated_at: now }).catch(() => {});
        supabase.functions.invoke('generate-xref-label', {
          body: { text_a: from.text, text_b: snapshotText },
        }).then(async ({ data }) => {
          if (data?.label) {
            await supabase.from('xrefs').update({ label: data.label }).eq('id', xrefData.id);
          }
        }).catch(() => {});
      }

      onXrefPickDone?.();
      if (sameBook) {
        loadAnnotations(passages.map(p => p.id)).catch(() => {});
      }
    } catch (err) {
      console.error('[ReaderPanel] handlePickFromSelection failed:', err);
    } finally {
      setPickSaving(false);
    }
  }

  function scrollToPassage(passageId: string) {
    document.getElementById(`p-${passageId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTocOpen(false);
  }

  if (!target) {
    return (
      <div className="h-full flex items-center justify-center text-gray-300">
        <div className="text-center">
          <div className="text-5xl mb-3">✦</div>
          <p className="text-sm">Select a book to begin reading</p>
        </div>
      </div>
    );
  }

  useEffect(() => {
    if (!target?.bookId) return;
    try {
      const raw = localStorage.getItem(`immerse.toc.collapsed.${target.bookId}`);
      setCollapsedToc(raw ? new Set(JSON.parse(raw)) : new Set());
    } catch { setCollapsedToc(new Set()); }
  }, [target?.bookId]);

  function toggleTocSection(key: string) {
    setCollapsedToc(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      try { localStorage.setItem(`immerse.toc.collapsed.${target?.bookId}`, JSON.stringify([...next])); } catch {}
      return next;
    });
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#1B6B7B] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  let lastChapter = '';
  let lastSection = '';
  const isPrayerStyle = !!target?.bookId && PRAYER_STYLE_BOOKS.has(target.bookId);
  const isLayoutStyle = !isPrayerStyle && !!target?.bookId && PRAYER_LAYOUT_BOOKS.has(target.bookId);
  let lastPrayerSection = '';

  // Build collapsible TOC rows: each depth-1 entry is keyed to its parent section
  // (depth-0 passageId); hide children of collapsed sections.
  const tocSectionChildren = new Set<string>();
  {
    let cur: string | null = null;
    for (const e of toc) { if (!e.depth) cur = e.passageId; else if (cur) tocSectionChildren.add(cur); }
  }
  const tocDisplay: { entry: TocEntry; i: number; key: string; isSection: boolean; hasChildren: boolean }[] = [];
  {
    let cur: string | null = null;
    toc.forEach((entry, i) => {
      if (!entry.depth) {
        cur = entry.passageId;
        tocDisplay.push({ entry, i, key: entry.passageId, isSection: true, hasChildren: tocSectionChildren.has(entry.passageId) });
      } else {
        const key = cur ?? entry.passageId;
        if (!collapsedToc.has(key)) tocDisplay.push({ entry, i, key, isSection: false, hasChildren: false });
      }
    });
  }

  return (
    <div className="h-full flex flex-col relative" ref={readerRef}>
      {/* TOC button */}
      {toc.length > 0 && (
        <button
          onClick={() => setTocOpen(o => !o)}
          className="absolute top-4 right-4 z-20 p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
          title="Table of Contents"
        >
          <svg width="20" height="20" viewBox="0 0 22 22" fill="none">
            <circle cx="3" cy="4"  r="1.5" fill="currentColor" className="text-gray-600" />
            <line x1="6" y1="4"  x2="20" y2="4"  stroke="currentColor" strokeWidth="1.2" className="text-gray-600" />
            <circle cx="3" cy="9"  r="1.5" fill="currentColor" className="text-gray-600" />
            <line x1="6" y1="9"  x2="20" y2="9"  stroke="currentColor" strokeWidth="1.2" className="text-gray-600" />
            <circle cx="3" cy="14" r="1.5" fill="currentColor" className="text-gray-600" />
            <line x1="6" y1="14" x2="20" y2="14" stroke="currentColor" strokeWidth="1.2" className="text-gray-600" />
          </svg>
        </button>
      )}

      {/* TOC panel */}
      {tocOpen && (
        <>
          <div className="absolute inset-0 z-10" onClick={() => setTocOpen(false)} />
          <div className="absolute top-12 right-4 z-20 w-72 max-h-[768px] overflow-y-auto bg-white rounded-xl shadow-xl border border-gray-200">
            <div className="px-4 py-3 border-b border-gray-100 font-semibold text-sm text-gray-700">
              Table of Contents
            </div>
            {tocDisplay.map(({ entry, i, key, hasChildren }) => (
              <div key={i} className="flex items-stretch border-b border-gray-50 last:border-0">
                <button
                  onClick={() => scrollToPassage(entry.passageId)}
                  className={`flex-1 text-left py-2.5 text-sm hover:bg-gray-50 transition-colors ${
                    entry.depth ? 'pl-10 pr-2 text-gray-500' : 'px-4 text-gray-700 font-medium'
                  }`}
                >
                  {entry.label}
                </button>
                {hasChildren && (
                  <button
                    onClick={() => toggleTocSection(key)}
                    className="w-10 shrink-0 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors"
                    title={collapsedToc.has(key) ? 'Expand' : 'Collapse'}
                    aria-label={collapsedToc.has(key) ? 'Expand section' : 'Collapse section'}
                  >
                    <span className={`text-base inline-block transition-transform duration-150 ${collapsedToc.has(key) ? '' : 'rotate-90'}`}>›</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Selection action bar */}
      {selectionBar && (
        <div
          ref={selectionBarRef}
          className="absolute z-30 flex items-center bg-gray-900 rounded-2xl px-1.5 py-1.5 shadow-xl"
          style={{ left: Math.max(8, selectionBar.x - 150), top: Math.max(8, selectionBar.y) }}
        >
          {(editingSel
            ? [{ label: savingEdit ? 'Updating…' : 'Update selection', onClick: confirmEditSelection }]
            : xrefPickFrom
            ? [{ label: 'Pick as X-Ref', onClick: handlePickFromSelection }]
            : [
                { label: 'Tag',  onClick: () => openPanel('tag') },
                { label: 'Note', onClick: () => openPanel('note') },
                { label: 'Xref', onClick: handleXrefStart },
                { label: 'AI',   onClick: () => openPanel('ai') },
                { label: 'Copy', onClick: handleCopy },
              ]
          ).map(({ label, onClick }, i, arr) => (
            <div key={label} className="flex items-center">
              <button
                onClick={onClick}
                disabled={savingAnnotation || pickSaving || savingEdit}
                className="px-[15px] py-[7px] text-sm font-medium text-white hover:bg-white/20 rounded-xl transition-colors disabled:opacity-50"
              >
                {label}
              </button>
              {i < arr.length - 1 && <div className="w-px h-4 bg-white/20" />}
            </div>
          ))}
        </div>
      )}

      {/* Edit-text-selection banner */}
      {editingSel && (
        <div className="shrink-0 bg-[#1B6B7B]/10 border-b border-[#1B6B7B]/20 px-5 py-3 flex items-center justify-between gap-3 z-10">
          <p className="flex-1 min-w-0 text-sm text-[#1B6B7B]">
            Highlight the new text for this annotation, then choose <span className="font-semibold">Update selection</span>.
          </p>
          <button
            onClick={cancelEditSelection}
            className="shrink-0 text-sm text-gray-500 hover:text-gray-700 font-medium"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Xref pick-mode banner */}
      {xrefPickFrom && (
        <div className="shrink-0 bg-[#1B6B7B]/10 border-b border-[#1B6B7B]/20 px-5 py-3 flex items-center justify-between gap-3 z-10">
          <div className="flex-1 min-w-0">
            {pickSaving ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-[#1B6B7B] border-t-transparent rounded-full animate-spin shrink-0" />
                <span className="text-sm text-[#1B6B7B] font-medium">Saving cross-reference…</span>
              </div>
            ) : (
              <>
                <p className="text-sm font-semibold text-[#1B6B7B]">Select text or click a passage to link</p>
                <p className="text-xs text-gray-500 truncate mt-0.5">
                  "{xrefPickFrom.text.length > 80 ? xrefPickFrom.text.slice(0, 80) + '…' : xrefPickFrom.text}"
                </p>
              </>
            )}
          </div>
          {!pickSaving && (
            <button
              onClick={onXrefPickDone}
              className="shrink-0 text-xs text-gray-500 hover:text-gray-700 font-medium px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      )}

      {/* PDF viewer */}
      {pdfUrl && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {book && (
            <div className="px-6 py-3 border-b border-gray-100 shrink-0">
              <h1 className="text-base font-semibold text-gray-900 truncate">{book.title}</h1>
            </div>
          )}
          <embed src={pdfUrl} type="application/pdf" className="flex-1 w-full" />
        </div>
      )}

      {/* Passage content */}
      {!pdfUrl && <div ref={scrollRef} className="flex-1 overflow-y-auto" onMouseUp={isImported ? undefined : handleMouseUp}>
        <div className="max-w-[70ch] mx-auto px-8 py-12">
          {book && (
            <div className="mb-12 text-center">
              <h1 className="text-2xl font-semibold text-gray-900 leading-snug">{book.title}</h1>
              {book.authorName && <p className="text-sm text-gray-400 mt-2">{book.authorName}</p>}
            </div>
          )}

          {passages.map(passage => {
            const showChapter = passage.chapter_label && passage.chapter_label !== lastChapter;
            const showSection = passage.section_title && passage.section_title !== lastSection;
            if (showChapter) lastChapter = passage.chapter_label!;
            if (showSection) lastSection = passage.section_title!;

            // Prayer-style books: split "Section, Title" into a centered divider +
            // title, and peel a trailing attribution off the body.
            let prayerSection: string | null = null;
            let prayerTitle: string | null = null;
            let showPrayerDivider = false;
            let bodyText = passage.content;
            let attribution: string | null = null;
            if (isPrayerStyle) {
              if (passage.chapter_label) {
                const ci = passage.chapter_label.indexOf(', ');
                prayerSection = ci !== -1 ? passage.chapter_label.slice(0, ci) : null;
                prayerTitle   = ci !== -1 ? passage.chapter_label.slice(ci + 2) : passage.chapter_label;
                if (showChapter && prayerSection && prayerSection !== lastPrayerSection) {
                  showPrayerDivider = true;
                  lastPrayerSection = prayerSection;
                }
              }
              const m = passage.content.match(ATTRIBUTION_RE);
              if (m) { attribution = m[1]; bodyText = passage.content.slice(0, m.index!); }
            }

            // Letter date-lines ("19 December 1922 …") render as bold sub-headings.
            const isLetterDate = /^\d{1,2}\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}/.test(passage.content);

            return (
              <div key={passage.id} id={`p-${passage.id}`} data-pid={passage.id}>
                {isPrayerStyle ? (
                  <>
                    {showPrayerDivider && (
                      <div className="flex items-center gap-3 mt-12 mb-1">
                        <span className="flex-1 h-px bg-[#1B6B7B]/25" />
                        <span className="text-sm font-semibold uppercase tracking-[0.14em] text-[#1B6B7B]">{prayerSection}</span>
                        <span className="flex-1 h-px bg-[#1B6B7B]/25" />
                      </div>
                    )}
                    {showChapter && prayerTitle && (
                      <h2 className="text-center text-xl font-semibold text-gray-900 mt-3 mb-1">
                        {prayerTitle}
                      </h2>
                    )}
                    {showSection && (
                      <h3 className="text-center text-xs font-normal text-gray-400 uppercase tracking-wide mb-5">
                        {passage.section_title}
                      </h3>
                    )}
                  </>
                ) : isLayoutStyle ? (
                  <>
                    {showChapter && passage.chapter_label && (
                      <div className="flex items-center gap-3 mt-12 mb-1">
                        <span className="flex-1 h-px bg-[#1B6B7B]/25" />
                        <span className="text-sm font-semibold uppercase tracking-[0.14em] text-[#1B6B7B]">{passage.chapter_label}</span>
                        <span className="flex-1 h-px bg-[#1B6B7B]/25" />
                      </div>
                    )}
                    {showSection && (
                      <h2 className="text-center text-xl font-semibold text-gray-900 mt-3 mb-4">
                        {passage.section_title}
                      </h2>
                    )}
                  </>
                ) : (
                  <>
                    {showChapter && (
                      <div className="flex items-center gap-3 mt-12 mb-4">
                        <span className="flex-1 h-px bg-[#1B6B7B]/25" />
                        <span className="text-sm font-semibold uppercase tracking-[0.14em] text-[#1B6B7B]">{passage.chapter_label}</span>
                        <span className="flex-1 h-px bg-[#1B6B7B]/25" />
                      </div>
                    )}
                    {showSection && (
                      <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wide text-center mt-8 mb-3">
                        {passage.section_title}
                      </h3>
                    )}
                  </>
                )}
                <div
                  className="relative"
                  onClick={undefined}
                >
                  {!isImported && (taggedPassageIds.has(passage.id) || notedPassageIds.has(passage.id) || xrefPassageIds.has(passage.id)) && (
                    <div className="absolute -left-8 top-1 flex flex-col gap-1">
                      {taggedPassageIds.has(passage.id) && (
                        <button
                          onClick={e => { e.stopPropagation(); handleTagIconClick(passage.id); }}
                          className="w-8 h-8 flex items-center justify-center cursor-pointer hover:opacity-60 active:opacity-40 transition-opacity"
                          title="View tags"
                        >
                          <TagIcon size={20} />
                        </button>
                      )}
                      {notedPassageIds.has(passage.id) && (
                        <button
                          onClick={e => { e.stopPropagation(); handleNoteIconClick(passage.id); }}
                          className="w-8 h-8 flex items-center justify-center cursor-pointer hover:opacity-60 active:opacity-40 transition-opacity"
                          title="View note"
                        >
                          <NoteIcon size={20} />
                        </button>
                      )}
                      {xrefPassageIds.has(passage.id) && (
                        <button
                          onClick={e => { e.stopPropagation(); handleXrefIconClick(passage.id); }}
                          className="w-8 h-8 flex items-center justify-center cursor-pointer hover:opacity-60 active:opacity-40 transition-opacity"
                          title="View cross-references"
                        >
                          <XRefIcon size={20} />
                        </button>
                      )}
                    </div>
                  )}
                  {passage.paragraph_number != null && !isLetterDate && (
                    <span className="absolute -right-8 top-[3px] text-[11px] text-gray-300 select-none w-7 text-right leading-relaxed tabular-nums">
                      {passage.paragraph_number}
                    </span>
                  )}
                  <p
                    data-pid={passage.id}
                    className={`font-serif text-gray-800 leading-relaxed mb-4${isLetterDate ? ' font-bold mt-6' : ''}${isPrayerStyle ? ' whitespace-pre-line' : ''}${isPrayerStyle && !passage.chapter_label ? ' italic text-center' : ''}`}
                    style={{ fontSize: 'var(--quote-font-size)' }}
                  >
                    <PassageContent
                      text={bodyText}
                      onFootnoteClick={n => {
                        setActiveFootnote({ num: n, text: footnoteMap[n] ?? '' });
                      }}
                      highlight={searchHighlight?.passageId === passage.id ? searchHighlight.query : undefined}
                    />
                    {attribution && (
                      <span className="block text-right italic text-gray-500 mt-2">{attribution}</span>
                    )}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>}

      {/* Footnote panel */}
      {activeFootnote && (
        <>
          <div className="absolute inset-0 z-30" onClick={() => setActiveFootnote(null)} />
          <div className="absolute bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 shadow-xl rounded-t-2xl px-6 py-5 min-h-[40vh] max-h-[60vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="text-xs font-bold text-[#1B6B7B] uppercase tracking-widest mb-2 block">
                  Footnote {activeFootnote.num}
                </span>
                <p className="text-sm text-gray-700 leading-relaxed">
                  {activeFootnote.text || <span className="text-gray-400">Footnote text not available in the web version.</span>}
                </p>
              </div>
              <button
                onClick={() => setActiveFootnote(null)}
                className="text-gray-400 hover:text-gray-600 text-lg shrink-0 mt-0.5"
              >
                ✕
              </button>
            </div>
          </div>
        </>
      )}

      {/* Sign-in prompt for guests */}
      <PanelSheet visible={activePanel === 'signin'} onClose={closePanel} title="Sign In Required">
        <div className="px-5 py-8 text-center">
          <div className="text-4xl mb-4">✦</div>
          <p className="text-sm text-gray-600 leading-relaxed mb-6">
            Sign in to tag, annotate, and save passages across all your devices.
          </p>
          <a
            href="/login"
            className="block w-full bg-[#1B6B7B] text-white font-semibold py-3 rounded-xl hover:bg-[#155a68] transition-colors text-sm"
          >
            Sign In or Create Account
          </a>
        </div>
      </PanelSheet>

      {/* Annotation panels */}
      <TagPanel
        visible={activePanel === 'tag'}
        onClose={closePanel}
        userId={userId}
        selectionText={selectionBar?.text ?? ''}
        onSave={handleTagSave}
      />
      <NotePanel
        visible={activePanel === 'note'}
        onClose={closePanel}
        selectionText={selectionBar?.text ?? ''}
        onSave={handleNoteSave}
      />
      <AiPanel
        visible={activePanel === 'ai'}
        onClose={closePanel}
        selectionText={selectionBar?.text ?? ''}
        bookTitle={book?.title ?? ''}
        authorName={book?.authorName ?? ''}
        isPro={isPro}
      />

      {/* Tags view panel — opened by tapping the 🏷 margin icon */}
      {(() => {
        const data = annotationPanel?.type === 'tags' ? passageToTags.get(annotationPanel.passageId) : undefined;
        return (
          <PanelSheet
            visible={annotationPanel?.type === 'tags'}
            onClose={closeAnnotationPanel}
            title="Tags"
          >
            {data && (
              <div className="pt-4 pb-4">
                <div className="mx-5 mb-1 px-3 py-2.5 bg-gray-50 rounded-xl border border-gray-100">
                  <p className="font-serif text-xs text-gray-500 line-clamp-2">"{data.snapshotText}"</p>
                </div>
                <button
                  onClick={() => startEditSelection([data.selectionId], { type: 'tags', passageId: annotationPanel!.passageId })}
                  className="mx-5 mb-3 text-xs text-[#1B6B7B] font-medium hover:underline"
                >
                  Edit text selection
                </button>
                {data.tags.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">No tags on this selection.</p>
                ) : (
                  <div>
                    {data.tags.map(tag => (
                      <TagViewNode
                        key={tag.id}
                        tag={tag}
                        allTags={allTags}
                        depth={0}
                        fetchQuotes={fetchTagQuotes}
                        onOpenBook={onOpenBook ? (bookId, passageId) => { onOpenBook(bookId, passageId); closeAnnotationPanel(); } : undefined}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </PanelSheet>
        );
      })()}

      {/* Note edit panel — opened by tapping the 📝 margin icon */}
      {(() => {
        const data = annotationPanel?.type === 'note' ? passageToNote.get(annotationPanel.passageId) : undefined;
        return (
          <PanelSheet
            visible={annotationPanel?.type === 'note'}
            onClose={closeAnnotationPanel}
            title="Note"
            footer={
              <div className="flex gap-3">
                <button
                  onClick={handleDeleteNote}
                  className="px-4 py-2.5 rounded-xl border border-red-200 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  Delete
                </button>
                <button
                  onClick={handleSaveEditNote}
                  className="flex-1 py-2.5 rounded-xl bg-[#1B6B7B] text-white text-sm font-semibold hover:bg-[#155a68] transition-colors"
                >
                  Save
                </button>
              </div>
            }
          >
            {data && (
              <div className="px-5 pt-4 pb-2">
                <div className="mb-1 px-3 py-2.5 bg-gray-50 rounded-xl border border-gray-100">
                  <p className="font-serif text-xs text-gray-500 line-clamp-2">"{data.snapshotText}"</p>
                </div>
                <button
                  onClick={() => startEditSelection([data.selectionId], { type: 'note', passageId: annotationPanel!.passageId })}
                  className="mb-4 text-xs text-[#1B6B7B] font-medium hover:underline"
                >
                  Edit text selection
                </button>
                <textarea
                  autoFocus
                  value={editNoteContent}
                  onChange={e => setEditNoteContent(e.target.value)}
                  rows={5}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-[#1B6B7B]/30 focus:border-[#1B6B7B] resize-none leading-relaxed"
                />
              </div>
            )}
          </PanelSheet>
        );
      })()}

      {/* Xref view panel — opened by tapping the chain-link margin icon */}
      {(() => {
        const entries = annotationPanel?.type === 'xrefs' ? (passageToXrefs.get(annotationPanel.passageId) ?? []) : [];
        const thisSnap = entries[0]?.thisSnapshotText ?? '';
        // Edit re-anchors the source quote shown at top. One highlight can spawn a
        // duplicate source selection per xref, so gather every source selection covering
        // the same range (offsets) as the displayed quote and move them all together.
        // Matching on offsets (not snapshot text) avoids touching a different highlight
        // that happens to share identical text.
        const first = entries[0];
        const editSelIds = first
          ? [...new Set(
              entries
                .filter(e => e.thisStartOffset === first.thisStartOffset && e.thisEndOffset === first.thisEndOffset)
                .map(e => e.thisSelectionId),
            )]
          : [];
        return (
          <PanelSheet
            visible={annotationPanel?.type === 'xrefs'}
            onClose={closeAnnotationPanel}
            title="Cross-Reference"
          >
            <div className="px-5 pt-4 pb-4">
              {thisSnap && (
                <div className="mb-1 px-3 py-2.5 bg-gray-50 rounded-xl border border-gray-100">
                  <p className="text-xs text-gray-500 line-clamp-2">"{thisSnap}"</p>
                </div>
              )}
              {editSelIds.length > 0 && (
                <button
                  onClick={() => startEditSelection(editSelIds, { type: 'xrefs', passageId: annotationPanel!.passageId })}
                  className="mb-4 text-xs text-[#1B6B7B] font-medium hover:underline"
                >
                  Edit text selection
                </button>
              )}
              {entries.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">No cross-references found.</p>
              ) : (
                <div className="space-y-3">
                  {entries.map(entry => (
                    <XrefEntryBlock
                      key={entry.xrefId}
                      entry={entry}
                      onOpenBook={onOpenBook ? (bookId, passageId) => { onOpenBook(bookId, passageId); closeAnnotationPanel(); } : undefined}
                      onDelete={() => handleDeleteXref(annotationPanel!.passageId, entry.xrefId)}
                    />
                  ))}
                </div>
              )}
            </div>
          </PanelSheet>
        );
      })()}
    </div>
  );
}
