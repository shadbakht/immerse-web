'use client';

import { useEffect, useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { fetchSelectionsByUser } from '@/lib/fetchAnnotationSelections';
import { pushTag, deleteRemote } from '@/lib/annotationSync';
import { ContextMenu, type MenuOption } from './ContextMenu';

interface TagRow { id: string; name: string; created_at: string; is_public: boolean; selections: SelRow[]; }
interface SelRow  { id: string; snapshot_text: string; passage_id: string; book_id: string; citation: string; }

interface TagsScreenProps {
  userId: string;
  onOpenBook: (bookId: string, passageId?: string) => void;
}

function Highlight({ text, q }: { text: string; q: string }) {
  if (!q.trim()) return <>{text}</>;
  const pat = new RegExp(`(${q.trim().split(/\s+/).map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
  return <>{text.split(pat).map((p, i) => pat.test(p) ? <mark key={i} className="bg-yellow-100 text-yellow-900 rounded px-0.5">{p}</mark> : <span key={i}>{p}</span>)}</>;
}

function PassageRow({ sel, searchQuery, onOpenBook }: { sel: SelRow; searchQuery: string; onOpenBook: (b: string, p?: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="px-5 py-3 border-t border-gray-100">
      <p className="text-xs text-[#1B6B7B] font-medium mb-1 truncate">
        <Highlight text={sel.citation} q={searchQuery} />
      </p>
      <div className="cursor-pointer select-none" onClick={() => setExpanded(v => !v)}>
        <p className={`text-sm text-gray-700 leading-relaxed ${expanded ? '' : 'line-clamp-3'}`}>
          "<Highlight text={sel.snapshot_text} q={searchQuery} />"
        </p>
      </div>
      {expanded && sel.book_id && (
        <button
          onClick={() => onOpenBook(sel.book_id, sel.passage_id)}
          className="mt-2 text-xs text-[#1B6B7B] font-medium hover:underline"
        >
          Open in reader →
        </button>
      )}
    </div>
  );
}

function TagCard({ tag, searchQuery, onOpenBook, onDelete, onRename, onToggleVisibility }: { tag: TagRow; searchQuery: string; onOpenBook: (b: string, p?: string) => void; onDelete: (id: string) => void; onRename: (id: string, name: string) => void; onToggleVisibility: (id: string, isPublic: boolean) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState(tag.name);

  const menuOptions: MenuOption[] = [
    {
      label: 'Rename',
      icon: '✏️',
      onClick: () => setRenaming(true),
    },
    {
      label: tag.is_public ? 'Set Private' : 'Set Public',
      icon: tag.is_public ? '🔓' : '🔒',
      onClick: () => onToggleVisibility(tag.id, !tag.is_public),
    },
    {
      label: 'Delete',
      icon: '🗑️',
      color: 'danger',
      onClick: () => {
        if (confirm(`Delete tag "${tag.name}"?`)) onDelete(tag.id);
      },
    },
  ];

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {renaming && (
        <div className="fixed inset-0 bg-black/30 z-40 flex items-center justify-center" onClick={() => setRenaming(false)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-sm mx-4 p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Rename Tag</h2>
            <input
              autoFocus
              value={newName}
              onChange={e => setNewName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B6B7B]/30 mb-4"
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  onRename(tag.id, newName);
                  setRenaming(false);
                } else if (e.key === 'Escape') {
                  setRenaming(false);
                  setNewName(tag.name);
                }
              }}
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setRenaming(false); setNewName(tag.name); }} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
              <button onClick={() => { onRename(tag.id, newName); setRenaming(false); }} className="px-4 py-2 text-sm bg-[#1B6B7B] text-white rounded-lg hover:bg-[#1B6B7B]/90">Save</button>
            </div>
          </div>
        </div>
      )}
      <div
        className="px-5 py-4 flex items-center gap-3 cursor-pointer select-none hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded(v => !v)}
      >
        <span className="text-[#3B82F6] text-lg inline-block scale-x-[-1] shrink-0">🏷</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">
            <Highlight text={tag.name} q={searchQuery} />
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {tag.selections.length} passage{tag.selections.length !== 1 ? 's' : ''}
          </p>
        </div>
        <span className={`text-gray-400 text-xl shrink-0 transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`} style={{ display: 'inline-block' }}>›</span>
        <div onClick={e => e.stopPropagation()}>
          <ContextMenu options={menuOptions} />
        </div>
      </div>
      {expanded && (
        <div>
          {tag.selections.length === 0
            ? <p className="px-5 py-3 text-xs text-gray-400 border-t border-gray-100">No passages tagged.</p>
            : tag.selections.map(sel => (
                <PassageRow key={sel.id} sel={sel} searchQuery={searchQuery} onOpenBook={onOpenBook} />
              ))}
        </div>
      )}
    </div>
  );
}

export default function TagsScreen({ userId, onOpenBook }: TagsScreenProps) {
  const supabase = createClient();
  const [tags, setTags] = useState<TagRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => { if (userId) load(); }, [userId]);

  async function load() {
    setLoading(true);
    try {
      const [{ data: tagData }, selMap] = await Promise.all([
        supabase.from('tags').select('id, name, created_at, is_public').eq('user_id', userId).order('created_at', { ascending: false }),
        fetchSelectionsByUser(userId),
      ]);
      const tagList = tagData ?? [];
      if (!tagList.length) { setTags([]); return; }

      const tagIds = tagList.map((t: any) => t.id);
      const selIds = Object.keys(selMap);
      const { data: stData } = await supabase
        .from('selection_tags').select('tag_id, selection_id')
        .in('tag_id', tagIds).in('selection_id', selIds);

      const selsByTag: Record<string, SelRow[]> = {};
      for (const st of (stData ?? []) as any[]) {
        const s = selMap[st.selection_id];
        if (!s) continue;
        (selsByTag[st.tag_id] ??= []).push({ id: st.selection_id, ...s });
      }
      setTags((tagList as any[]).map(t => ({ ...t, selections: selsByTag[t.id] ?? [], is_public: t.is_public ?? false })));
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteTag(id: string) {
    await deleteRemote('tags', id).catch(() => {});
    setTags(tags.filter(t => t.id !== id));
  }

  async function handleRenameTag(id: string, newName: string) {
    if (newName.trim()) {
      const tag = tags.find(t => t.id === id);
      if (tag) {
        await pushTag({
          id: tag.id,
          user_id: userId,
          name: newName.trim(),
          is_public: tag.is_public,
          updated_at: new Date().toISOString(),
        }).catch(() => {});
        setTags(tags.map(t => t.id === id ? { ...t, name: newName.trim() } : t));
      }
    }
  }

  async function handleToggleVisibility(id: string, isPublic: boolean) {
    const tag = tags.find(t => t.id === id);
    if (tag) {
      await pushTag({
        id: tag.id,
        user_id: userId,
        name: tag.name,
        is_public: isPublic,
        updated_at: new Date().toISOString(),
      }).catch(() => {});
      setTags(tags.map(t => t.id === id ? { ...t, is_public: isPublic } : t));
    }
  }

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return tags;
    return tags.filter(t =>
      t.name.toLowerCase().includes(q) ||
      t.selections.some(s => s.snapshot_text.toLowerCase().includes(q) || s.citation.toLowerCase().includes(q))
    );
  }, [tags, searchQuery]);

  return (
    <div className="h-full flex flex-col max-w-2xl mx-auto w-full">
      <div className="px-6 pt-8 pb-4 shrink-0">
        <h1 className="text-2xl font-semibold text-gray-900 mb-4">Tags</h1>
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" /></svg>
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search tags and passages…" className="w-full pl-9 pr-4 py-2 text-sm text-gray-900 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#1B6B7B]/30 focus:border-[#1B6B7B] bg-gray-50" />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-6 pb-8">
        {loading ? (
          <div className="flex justify-center py-16"><div className="w-6 h-6 border-2 border-[#1B6B7B] border-t-transparent rounded-full animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-16">{searchQuery ? 'No tags match your search.' : 'No tags yet. Select a passage in the reader to tag it.'}</p>
        ) : (
          <div className="space-y-3">
            {filtered.map(tag => (
              <TagCard
                key={tag.id}
                tag={tag}
                searchQuery={searchQuery}
                onOpenBook={onOpenBook}
                onDelete={handleDeleteTag}
                onRename={handleRenameTag}
                onToggleVisibility={handleToggleVisibility}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
