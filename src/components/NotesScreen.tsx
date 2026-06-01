'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface NoteRow {
  noteId:        string;
  content:       string;
  updatedAt:     string;
  snapshotText:  string;
  citation:      string;
  passageId:     string;
  bookId:        string;
}

interface NotesScreenProps {
  userId:     string;
  onOpenBook: (bookId: string, passageId?: string) => void;
}

export default function NotesScreen({ userId, onOpenBook }: NotesScreenProps) {
  const supabase = createClient();
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (userId) load();
  }, [userId]);

  async function load() {
    setLoading(true);
    try {
      // 1. Fetch notes (user_id filter satisfies RLS)
      const { data: noteData } = await supabase
        .from('notes')
        .select('id, content, updated_at, selection_id')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });
      const noteList = noteData ?? [];
      if (noteList.length === 0) { setNotes([]); return; }

      // 2. Fetch related selections via user_id (avoids cross-table RLS issues)
      const { data: selData } = await supabase
        .from('selections')
        .select('id, snapshot_text, passage_id, book_id, passages(chapter_label, section_title, paragraph_number, books(id, title, authors(name)))')
        .eq('user_id', userId);
      const selMap: Record<string, any> = {};
      for (const s of (selData ?? []) as any[]) selMap[s.id] = s;

      setNotes((noteList as any[]).map((n: any) => {
        const sel     = selMap[n.selection_id];
        const passage = sel?.passages;
        const book    = passage?.books;
        const parts   = [
          (book?.authors as any)?.name, book?.title,
          passage?.chapter_label || passage?.section_title,
          passage?.paragraph_number ? `p.${passage.paragraph_number}` : null,
        ].filter(Boolean);
        return {
          noteId:       n.id,
          content:      n.content,
          updatedAt:    n.updated_at,
          snapshotText: sel?.snapshot_text ?? '',
          citation:     parts.join(', '),
          passageId:    sel?.passage_id ?? '',
          bookId:       book?.id ?? sel?.book_id ?? '',
        };
      }));
    } finally {
      setLoading(false);
    }
  }

  function formatDate(iso: string) {
    const d = new Date(iso);
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 3600)   return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400)  return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  function highlight(text: string, q: string) {
    if (!q.trim()) return <span>{text}</span>;
    const words = q.trim().split(/\s+/).filter(Boolean);
    const pattern = new RegExp(`(${words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
    const parts = text.split(pattern);
    return (
      <>
        {parts.map((p, i) =>
          pattern.test(p)
            ? <mark key={i} className="bg-yellow-100 text-yellow-900 rounded px-0.5">{p}</mark>
            : <span key={i}>{p}</span>
        )}
      </>
    );
  }

  const filtered = notes.filter(n =>
    !searchQuery.trim() ||
    n.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
    n.snapshotText.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="h-full flex flex-col max-w-2xl mx-auto w-full">
      {/* Header */}
      <div className="px-6 pt-8 pb-4 shrink-0">
        <h1 className="text-2xl font-semibold text-gray-900 mb-4">Notes</h1>
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search notes…"
            className="w-full pl-9 pr-4 py-2 text-sm text-gray-900 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#1B6B7B]/30 focus:border-[#1B6B7B] bg-gray-50"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-6 pb-8">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-6 h-6 border-2 border-[#1B6B7B] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !userId ? (
          <p className="text-sm text-gray-400 text-center py-16">Sign in to see your notes.</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-16">
            {searchQuery ? 'No notes match your search.' : 'No notes yet. Select a passage in the reader to add one.'}
          </p>
        ) : (
          <div className="space-y-3">
            {filtered.map(note => {
              const isExpanded = expandedIds.has(note.noteId);
              return (
                <div
                  key={note.noteId}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
                >
                  <button
                    className="w-full text-left px-5 py-4"
                    onClick={() => setExpandedIds(prev => {
                      const next = new Set(prev);
                      next.has(note.noteId) ? next.delete(note.noteId) : next.add(note.noteId);
                      return next;
                    })}
                  >
                    {/* Selection quote */}
                    <p className="text-xs text-gray-400 italic mb-2 leading-relaxed" style={{ display: '-webkit-box', WebkitLineClamp: isExpanded ? undefined : 2, WebkitBoxOrient: 'vertical', overflow: isExpanded ? 'visible' : 'hidden' } as any}>
                      "{highlight(note.snapshotText, searchQuery)}"
                    </p>

                    {/* Note content */}
                    <p className="text-sm text-gray-800 leading-relaxed mb-3" style={{ display: '-webkit-box', WebkitLineClamp: isExpanded ? undefined : 2, WebkitBoxOrient: 'vertical', overflow: isExpanded ? 'visible' : 'hidden' } as any}>
                      {highlight(note.content, searchQuery)}
                    </p>

                    {/* Citation + date */}
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-[#1B6B7B] truncate">{note.citation}</p>
                      <p className="text-xs text-gray-300 shrink-0">{formatDate(note.updatedAt)}</p>
                    </div>
                  </button>

                  {/* Open in reader — shown when expanded */}
                  {isExpanded && note.bookId && (
                    <div className="px-5 pb-4 border-t border-gray-50 pt-3">
                      <button
                        onClick={() => onOpenBook(note.bookId, note.passageId)}
                        className="text-xs text-[#1B6B7B] font-medium hover:underline"
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
    </div>
  );
}
