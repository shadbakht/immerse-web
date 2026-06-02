'use client';

import { useEffect, useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { fetchSelectionsByUser } from '@/lib/fetchAnnotationSelections';
import { pushNote, deleteRemote } from '@/lib/annotationSync';
import { ContextMenu, type MenuOption } from './ContextMenu';

interface NoteRow {
  noteId: string; content: string; updatedAt: string;
  snapshotText: string; citation: string; passageId: string; bookId: string;
}

interface NotesScreenProps {
  userId: string;
  onOpenBook: (bookId: string, passageId?: string) => void;
}

function Highlight({ text, q }: { text: string; q: string }) {
  if (!q.trim()) return <>{text}</>;
  const pat = new RegExp(`(${q.trim().split(/\s+/).map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
  return <>{text.split(pat).map((p, i) => pat.test(p) ? <mark key={i} className="bg-yellow-100 text-yellow-900 rounded px-0.5">{p}</mark> : <span key={i}>{p}</span>)}</>;
}

function NoteCard({ note, searchQuery, onOpenBook, onDelete, onEdit }: { note: NoteRow; searchQuery: string; onOpenBook: (b: string, p?: string) => void; onDelete: (id: string) => void; onEdit: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);

  function formatDate(iso: string) {
    const d = new Date(iso), diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 3600)   return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400)  return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  const menuOptions: MenuOption[] = [
    {
      label: 'Edit',
      icon: '✏️',
      onClick: () => onEdit(note.noteId),
    },
    {
      label: 'Delete',
      icon: '🗑️',
      color: 'danger',
      onClick: () => {
        if (confirm('Delete this note?')) onDelete(note.noteId);
      },
    },
  ];

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div
        className="px-5 py-4 cursor-pointer select-none hover:bg-gray-50 transition-colors flex items-start gap-3 justify-between"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex-1 min-w-0">
          {/* Citation */}
          {note.citation && (
            <p className="text-xs text-[#1B6B7B] font-medium mb-2 truncate">
              <Highlight text={note.citation} q={searchQuery} />
            </p>
          )}
          {/* Quote */}
          {note.snapshotText && (
            <p className={`text-sm italic text-gray-500 leading-relaxed mb-2 ${expanded ? '' : 'line-clamp-2'}`}>
              "<Highlight text={note.snapshotText} q={searchQuery} />"
            </p>
          )}
          {/* Note content */}
          <p className={`text-sm text-gray-800 leading-relaxed ${expanded ? '' : 'line-clamp-2'}`}>
            <Highlight text={note.content} q={searchQuery} />
          </p>
          <p className="text-xs text-gray-300 mt-2">{formatDate(note.updatedAt)}</p>
        </div>
        <div className="shrink-0" onClick={e => e.stopPropagation()}>
          <ContextMenu options={menuOptions} />
        </div>
      </div>
      {expanded && note.bookId && (
        <div className="px-5 pb-4 border-t border-gray-100 pt-3">
          <button
            onClick={e => { e.stopPropagation(); onOpenBook(note.bookId, note.passageId); }}
            className="text-xs text-[#1B6B7B] font-medium hover:underline"
          >
            Open in reader →
          </button>
        </div>
      )}
    </div>
  );
}

export default function NotesScreen({ userId, onOpenBook }: NotesScreenProps) {
  const supabase = createClient();
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  useEffect(() => { if (userId) load(); }, [userId]);

  async function load() {
    setLoading(true);
    try {
      const [{ data: noteData }, selMap] = await Promise.all([
        supabase.from('notes').select('id, content, updated_at, selection_id').eq('user_id', userId).order('updated_at', { ascending: false }),
        fetchSelectionsByUser(userId),
      ]);
      setNotes((noteData ?? []).map((n: any) => {
        const sel = selMap[n.selection_id] ?? { snapshot_text: '', citation: '', passage_id: '', book_id: '' };
        return { noteId: n.id, content: n.content, updatedAt: n.updated_at, snapshotText: sel.snapshot_text, citation: sel.citation, passageId: sel.passage_id, bookId: sel.book_id };
      }));
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteNote(id: string) {
    await deleteRemote('notes', id).catch(() => {});
    setNotes(notes.filter(n => n.noteId !== id));
  }

  async function handleEditNote(id: string) {
    const note = notes.find(n => n.noteId === id);
    if (note) {
      setEditingId(id);
      setEditContent(note.content);
    }
  }

  async function handleSaveEdit(id: string) {
    if (editContent.trim()) {
      const note = notes.find(n => n.noteId === id);
      if (note) {
        await pushNote({
          id: note.noteId,
          user_id: userId,
          selection_id: '', // We don't have this from the note row alone
          content: editContent.trim(),
          updated_at: new Date().toISOString(),
        }).catch(() => {});
        setNotes(notes.map(n => n.noteId === id ? { ...n, content: editContent.trim() } : n));
      }
      setEditingId(null);
      setEditContent('');
    }
  }

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter(n =>
      n.content.toLowerCase().includes(q) || n.snapshotText.toLowerCase().includes(q) || n.citation.toLowerCase().includes(q)
    );
  }, [notes, searchQuery]);

  return (
    <div className="h-full flex flex-col max-w-2xl mx-auto w-full">
      {editingId && (
        <div className="fixed inset-0 bg-black/30 z-40 flex items-center justify-center" onClick={() => { setEditingId(null); setEditContent(''); }}>
          <div className="bg-white rounded-2xl shadow-xl max-w-md mx-4 p-6 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Edit Note</h2>
            <textarea
              autoFocus
              value={editContent}
              onChange={e => setEditContent(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B6B7B]/30 mb-4 min-h-32 resize-none"
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setEditingId(null); setEditContent(''); }} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
              <button onClick={() => handleSaveEdit(editingId)} className="px-4 py-2 text-sm bg-[#1B6B7B] text-white rounded-lg hover:bg-[#1B6B7B]/90">Save</button>
            </div>
          </div>
        </div>
      )}
      <div className="px-6 pt-8 pb-4 shrink-0">
        <h1 className="text-2xl font-semibold text-gray-900 mb-4">Notes</h1>
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" /></svg>
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search notes…" className="w-full pl-9 pr-4 py-2 text-sm text-gray-900 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#1B6B7B]/30 focus:border-[#1B6B7B] bg-gray-50" />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-6 pb-8">
        {loading ? (
          <div className="flex justify-center py-16"><div className="w-6 h-6 border-2 border-[#1B6B7B] border-t-transparent rounded-full animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-16">{searchQuery ? 'No notes match your search.' : 'No notes yet. Select a passage in the reader to add one.'}</p>
        ) : (
          <div className="space-y-3">
            {filtered.map(note => (
              <NoteCard key={note.noteId} note={note} searchQuery={searchQuery} onOpenBook={onOpenBook} onDelete={handleDeleteNote} onEdit={handleEditNote} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
