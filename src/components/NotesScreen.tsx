'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { fetchSelectionsByUser } from '@/lib/fetchAnnotationSelections';
import { pushNote, deleteRemote } from '@/lib/annotationSync';
import { ContextMenu, type MenuOption } from './ContextMenu';
import { loadCatalog, loadSlugMaps, type CatalogCategory, type CatalogBook } from '@/lib/catalog';
import { Highlight } from './Highlight';
import { AnnotationCard } from './AnnotationCard';

interface NoteRow {
  noteId:       string;
  content:      string;
  updatedAt:    string;
  snapshotText: string;
  citation:     string;
  passageId:    string;
  bookId:       string;   // Supabase UUID
  bookSlug:     string;   // corpus slug (catalog key)
  bookTitle:    string;
  rootCatId:    string;
  rootCatName:  string;
  rootCatSort:  number;
}

interface NotesScreenProps {
  userId: string;
  onOpenBook: (bookId: string, passageId?: string) => void;
}

function formatDate(iso: string) {
  const d = new Date(iso), diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 3600)   return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function NoteItem({
  note, searchQuery, onOpenBook, onDelete, onEdit,
}: {
  note: NoteRow;
  searchQuery: string;
  onOpenBook: (b: string, p?: string) => void;
  onDelete: (id: string) => void;
  onEdit:   (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const menuOptions: MenuOption[] = [
    { label: 'Edit', icon: '✏️', onClick: () => onEdit(note.noteId) },
    { label: 'Delete', icon: '🗑️', color: 'danger', onClick: () => { if (confirm('Delete this note?')) onDelete(note.noteId); } },
  ];

  return (
    <div className="px-4 py-1.5">
      <AnnotationCard
        variant="note"
        quote={note.snapshotText}
        citation={note.citation}
        date={formatDate(note.updatedAt)}
        query={searchQuery}
        onClick={() => setExpanded(v => !v)}
        action={<ContextMenu options={menuOptions} />}
        footer={note.bookId ? (
          <button
            onClick={e => { e.stopPropagation(); onOpenBook(note.bookId, note.passageId); }}
            className="mt-2 text-xs text-[#1B6B7B] dark:text-[#2D9DB3] font-medium hover:underline"
          >
            Open in reader →
          </button>
        ) : undefined}
      >
        <p className={`text-sm text-gray-800 dark:text-[#D2DCE8] leading-relaxed mt-1.5 ${expanded ? '' : 'line-clamp-2'}`}>
          <Highlight text={note.content} q={searchQuery} />
        </p>
      </AnnotationCard>
    </div>
  );
}

export default function NotesScreen({ userId, onOpenBook }: NotesScreenProps) {
  const supabase = createClient();
  const [notes, setNotes]               = useState<NoteRow[]>([]);
  const [loading, setLoading]           = useState(true);
  const [searchQuery, setSearchQuery]   = useState('');
  const [openTraditions, setOpenTraditions] = useState<Set<string>>(new Set());
  const [openBooks, setOpenBooks]           = useState<Set<string>>(new Set());
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  useEffect(() => { if (userId) load(); }, [userId]);

  // Keep a stable ref so the Realtime callback always calls the latest load()
  const loadRef = useRef(load);
  useEffect(() => { loadRef.current = load; });

  // Realtime: re-fetch when notes change on any other platform
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`notes-live-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notes', filter: `user_id=eq.${userId}` },
        () => { loadRef.current().catch(() => {}); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  async function load() {
    setLoading(true);
    try {
      const [{ data: noteData }, selMap, catalog, { uuidToSlug }] = await Promise.all([
        supabase.from('notes').select('id, content, updated_at, selection_id').eq('user_id', userId).order('updated_at', { ascending: false }),
        fetchSelectionsByUser(userId),
        loadCatalog(),
        loadSlugMaps(supabase),
      ]);

      // Build catalog lookup maps
      const catMap   = new Map<string, CatalogCategory>(catalog.categories.map(c => [c.id, c]));
      const bookMap  = new Map<string, CatalogBook>(catalog.books.map(b => [b.id, b]));

      const getRootCat = (catId: string): CatalogCategory | null => {
        let c = catMap.get(catId);
        while (c?.parentId) c = catMap.get(c.parentId) ?? undefined as any;
        return c ?? null;
      };

      const loaded: NoteRow[] = [];
      for (const n of (noteData ?? []) as any[]) {
        const sel      = selMap[n.selection_id];
        if (!sel) continue;
        const bookUuid = sel.book_id;
        const bookSlug = uuidToSlug.get(bookUuid) ?? '';
        const catBook  = bookSlug ? bookMap.get(bookSlug) : null;
        const root     = catBook ? getRootCat(catBook.categoryId) : null;

        loaded.push({
          noteId:      n.id,
          content:     n.content,
          updatedAt:   n.updated_at,
          snapshotText: sel.snapshot_text,
          citation:    sel.citation,
          passageId:   sel.passage_id,
          bookId:      bookUuid,
          bookSlug,
          bookTitle:   catBook?.title ?? '',
          rootCatId:   root?.id   ?? 'uncategorized',
          rootCatName: root?.name ?? 'Other',
          rootCatSort: root?.sortOrder ?? 9999,
        });
      }
      setNotes(loaded);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteNote(id: string) {
    await deleteRemote('notes', id).catch(() => {});
    setNotes(prev => prev.filter(n => n.noteId !== id));
  }

  async function handleEditNote(id: string) {
    const note = notes.find(n => n.noteId === id);
    if (note) { setEditingId(id); setEditContent(note.content); }
  }

  async function handleSaveEdit(id: string) {
    if (!editContent.trim()) return;
    const note = notes.find(n => n.noteId === id);
    if (note) {
      await pushNote({
        id: note.noteId, user_id: userId,
        selection_id: '', content: editContent.trim(),
        updated_at: new Date().toISOString(),
      }).catch(() => {});
      setNotes(prev => prev.map(n => n.noteId === id ? { ...n, content: editContent.trim() } : n));
    }
    setEditingId(null);
    setEditContent('');
  }

  // Filter notes by search
  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter(n =>
      n.content.toLowerCase().includes(q) ||
      n.snapshotText.toLowerCase().includes(q) ||
      n.citation.toLowerCase().includes(q),
    );
  }, [notes, searchQuery]);

  // Build Tradition → Book → Notes hierarchy
  const hierarchy = useMemo(() => {
    type BookEntry = { title: string; notes: NoteRow[] };
    type TradEntry = { name: string; sort: number; books: Map<string, BookEntry> };

    const tradMap = new Map<string, TradEntry>();
    for (const row of filtered) {
      let trad = tradMap.get(row.rootCatId);
      if (!trad) {
        trad = { name: row.rootCatName, sort: row.rootCatSort, books: new Map() };
        tradMap.set(row.rootCatId, trad);
      }
      let book = trad.books.get(row.bookSlug || row.bookId);
      if (!book) {
        book = { title: row.bookTitle || row.bookId, notes: [] };
        trad.books.set(row.bookSlug || row.bookId, book);
      }
      book.notes.push(row);
    }

    // Notes within each book: most-recently-updated first
    for (const trad of tradMap.values()) {
      for (const book of trad.books.values()) {
        book.notes.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      }
    }

    return [...tradMap.entries()]
      .sort(([, a], [, b]) => a.sort !== b.sort ? a.sort - b.sort : a.name.localeCompare(b.name))
      .map(([catId, trad]) => ({
        catId,
        name: trad.name,
        books: [...trad.books.entries()]
          .sort(([, a], [, b]) => a.title.localeCompare(b.title))
          .map(([bookKey, book]) => ({ bookKey, ...book })),
      }));
  }, [filtered]);

  // A "small" tradition expands all the way (books + their notes) on a single
  // tap, so the user doesn't have to tap the tradition then each book. Applies
  // when it has ≤5 books and no book has >5 notes; larger ones keep the
  // tap-tradition-then-tap-book behavior.
  const SMALL_MAX = 5;
  const toggleTradition = (trad: { catId: string; books: { bookKey: string; notes: NoteRow[] }[] }) => {
    const isOpen = openTraditions.has(trad.catId);
    setOpenTraditions(prev => { const next = new Set(prev); isOpen ? next.delete(trad.catId) : next.add(trad.catId); return next; });
    if (!isOpen && trad.books.length <= SMALL_MAX && trad.books.every(b => b.notes.length <= SMALL_MAX)) {
      setOpenBooks(prev => { const next = new Set(prev); trad.books.forEach(b => next.add(b.bookKey)); return next; });
    }
  };

  const toggleBook = (bookKey: string) =>
    setOpenBooks(prev => { const next = new Set(prev); next.has(bookKey) ? next.delete(bookKey) : next.add(bookKey); return next; });

  return (
    <div className="h-full flex flex-col max-w-2xl mx-auto w-full">
      {/* Edit modal */}
      {editingId && (
        <div className="fixed inset-0 bg-black/30 z-40 flex items-center justify-center"
          onClick={() => { setEditingId(null); setEditContent(''); }}>
          <div className="bg-white dark:bg-[#1B2A38] rounded-2xl shadow-xl max-w-md mx-4 p-6 max-h-[80vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-[#E2EAF2] mb-4">Edit Note</h2>
            <textarea
              autoFocus
              value={editContent}
              onChange={e => setEditContent(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 dark:border-[#2D4050] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B6B7B]/30 dark:focus:ring-[#2D9DB3]/30 mb-4 min-h-32 resize-none"
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setEditingId(null); setEditContent(''); }}
                className="px-4 py-2 text-sm text-gray-600 dark:text-[#8FA4B8] hover:bg-gray-100 dark:hover:bg-[#2D4050] rounded-lg">Cancel</button>
              <button onClick={() => handleSaveEdit(editingId)}
                className="px-4 py-2 text-sm bg-[#1B6B7B] dark:bg-[#2D9DB3] text-white rounded-lg hover:bg-[#1B6B7B]/90 dark:hover:bg-[#2D9DB3]/90">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Header + search */}
      <div className="px-4 pt-4 pb-3 border-b border-gray-100 dark:border-[#2D4050] shrink-0">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-[#E2EAF2] mb-3">Notes</h1>
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-[#5C7A8E] w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search notes…"
            className="w-full pl-9 pr-14 py-2 text-sm text-gray-900 dark:text-[#E2EAF2] border border-gray-200 dark:border-[#2D4050] rounded-xl outline-none focus:ring-2 focus:ring-[#1B6B7B]/30 dark:focus:ring-[#2D9DB3]/30 focus:border-[#1B6B7B] dark:focus:border-[#2D9DB3] bg-gray-50 dark:bg-[#243040]"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-[#1B6B7B] dark:text-[#2D9DB3] hover:text-[#0f4a56]">Clear</button>
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
          <p className="text-sm text-gray-400 dark:text-[#5C7A8E] text-center py-16 px-4">
            {searchQuery ? 'No notes match your search.' : 'No notes yet. Select a passage in the reader to add one.'}
          </p>
        ) : (
          <div>
            {hierarchy.map(trad => {
              const tradOpen   = openTraditions.has(trad.catId);
              const totalNotes = trad.books.reduce((s, b) => s + b.notes.length, 0);
              return (
                <div key={trad.catId}>
                  {/* Tradition header */}
                  <button
                    className="w-full flex items-center gap-2 px-4 py-3.5 hover:bg-gray-50 dark:hover:bg-[#243040] transition-colors text-left select-none border-b border-gray-100 dark:border-[#2D4050]"
                    onClick={() => toggleTradition(trad)}
                  >
                    <span className="flex-1 text-sm font-medium text-gray-800 dark:text-[#D2DCE8] truncate">{trad.name}</span>
                    <span className="text-xs text-gray-400 dark:text-[#5C7A8E] shrink-0">{totalNotes}</span>
                    <span className={`text-gray-400 dark:text-[#5C7A8E] text-sm shrink-0 transition-transform duration-150 inline-block ${tradOpen ? 'rotate-90' : ''}`}>›</span>
                  </button>

                  {tradOpen && trad.books.map(book => {
                    const bookOpen = openBooks.has(book.bookKey);
                    return (
                      <div key={book.bookKey}>
                        {/* Book sub-header */}
                        <button
                          className="w-full flex items-center gap-2 pl-8 pr-4 py-3 hover:bg-gray-50 dark:hover:bg-[#243040] transition-colors text-left select-none border-b border-gray-100 dark:border-[#2D4050]"
                          onClick={() => toggleBook(book.bookKey)}
                        >
                          <span className="flex-1 text-sm text-gray-700 dark:text-[#B8C7D6] truncate">{book.title}</span>
                          <span className="text-xs text-gray-400 dark:text-[#5C7A8E] shrink-0">{book.notes.length}</span>
                          <span className={`text-gray-400 dark:text-[#5C7A8E] text-sm shrink-0 transition-transform duration-150 inline-block ${bookOpen ? 'rotate-90' : ''}`}>›</span>
                        </button>

                        {/* Note items */}
                        {bookOpen && book.notes.map(note => (
                          <NoteItem
                            key={note.noteId}
                            note={note}
                            searchQuery={searchQuery}
                            onOpenBook={onOpenBook}
                            onDelete={handleDeleteNote}
                            onEdit={handleEditNote}
                          />
                        ))}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
