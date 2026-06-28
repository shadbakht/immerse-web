'use client';

import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { fetchSelectionsByUser } from '@/lib/fetchAnnotationSelections';
import { pushTag, deleteRemote } from '@/lib/annotationSync';
import { publishTag, unpublishTag } from '@/lib/communitySync';
import { exportAsDocx, exportAsPdf, type TagRow, type SelRow } from '@/lib/tagExport';
import { ContextMenu, type MenuOption } from './ContextMenu';

interface TagsScreenProps {
  userId: string;
  onOpenBook: (bookId: string, passageId?: string) => void;
}

type CheckState = 'checked' | 'indeterminate' | 'unchecked';

function Checkbox({ state, onChange }: { state: CheckState; onChange: () => void }) {
  return (
    <button
      onClick={e => { e.stopPropagation(); onChange(); }}
      className="flex items-center justify-center shrink-0 w-8 h-8 -ml-1"
    >
      <div className={`w-[18px] h-[18px] rounded border-2 flex items-center justify-center transition-colors ${
        state === 'checked'       ? 'bg-[#1B6B7B] border-[#1B6B7B]' :
        state === 'indeterminate' ? 'border-[#1B6B7B]' : 'border-gray-300 dark:border-white/15'
      }`}>
        {state === 'checked'       && <span className="text-white text-[10px] leading-none font-bold">✓</span>}
        {state === 'indeterminate' && <div className="w-2 h-0.5 bg-[#1B6B7B] rounded-full" />}
      </div>
    </button>
  );
}

function Highlight({ text, q }: { text: string; q: string }) {
  if (!q.trim()) return <>{text}</>;
  const pat = new RegExp(`(${q.trim().split(/\s+/).map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
  return <>{text.split(pat).map((p, i) => pat.test(p) ? <mark key={i} className="bg-yellow-100 text-yellow-900 rounded px-0.5">{p}</mark> : <span key={i}>{p}</span>)}</>;
}

function PassageRow({ sel, searchQuery, onOpenBook, onRemove }: { sel: SelRow; searchQuery: string; onOpenBook: (b: string, p?: string) => void; onRemove: () => void }) {
  const [expanded, setExpanded] = useState(false);

  const menuOptions: MenuOption[] = [
    {
      label: 'Remove from tag',
      icon: '✕',
      color: 'danger',
      onClick: () => { if (confirm('Remove this passage from the tag?')) onRemove(); },
    },
  ];

  return (
    <div className="pl-9 pr-4 py-3 border-t border-gray-100 dark:border-white/10 flex items-start gap-2">
      <div className="flex-1 min-w-0">
        <div className="cursor-pointer select-none" onClick={() => setExpanded(v => !v)}>
          <p className={`font-serif text-gray-700 dark:text-gray-300 leading-relaxed ${expanded ? '' : 'line-clamp-3'}`} style={{ fontSize: 'var(--quote-font-size)' }}>
            "<Highlight text={sel.snapshot_text} q={searchQuery} />"
          </p>
        </div>
        <p className="text-xs text-[#1B6B7B] font-medium mt-1">
          <Highlight text={sel.citation} q={searchQuery} />
        </p>
        {expanded && sel.book_id && (
          <button
            onClick={() => onOpenBook(sel.book_id, sel.passage_id)}
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
  );
}

function TagCard({ tag, selectState, onToggleSelect, searchQuery, onOpenBook, onDelete, onRename, onToggleVisibility, onRemovePassage, depth, hasChildren, isOpen, onToggleOpen }: {
  tag: TagRow;
  selectState: CheckState;
  onToggleSelect: () => void;
  searchQuery: string;
  onOpenBook: (b: string, p?: string) => void;
  depth?: number;
  hasChildren?: boolean;
  isOpen?: boolean;
  onToggleOpen?: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onToggleVisibility: (id: string, visibility: string) => void;
  onRemovePassage: (tagId: string, selId: string) => void;
}) {
  const open = isOpen ?? false;
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState(tag.name);

  const menuOptions: MenuOption[] = [
    {
      label: 'Rename',
      icon: '✏️',
      onClick: () => setRenaming(true),
    },
    {
      label: tag.visibility === 'published' ? 'Set Private' : 'Set Public',
      icon: tag.visibility === 'published' ? '🔓' : '🔒',
      onClick: () => onToggleVisibility(tag.id, tag.visibility === 'published' ? 'private' : 'published'),
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

  const indent = (depth ?? 0) * 20;

  const rowPaddingLeft = 12 + (depth ?? 0) * 14;

  return (
    <div className="border-b border-gray-100 dark:border-white/10">
      {renaming && (
        <div className="fixed inset-0 bg-black/30 z-40 flex items-center justify-center" onClick={() => setRenaming(false)}>
          <div className="bg-white dark:bg-[#1b2128] rounded-2xl shadow-xl max-w-sm mx-4 p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Rename Tag</h2>
            <input
              autoFocus
              value={newName}
              onChange={e => setNewName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 dark:border-white/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B6B7B]/30 mb-4"
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
              <button onClick={() => { setRenaming(false); setNewName(tag.name); }} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#272e36] rounded-lg">Cancel</button>
              <button onClick={() => { onRename(tag.id, newName); setRenaming(false); }} className="px-4 py-2 text-sm bg-[#1B6B7B] text-white rounded-lg hover:bg-[#1B6B7B]/90">Save</button>
            </div>
          </div>
        </div>
      )}
      <div
        className="flex items-center py-3.5 pr-4 cursor-pointer select-none hover:bg-gray-50 dark:hover:bg-[#20262d] transition-colors"
        style={{ paddingLeft: rowPaddingLeft }}
        onClick={() => onToggleOpen?.()}
      >
        <Checkbox state={selectState} onChange={onToggleSelect} />
        <span className="flex-1 text-sm font-medium text-gray-800 dark:text-gray-200 truncate ml-1 min-w-0">
          <Highlight text={tag.name} q={searchQuery} />
        </span>
        <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0 mx-2">{tag.selections.length}</span>
        <span className={`text-gray-400 dark:text-gray-500 text-sm shrink-0 transition-transform duration-150 inline-block ${open ? 'rotate-90' : ''}`}>›</span>
        <div onClick={e => e.stopPropagation()} className="ml-2">
          <ContextMenu options={menuOptions} />
        </div>
      </div>
      {open && (
        <div>
          {tag.selections.length === 0
            ? <p className="pl-9 pr-4 py-3 text-xs text-gray-400 dark:text-gray-500 border-t border-gray-100 dark:border-white/10">No passages tagged.</p>
            : tag.selections.map(sel => (
                <PassageRow key={sel.id} sel={sel} searchQuery={searchQuery} onOpenBook={onOpenBook} onRemove={() => onRemovePassage(tag.id, sel.id)} />
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
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set());
  const [openTagIds, setOpenTagIds] = useState<Set<string>>(new Set());
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [includeNotes, setIncludeNotes] = useState(true);
  const [includeXrefs, setIncludeXrefs] = useState(true);
  const [selIdsWithNotes, setSelIdsWithNotes] = useState<Set<string>>(new Set());
  const [selIdsWithXrefs, setSelIdsWithXrefs] = useState<Set<string>>(new Set());
  const exportMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (userId) load(); }, [userId]);

  const loadRef = useRef(load);
  useEffect(() => { loadRef.current = load; });

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`tags-live-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tags', filter: `user_id=eq.${userId}` },
        () => { loadRef.current().catch(() => {}); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  useEffect(() => {
    if (!showExportMenu) return;
    function handleMouseDown(e: MouseEvent) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    }
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [showExportMenu]);

  async function load() {
    setLoading(true);
    try {
      const [{ data: tagData }, selMap] = await Promise.all([
        supabase.from('tags').select('id, name, parent_id, depth, sort_order, created_at, visibility').eq('user_id', userId).order('sort_order', { ascending: true }),
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

      // Check which selection IDs have notes or xrefs (for disabling export toggles)
      const allSelIds = Object.values(selsByTag).flat().map(s => s.id);
      if (allSelIds.length > 0) {
        const [{ data: noteData }, { data: xrefsAData }, { data: xrefsBData }] = await Promise.all([
          supabase.from('notes').select('selection_id').in('selection_id', allSelIds),
          supabase.from('xrefs').select('selection_a_id').in('selection_a_id', allSelIds),
          supabase.from('xrefs').select('selection_b_id').in('selection_b_id', allSelIds),
        ]);
        setSelIdsWithNotes(new Set((noteData ?? []).map((n: any) => n.selection_id as string)));
        setSelIdsWithXrefs(new Set([
          ...(xrefsAData ?? []).map((x: any) => x.selection_a_id as string),
          ...(xrefsBData ?? []).map((x: any) => x.selection_b_id as string),
        ]));
      }

      // Build tree-ordered flat list: top-level first (sort_order), then children under parent
      const tagById = new Map((tagList as any[]).map(t => [t.id, t]));
      const ordered: any[] = [];
      const addTag = (t: any) => {
        ordered.push(t);
        (tagList as any[])
          .filter(c => c.parent_id === t.id)
          .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name))
          .forEach(addTag);
      };
      (tagList as any[])
        .filter(t => !t.parent_id)
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name))
        .forEach(addTag);
      setTags(ordered.map(t => ({ ...t, selections: selsByTag[t.id] ?? [], visibility: t.visibility ?? 'private' })));
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteTag(id: string) {
    const tag = tags.find(t => t.id === id);
    if (tag?.visibility === 'published') {
      await unpublishTag(id, userId).catch(() => {});
    }
    // If this was an imported community tag, drop the subscription so its
    // Import button re-activates in the Community screen.
    await supabase.from('community_tag_subscriptions')
      .delete().eq('subscriber_id', userId).eq('local_tag_id', id).then(undefined, () => {});
    await deleteRemote('tags', id).catch(() => {});
    setTags(tags.filter(t => t.id !== id));
    setSelectedTagIds(prev => { const n = new Set(prev); n.delete(id); return n; });
  }

  async function handleRenameTag(id: string, newName: string) {
    if (newName.trim()) {
      const tag = tags.find(t => t.id === id);
      if (tag) {
        await pushTag({
          id: tag.id,
          user_id: userId,
          name: newName.trim(),
          visibility: tag.visibility,
          updated_at: new Date().toISOString(),
        }).catch(() => {});
        setTags(tags.map(t => t.id === id ? { ...t, name: newName.trim() } : t));
      }
    }
  }

  async function handleRemovePassage(tagId: string, selId: string) {
    try { await supabase.from('selection_tags').delete().eq('tag_id', tagId).eq('selection_id', selId); } catch {}
    setTags(tags.map(t => t.id === tagId ? { ...t, selections: t.selections.filter(s => s.id !== selId) } : t));
  }

  async function handleToggleVisibility(id: string, visibility: string) {
    const tag = tags.find(t => t.id === id);
    if (!tag) return;
    const wasPublished = tag.visibility === 'published';
    await pushTag({
      id: tag.id,
      user_id: userId,
      name: tag.name,
      visibility,
      updated_at: new Date().toISOString(),
    }).catch(() => {});
    setTags(tags.map(t => t.id === id ? { ...t, visibility } : t));

    // Add/remove the community_tags row so Community membership stays in sync.
    try {
      if (visibility === 'published') {
        await publishTag({ id: tag.id, name: tag.name }, userId);
      } else if (wasPublished) {
        await unpublishTag(tag.id, userId);
      }
    } catch (e) {
      console.warn('[Community] publish/unpublish error:', e);
    }
  }

  // Toggle a tag and its whole subtree together (cascade), mirroring the Library
  // checkboxes: if every tag in the subtree is selected, clear them; else select all.
  function toggleSelectTag(id: string) {
    const ids = subtreeIds(id);
    setSelectedTagIds(prev => {
      const allChecked = ids.every(i => prev.has(i));
      const next = new Set(prev);
      if (allChecked) ids.forEach(i => next.delete(i));
      else ids.forEach(i => next.add(i));
      return next;
    });
  }

  async function handleExport(format: 'pdf' | 'docx') {
    setShowExportMenu(false);
    setExporting(true);
    try {
      const selected = tags.filter(t => selectedTagIds.has(t.id));
      const opts = { includeNotes: includeNotes && hasNotesForSelectedTags, includeXrefs: includeXrefs && hasXrefsForSelectedTags };
      if (format === 'pdf')  await exportAsPdf(selected, opts);
      if (format === 'docx') await exportAsDocx(selected, opts);
    } catch (e) {
      console.error('[TagExport] failed:', e);
    } finally {
      setExporting(false);
    }
  }

  // Which tag IDs have at least one child
  const hasChildrenSet = useMemo(() => {
    const s = new Set<string>();
    for (const t of tags) { if (t.parent_id) s.add(t.parent_id); }
    return s;
  }, [tags]);

  // Map each tag to its direct children, for cascading selection over a subtree.
  const childrenByParent = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const t of tags) {
      const p = t.parent_id ?? null;
      if (p) { if (!m.has(p)) m.set(p, []); m.get(p)!.push(t.id); }
    }
    return m;
  }, [tags]);

  // A tag's own id plus all descendant ids (BFS).
  const subtreeIds = useCallback((id: string): string[] => {
    const out = [id];
    const queue = [id];
    while (queue.length) {
      const cur = queue.shift()!;
      for (const c of (childrenByParent.get(cur) ?? [])) { out.push(c); queue.push(c); }
    }
    return out;
  }, [childrenByParent]);

  // Checkbox state for a tag, derived from its subtree (like the Library panel).
  const tagCheckState = useCallback((id: string): CheckState => {
    const ids = subtreeIds(id);
    const n = ids.filter(i => selectedTagIds.has(i)).length;
    if (n === 0) return 'unchecked';
    if (n === ids.length) return 'checked';
    return 'indeterminate';
  }, [subtreeIds, selectedTagIds]);

  // For the export panel: are any of the selected tags' selections linked to notes / xrefs?
  const hasNotesForSelectedTags = useMemo(() =>
    [...selectedTagIds].some(tagId =>
      tags.find(t => t.id === tagId)?.selections.some(s => selIdsWithNotes.has(s.id)) ?? false
    ), [selectedTagIds, tags, selIdsWithNotes]);

  const hasXrefsForSelectedTags = useMemo(() =>
    [...selectedTagIds].some(tagId =>
      tags.find(t => t.id === tagId)?.selections.some(s => selIdsWithXrefs.has(s.id)) ?? false
    ), [selectedTagIds, tags, selIdsWithXrefs]);

  function toggleOpenTag(id: string) {
    setOpenTagIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // When searching: show all matching tags flat. Otherwise: tree-walk, only show subtags whose parent is open.
  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      return tags.filter(t =>
        t.name.toLowerCase().includes(q) ||
        t.selections.some(s => s.snapshot_text.toLowerCase().includes(q) || s.citation.toLowerCase().includes(q))
      );
    }
    // tags is already in tree order from load(), so one pass is enough:
    // include a tag only if it has no parent, or its parent is both in the result AND open
    const inResult = new Set<string>();
    const result: TagRow[] = [];
    for (const tag of tags) {
      const pid = tag.parent_id ?? null;
      if (pid === null || (inResult.has(pid) && openTagIds.has(pid))) {
        result.push(tag);
        inResult.add(tag.id);
      }
    }
    return result;
  }, [tags, openTagIds, searchQuery]);

  return (
    <div className="h-full flex flex-col max-w-2xl mx-auto w-full">
      <div className="px-4 pt-4 pb-3 border-b border-gray-100 dark:border-white/10 shrink-0">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Tags</h1>
          {selectedTagIds.size > 0 && (
            <div className="relative" ref={exportMenuRef}>
              <button
                onClick={() => setShowExportMenu(v => !v)}
                disabled={exporting}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1B6B7B] text-white text-sm font-medium rounded-lg hover:bg-[#1B6B7B]/90 disabled:opacity-60 transition-colors"
                title="Export selected tags"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/>
                  <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                {exporting ? 'Exporting…' : `Export (${selectedTagIds.size})`}
              </button>
              {showExportMenu && (
                <div className="absolute right-0 top-full mt-1 bg-white dark:bg-[#1b2128] rounded-xl shadow-lg border border-gray-200 dark:border-white/10 z-20 min-w-[200px]">
                  <div className="px-4 pt-3 pb-2 border-b border-gray-100 dark:border-white/10">
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 font-semibold uppercase tracking-widest mb-2">Include</p>
                    {([
                      { label: 'Notes',            checked: includeNotes, set: () => setIncludeNotes(v => !v), enabled: hasNotesForSelectedTags },
                      { label: 'Cross-references', checked: includeXrefs, set: () => setIncludeXrefs(v => !v), enabled: hasXrefsForSelectedTags },
                    ]).map(({ label, checked, set, enabled }) => (
                      <div
                        key={label}
                        className={`flex items-center gap-2 py-1 select-none ${enabled ? 'cursor-pointer' : 'cursor-not-allowed opacity-40'}`}
                        onClick={e => { if (!enabled) return; e.stopPropagation(); set(); }}
                        title={enabled ? undefined : `None of the selected tags have ${label.toLowerCase()}`}
                      >
                        <div className={`w-[15px] h-[15px] rounded border-2 flex items-center justify-center transition-colors shrink-0 ${checked && enabled ? 'bg-[#1B6B7B] border-[#1B6B7B]' : 'border-gray-300 dark:border-white/15'}`}>
                          {checked && enabled && <span className="text-white text-[9px] leading-none font-bold">✓</span>}
                        </div>
                        <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
                      </div>
                    ))}
                  </div>
                  <div className="py-1">
                    {([
                      { label: 'PDF',           format: 'pdf'  },
                      { label: 'Word (.docx)',   format: 'docx' },
                    ] as const).map(({ label, format }) => (
                      <button
                        key={format}
                        onClick={() => handleExport(format)}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#20262d] transition-colors"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" /></svg>
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search tags and passages…" className="w-full pl-9 pr-14 py-2 text-sm text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-white/10 rounded-xl outline-none focus:ring-2 focus:ring-[#1B6B7B]/30 focus:border-[#1B6B7B] bg-gray-50 dark:bg-[#20262d]" />
          {(searchQuery || selectedTagIds.size > 0) && (
            <button onClick={() => { setSearchQuery(''); setSelectedTagIds(new Set()); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-[#1B6B7B] hover:text-[#0f4a56]">Clear</button>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center py-16"><div className="w-6 h-6 border-2 border-[#1B6B7B] border-t-transparent rounded-full animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-16 px-4">{searchQuery ? 'No tags match your search.' : 'No tags yet. Select a passage in the reader to tag it.'}</p>
        ) : (
          <div>
            {filtered.map(tag => (
              <TagCard
                key={tag.id}
                tag={tag}
                depth={tag.depth ?? 0}
                hasChildren={hasChildrenSet.has(tag.id)}
                isOpen={openTagIds.has(tag.id)}
                onToggleOpen={() => toggleOpenTag(tag.id)}
                selectState={tagCheckState(tag.id)}
                onToggleSelect={() => toggleSelectTag(tag.id)}
                searchQuery={searchQuery}
                onOpenBook={onOpenBook}
                onDelete={handleDeleteTag}
                onRename={handleRenameTag}
                onToggleVisibility={handleToggleVisibility}
                onRemovePassage={handleRemovePassage}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
