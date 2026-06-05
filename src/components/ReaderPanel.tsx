'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { pushNote, pushXref, deleteRemote } from '@/lib/annotationSync';
import type { ReaderTarget } from './AppShell';
import PanelSheet from './PanelSheet';
import TagPanel from './TagPanel';
import NotePanel from './NotePanel';
import XRefPanel from './XRefPanel';
import AiPanel from './AiPanel';
import { ContextMenu, type MenuOption } from './ContextMenu';
import { TagIcon, NoteIcon, XRefIcon } from './Icons';
import { getLocalBook } from '@/lib/importedBooksDb';

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
}

interface TocEntry {
  label: string;
  passageId: string;
}

interface SelectionBar {
  x: number;
  y: number;
  text: string;
  startPassageId: string;
  startOffset: number;
  endOffset: number;
}

interface ReaderPanelProps {
  target: ReaderTarget;
  userId: string;
  onOpenBook?: (bookId: string, passageId?: string) => void;
}

function PassageContent({ text, onFootnoteClick, highlight }: { text: string; onFootnoteClick: (n: string) => void; highlight?: string }) {
  const clean = text.replace(/\/\*[^*]*\*\//g, '');
  if (highlight) {
    const words = highlight.trim().split(/\s+/).filter(Boolean);
    const pattern = new RegExp(`(${words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
    const parts = clean.split(pattern);
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
  const parts = clean.split(/(\[\d+\])/g);
  return (
    <>
      {parts.map((part, i) => {
        const match = part.match(/^\[(\d+)\]$/);
        if (match) {
          return (
            <sup
              key={i}
              onClick={e => { e.stopPropagation(); onFootnoteClick(match[1]); }}
              className="text-[10px] text-[#1B6B7B] font-medium ml-0.5 cursor-pointer hover:text-[#0f4a56] select-none"
              title={`Footnote ${match[1]}`}
            >
              {match[1]}
            </sup>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

interface XrefViewEntry {
  xrefId: string;
  thisSnapshotText: string;
  otherPassageId: string;
  otherSnapshotText: string;
  otherBookId: string | null;
  otherBookTitle: string;
  otherCitation: string;
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
          <div className="cursor-pointer select-none" onClick={() => setExpanded(v => !v)}>
            <p className={`text-sm text-gray-700 leading-relaxed italic ${expanded ? '' : 'line-clamp-2'}`}>
              "{entry.otherSnapshotText}"
            </p>
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

export default function ReaderPanel({ target, userId, onOpenBook }: ReaderPanelProps) {
  const supabase = createClient();
  const [passages, setPassages] = useState<Passage[]>([]);
  const [book, setBook] = useState<BookMeta | null>(null);
  const [loading, setLoading] = useState(false);
  const [tocOpen, setTocOpen] = useState(false);
  const [toc, setToc] = useState<TocEntry[]>([]);
  const [footnoteMap, setFootnoteMap] = useState<Record<string, string>>({});
  const [activeFootnote, setActiveFootnote] = useState<{ num: string; text: string } | null>(null);
  const [selectionBar, setSelectionBar] = useState<SelectionBar | null>(null);
  const [savingAnnotation, setSavingAnnotation] = useState(false);
  const [activePanel, setActivePanel] = useState<'tag' | 'note' | 'xref' | 'ai' | 'signin' | null>(null);
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
    supabase.from('profiles').select('is_pro').eq('id', userId).single()
      .then(({ data }) => setIsPro(data?.is_pro ?? false));
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

  // Realtime: refresh annotation indicators when selections change for this user.
  // Catches annotations created on mobile while this web session is open.
  useEffect(() => {
    if (!userId || passages.length === 0) return;
    const passageIds = passages.map(p => p.id);
    const channel = supabase
      .channel(`reader-annot-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'selections', filter: `user_id=eq.${userId}` },
        () => { loadAnnotations(passageIds).catch(() => {}); },
      )
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
          setBook({ title: 'Book not found', authorName: '' });
          setLoading(false);
          return;
        }
        setBook({ title: record.title, authorName: '' });
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
        setBook({ title: 'Could not load book', authorName: '' });
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
        supabase.from('books').select('title, authors(name), footnotes').eq('id', bookId).single(),
        fetchAllPassages(),
      ]);

      if (bookData) {
        setBook({ title: bookData.title, authorName: (bookData.authors as any)?.name ?? '' });
        setFootnoteMap((bookData as any).footnotes ?? {});
      }

      const ps: Passage[] = passageData ?? [];
      setPassages(ps);

      // Load existing annotations asynchronously so the book renders immediately.
      if (ps.length > 0) {
        loadAnnotations(ps.map(p => p.id)).catch(() => {});
      }

      // Build TOC from first passage of each unique chapter/section
      const seen = new Set<string>();
      const tocEntries: TocEntry[] = [];
      for (const p of ps) {
        const label = p.chapter_label || p.section_title;
        if (label && !seen.has(label)) {
          seen.add(label);
          tocEntries.push({ label, passageId: p.id });
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
      startOffset: range.startOffset,
      endOffset: range.endOffset,
    });
  }, []);

async function handleCopy() {
    if (!selectionBar) return;
    const passage = passages.find(p => p.id === selectionBar.startPassageId);

    let citation = '';
    if (target?.bookId.startsWith('quran')) {
      const chapterNum = passage?.chapter_label?.match(/\d+/)?.[0] ?? '';
      const verse = passage?.paragraph_number ?? '';
      const loc = chapterNum && verse ? `${chapterNum}:${verse}` : chapterNum || (verse ? String(verse) : '');
      citation = `— ${book?.title ?? "The Qur'an"}${loc ? ` ${loc}` : ''}`;
    } else if (target?.bookId.startsWith('bible-kjv-')) {
      const collectionName = (book?.authorName ?? '').replace(/\s*\(.*?\)\s*/g, '').trim() || 'The Bible';
      const chapterNum = passage?.chapter_label?.match(/\d+/)?.[0] ?? '';
      const verse = passage?.paragraph_number ?? '';
      const loc = chapterNum && verse ? `${chapterNum}:${verse}` : chapterNum || (verse ? String(verse) : '');
      const bookPart = book?.title ? `${book.title}${loc ? ` ${loc}` : ''}` : loc;
      citation = `— ${collectionName}${bookPart ? `, ${bookPart}` : ''}`;
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

  function handleTagIconClick(passageId: string) {
    setAnnotationPanel({ type: 'tags', passageId });
  }

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
      .from('selections').select('id, snapshot_text').eq('user_id', userId).eq('passage_id', passageId);
    const selIds = (sels ?? []).map((s: any) => s.id as string);
    const selSnaps = new Map((sels ?? []).map((s: any) => [s.id as string, (s.snapshot_text as string) ?? '']));
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
    const { data: otherSels } = await supabase
      .from('selections')
      .select('id, snapshot_text, passage_id, passages(chapter_label, section_title, books(id, title))')
      .in('id', otherSelIds);
    const otherSelMap = new Map((otherSels ?? []).map((s: any) => [s.id as string, s]));
    const entries: XrefViewEntry[] = [];
    for (const [xrefId, xref] of xrefById) {
      const thisSelId = selIdSet.has(xref.selection_a_id) ? xref.selection_a_id : xref.selection_b_id;
      const otherSelId = selIdSet.has(xref.selection_a_id) ? xref.selection_b_id : xref.selection_a_id;
      const other = otherSelMap.get(otherSelId) as any;
      if (!other) continue;
      const passage = other.passages as any;
      const bookObj = passage?.books as any;
      const citParts = [bookObj?.title, passage?.chapter_label, passage?.section_title].filter(Boolean);
      entries.push({
        xrefId,
        thisSnapshotText: selSnaps.get(thisSelId) ?? '',
        otherPassageId: other.passage_id,
        otherSnapshotText: other.snapshot_text ?? '',
        otherBookId: bookObj?.id ?? null,
        otherBookTitle: bookObj?.title ?? '',
        otherCitation: citParts.join(' · '),
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

  function openPanel(panel: 'tag' | 'note' | 'xref' | 'ai') {
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

  async function handleXrefSave(targetPassageId: string, targetSnapshotText: string) {
    const selIdA = await createSelection();
    const now = new Date().toISOString();

    // Resolve mobile-compatible anchor for the target passage (parallel fetches)
    const [{ data: targetPidRow }, { data: targetPassageData }] = await Promise.all([
      supabase.from('passage_pid_map').select('pid').eq('passage_id', targetPassageId).maybeSingle(),
      supabase.from('passages').select('book_id').eq('id', targetPassageId).maybeSingle(),
    ]);
    const targetMobilePid = targetPidRow?.pid ?? null;
    const { data: targetBookRow } = targetPassageData?.book_id
      ? await supabase.from('book_slug_map').select('local_id').eq('book_id', targetPassageData.book_id).maybeSingle()
      : { data: null };
    const targetBookLocalId = targetBookRow?.local_id ?? null;

    // Create selection B for the target passage (with full mobile-compatible anchor)
    const { data: selB } = await supabase
      .from('selections')
      .insert({
        user_id:               userId,
        passage_id:            targetPassageId,
        start_pid:             targetMobilePid,
        end_pid:               targetMobilePid,
        book_local_id:         targetBookLocalId,
        anchor_schema_version: 1,
        start_offset:          0,
        end_offset:            targetSnapshotText.length,
        snapshot_text:         targetSnapshotText,
        created_at:            now,
        updated_at:            now,
      })
      .select('id').single();
    if (!selB) throw new Error('Could not create target selection');
    // Create xref
    const { data: xrefData } = await supabase.from('xrefs').insert({ user_id: userId, selection_a_id: selIdA, selection_b_id: selB.id, created_at: now, updated_at: now }).select('id').single();
    // Push xref to sync service
    if (xrefData) {
      await pushXref({
        id: xrefData.id,
        user_id: userId,
        selection_a_id: selIdA,
        selection_b_id: selB.id,
        updated_at: now,
      }).catch(() => {});
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

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#1B6B7B] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  let lastChapter = '';
  let lastSection = '';

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
            {toc.map((entry, i) => (
              <button
                key={i}
                onClick={() => scrollToPassage(entry.passageId)}
                className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 border-b border-gray-50 last:border-0 transition-colors"
              >
                {entry.label}
              </button>
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
          {[
            { label: 'Tag',  onClick: () => openPanel('tag') },
            { label: 'Note', onClick: () => openPanel('note') },
            { label: 'Xref', onClick: () => openPanel('xref') },
            { label: 'AI',   onClick: () => openPanel('ai') },
            { label: 'Copy', onClick: handleCopy },
          ].map(({ label, onClick }, i, arr) => (
            <div key={label} className="flex items-center">
              <button
                onClick={onClick}
                disabled={savingAnnotation}
                className="px-[15px] py-[7px] text-sm font-medium text-white hover:bg-white/20 rounded-xl transition-colors disabled:opacity-50"
              >
                {label}
              </button>
              {i < arr.length - 1 && <div className="w-px h-4 bg-white/20" />}
            </div>
          ))}
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
        <div className="max-w-2xl mx-auto px-8 py-12">
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

            return (
              <div key={passage.id} id={`p-${passage.id}`} data-pid={passage.id}>
                {showChapter && (
                  <h2 className="text-lg font-semibold text-[#1B6B7B] mt-10 mb-4">
                    {passage.chapter_label}
                  </h2>
                )}
                {showSection && (
                  <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wide mt-8 mb-3">
                    {passage.section_title}
                  </h3>
                )}
                <div className="relative">
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
                  {passage.paragraph_number != null && (
                    <span className="absolute -right-8 top-[3px] text-[11px] text-gray-300 select-none w-7 text-right leading-relaxed tabular-nums">
                      {passage.paragraph_number}
                    </span>
                  )}
                  <p
                    data-pid={passage.id}
                    className="text-gray-800 leading-relaxed mb-4 text-[17px]"
                  >
                    <PassageContent
                      text={passage.content}
                      onFootnoteClick={n => {
                        setActiveFootnote({ num: n, text: footnoteMap[n] ?? '' });
                      }}
                      highlight={searchHighlight?.passageId === passage.id ? searchHighlight.query : undefined}
                    />
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
          <div className="absolute bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 shadow-xl rounded-t-2xl px-6 py-5 min-h-[33vh] max-h-[60vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="text-xs font-bold text-[#1B6B7B] uppercase tracking-widest mb-2 block">
                  Footnote {activeFootnote.num}
                </span>
                <p className="text-sm text-gray-700 leading-relaxed">
                  {activeFootnote.text || <span className="text-gray-400 italic">Footnote text not available in the web version.</span>}
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
      <XRefPanel
        visible={activePanel === 'xref'}
        onClose={closePanel}
        selectionText={selectionBar?.text ?? ''}
        onSave={handleXrefSave}
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
              <div className="px-5 pt-4 pb-4">
                <div className="mb-4 px-3 py-2.5 bg-gray-50 rounded-xl border border-gray-100">
                  <p className="text-xs text-gray-500 line-clamp-2 italic">"{data.snapshotText}"</p>
                </div>
                {data.tags.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">No tags on this selection.</p>
                ) : (
                  <div className="space-y-2">
                    {data.tags.map(tag => (
                      <div key={tag.id} className="flex items-center gap-3 px-3 py-2.5 bg-gray-50 rounded-xl border border-gray-100">
                        <TagIcon size={16} />
                        <span className="text-sm font-medium text-gray-800">{tag.name}</span>
                      </div>
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
                <div className="mb-4 px-3 py-2.5 bg-gray-50 rounded-xl border border-gray-100">
                  <p className="text-xs text-gray-500 line-clamp-2 italic">"{data.snapshotText}"</p>
                </div>
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
        return (
          <PanelSheet
            visible={annotationPanel?.type === 'xrefs'}
            onClose={closeAnnotationPanel}
            title="Cross-Reference"
          >
            <div className="px-5 pt-4 pb-4">
              {thisSnap && (
                <div className="mb-4 px-3 py-2.5 bg-gray-50 rounded-xl border border-gray-100">
                  <p className="text-xs text-gray-500 line-clamp-2 italic">"{thisSnap}"</p>
                </div>
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
