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

function PassageContent({ text, onFootnoteClick }: { text: string; onFootnoteClick: (n: string) => void }) {
  const parts = text.replace(/\/\*[^*]*\*\//g, '').split(/(\[\d+\])/g);
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

export default function ReaderPanel({ target, userId }: ReaderPanelProps) {
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const readerRef = useRef<HTMLDivElement>(null);
  const selectionBarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!target?.bookId) return;
    setTocOpen(false);
    setSelectionBar(null);
    loadBook(target.bookId, target.passageId);
  }, [target?.bookId]);

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
    setLoading(true);
    setPassages([]);
    setBook(null);
    try {
      const [{ data: bookData }, { data: passageData }] = await Promise.all([
        supabase.from('books').select('title, authors(name), footnotes').eq('id', bookId).single(),
        supabase
          .from('passages')
          .select('id, content, chapter_label, section_title, paragraph_number, sort_order')
          .eq('book_id', bookId)
          .order('sort_order'),
      ]);

      if (bookData) {
        setBook({ title: bookData.title, authorName: (bookData.authors as any)?.name ?? '' });
        setFootnoteMap((bookData as any).footnotes ?? {});
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
    const passage = passages.find(p => p.id === selectionBar.startPassageId);
    const location = passage?.chapter_label || passage?.section_title || null;
    const para = passage?.paragraph_number ? `¶${passage.paragraph_number}` : null;
    const citationParts = [book?.authorName, book?.title, location, para].filter(Boolean);
    const citation = citationParts.length ? `— ${citationParts.join(', ')}` : '';
    const textToCopy = citation ? `"${selectionBar.text}"\n${citation}` : selectionBar.text;
    await navigator.clipboard.writeText(textToCopy);
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
          ref={selectionBarRef}
          className="absolute z-30 flex items-center bg-gray-900 rounded-2xl px-1.5 py-1.5 shadow-xl"
          style={{ left: Math.max(8, selectionBar.x - 150), top: Math.max(8, selectionBar.y) }}
        >
          {[
            { label: 'Tag',  onClick: handleAddTag },
            { label: 'Note', onClick: handleAddNote },
            { label: 'Xref', onClick: () => alert('Xref coming soon') },
            { label: 'AI',   onClick: () => alert('AI summary coming soon') },
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
                  <PassageContent
                    text={passage.content}
                    onFootnoteClick={n => {
                      const text = footnoteMap[n];
                      if (text) setActiveFootnote({ num: n, text });
                    }}
                  />
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footnote panel */}
      {activeFootnote && (
        <>
          <div className="absolute inset-0 z-30" onClick={() => setActiveFootnote(null)} />
          <div className="absolute bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 shadow-xl rounded-t-2xl px-6 py-5 max-h-52 overflow-y-auto">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="text-xs font-bold text-[#1B6B7B] uppercase tracking-widest mb-2 block">
                  Footnote {activeFootnote.num}
                </span>
                <p className="text-sm text-gray-700 leading-relaxed">{activeFootnote.text}</p>
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
    </div>
  );
}
