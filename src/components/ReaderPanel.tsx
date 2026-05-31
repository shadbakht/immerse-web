'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { ReaderTarget } from './AppShell';

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
}

// Render passage content, turning [n] markers into superscripts
function PassageContent({ text }: { text: string }) {
  const parts = text.split(/(\[\d+\])/g);
  return (
    <>
      {parts.map((part, i) => {
        const match = part.match(/^\[(\d+)\]$/);
        if (match) {
          return (
            <sup key={i} className="text-[10px] text-[#1B6B7B] font-medium ml-0.5 select-none">
              {match[1]}
            </sup>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

export default function ReaderPanel({ target, userId }: ReaderPanelProps) {
  const supabase = createClient();
  const [passages, setPassages] = useState<Passage[]>([]);
  const [book, setBook] = useState<BookMeta | null>(null);
  const [loading, setLoading] = useState(false);
  const [tocOpen, setTocOpen] = useState(false);
  const [toc, setToc] = useState<TocEntry[]>([]);
  const [selectionBar, setSelectionBar] = useState<SelectionBar | null>(null);
  const [savingAnnotation, setSavingAnnotation] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const readerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!target?.bookId) return;
    setTocOpen(false);
    setSelectionBar(null);
    loadBook(target.bookId, target.passageId);
  }, [target?.bookId]);

  async function loadBook(bookId: string, scrollToId?: string) {
    setLoading(true);
    setPassages([]);
    setBook(null);
    try {
      const [{ data: bookData }, { data: passageData }] = await Promise.all([
        supabase.from('books').select('title, authors(name)').eq('id', bookId).single(),
        supabase
          .from('passages')
          .select('id, content, chapter_label, section_title, paragraph_number, sort_order')
          .eq('book_id', bookId)
          .order('sort_order'),
      ]);

      if (bookData) {
        setBook({ title: bookData.title, authorName: (bookData.authors as any)?.name ?? '' });
      }

      const ps: Passage[] = passageData ?? [];
      setPassages(ps);

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

      if (scrollToId) {
        setTimeout(() => {
          document.getElementById(`p-${scrollToId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
      } else {
        scrollRef.current?.scrollTo({ top: 0 });
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

  async function createSelectionRecord(bar: SelectionBar) {
    const { data, error } = await supabase
      .from('selections')
      .insert({
        user_id:       userId,
        passage_id:    bar.startPassageId,
        start_offset:  bar.startOffset,
        end_offset:    bar.endOffset,
        snapshot_text: bar.text,
        created_at:    new Date().toISOString(),
      })
      .select('id')
      .single();
    if (error) throw error;
    return data.id;
  }

  async function handleCopy() {
    if (!selectionBar) return;
    await navigator.clipboard.writeText(selectionBar.text);
    setSelectionBar(null);
    window.getSelection()?.removeAllRanges();
  }

  async function handleAddTag() {
    if (!selectionBar || !target) return;
    setSavingAnnotation(true);
    try {
      const selId = await createSelectionRecord(selectionBar);
      // Open tag panel — for now alert, full tag picker coming soon
      alert(`Selection saved (id: ${selId}). Tag picker coming soon!`);
    } catch (e: any) {
      alert('Could not save selection: ' + e.message);
    } finally {
      setSavingAnnotation(false);
      setSelectionBar(null);
      window.getSelection()?.removeAllRanges();
    }
  }

  async function handleAddNote() {
    if (!selectionBar || !target) return;
    const noteText = prompt('Enter your note:');
    if (!noteText?.trim()) return;
    setSavingAnnotation(true);
    try {
      const selId = await createSelectionRecord(selectionBar);
      await supabase.from('notes').insert({
        user_id:      userId,
        selection_id: selId,
        content:      noteText.trim(),
        created_at:   new Date().toISOString(),
        updated_at:   new Date().toISOString(),
      });
    } catch (e: any) {
      alert('Could not save note: ' + e.message);
    } finally {
      setSavingAnnotation(false);
      setSelectionBar(null);
      window.getSelection()?.removeAllRanges();
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
          className="absolute top-4 right-4 z-20 px-3 py-1.5 text-xs font-medium text-[#1B6B7B] bg-white border border-[#1B6B7B]/30 rounded-lg hover:bg-[#1B6B7B]/5 transition-colors shadow-sm"
        >
          Contents
        </button>
      )}

      {/* TOC panel */}
      {tocOpen && (
        <>
          <div className="absolute inset-0 z-10" onClick={() => setTocOpen(false)} />
          <div className="absolute top-12 right-4 z-20 w-72 max-h-96 overflow-y-auto bg-white rounded-xl shadow-xl border border-gray-200">
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
          className="absolute z-30 flex items-center gap-1 bg-gray-900 rounded-xl px-2 py-1.5 shadow-xl"
          style={{ left: selectionBar.x - 80, top: Math.max(8, selectionBar.y) }}
        >
          <button
            onClick={handleCopy}
            className="px-2.5 py-1 text-xs text-white hover:bg-white/20 rounded-lg transition-colors"
          >
            Copy
          </button>
          <div className="w-px h-4 bg-white/20" />
          <button
            onClick={handleAddTag}
            disabled={savingAnnotation}
            className="px-2.5 py-1 text-xs text-white hover:bg-white/20 rounded-lg transition-colors disabled:opacity-50"
          >
            Tag
          </button>
          <div className="w-px h-4 bg-white/20" />
          <button
            onClick={handleAddNote}
            disabled={savingAnnotation}
            className="px-2.5 py-1 text-xs text-white hover:bg-white/20 rounded-lg transition-colors disabled:opacity-50"
          >
            Note
          </button>
          <div className="w-px h-4 bg-white/20" />
          <button
            onClick={() => { setSelectionBar(null); window.getSelection()?.removeAllRanges(); }}
            className="px-1.5 py-1 text-xs text-white/50 hover:text-white hover:bg-white/20 rounded-lg transition-colors"
          >
            ✕
          </button>
        </div>
      )}

      {/* Passage content */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto" onMouseUp={handleMouseUp}>
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
              <div key={passage.id} id={`p-${passage.id}`}>
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
                <p
                  data-pid={passage.id}
                  className="text-gray-800 leading-relaxed mb-4 text-[17px]"
                >
                  <PassageContent text={passage.content} />
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
