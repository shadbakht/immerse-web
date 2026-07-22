'use client';

import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { fetchSelectionsByUser } from '@/lib/fetchAnnotationSelections';
import { pushTag, deleteRemote } from '@/lib/annotationSync';
import { publishTag, unpublishTag } from '@/lib/communitySync';
import { exportAsDocx, exportAsPdf, type TagRow, type SelRow } from '@/lib/tagExport';
import { ContextMenu, type MenuOption } from './ContextMenu';
import { Highlight } from './Highlight';
import { AnnotationCard } from './AnnotationCard';
import { useTranslation } from '@/contexts/LanguageProvider';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Re-parent a tag one level in/out, recomputing the subtree's depth, renumbering
// affected sibling groups, and enforcing depth<5. Returns the updated list +
// changed tags, or null if invalid (first child / already root / exceeds cap).
function computeReparent(tags: TagRow[], tagId: string, dir: 'indent' | 'outdent'):
  { next: TagRow[]; changed: TagRow[] } | null {
  const byId = new Map(tags.map(t => [t.id, { ...t }]));
  const tag = byId.get(tagId);
  if (!tag) return null;
  const sortSibs = (pid: string | null) =>
    tags.filter(t => (t.parent_id ?? null) === pid)
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name));
  const descIds: string[] = [];
  const stack = [tagId];
  while (stack.length) {
    const cur = stack.pop()!;
    for (const c of tags.filter(t => t.parent_id === cur)) { descIds.push(c.id); stack.push(c.id); }
  }
  const oldParentId = tag.parent_id ?? null;

  let newParentId: string | null;
  let delta: number;
  if (dir === 'indent') {
    const sibs = sortSibs(oldParentId);
    const idx = sibs.findIndex(t => t.id === tagId);
    if (idx <= 0) return null;
    newParentId = sibs[idx - 1].id;
    delta = 1;
    const subtreeMax = Math.max(tag.depth, ...descIds.map(id => byId.get(id)!.depth));
    if (subtreeMax + 1 >= 5) return null;
  } else {
    if (oldParentId == null) return null;
    newParentId = byId.get(oldParentId)!.parent_id ?? null;
    delta = -1;
  }

  tag.parent_id = newParentId;
  tag.depth += delta;
  for (const id of descIds) byId.get(id)!.depth += delta;

  const kidsOf = (pid: string | null) =>
    tags.filter(t => (t.parent_id ?? null) === pid && t.id !== tagId)
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name))
        .map(t => t.id);
  const renumber = (ids: string[]) => ids.forEach((id, i) => { byId.get(id)!.sort_order = i; });

  renumber(kidsOf(oldParentId));
  if (dir === 'indent') {
    renumber([...kidsOf(newParentId), tagId]);
  } else {
    const gpKids = kidsOf(newParentId);
    const at = gpKids.indexOf(oldParentId!);
    const insertAt = at >= 0 ? at + 1 : gpKids.length;
    renumber([...gpKids.slice(0, insertAt), tagId, ...gpKids.slice(insertAt)]);
  }

  const next = tags.map(t => byId.get(t.id)!);
  const changed = next.filter(t => {
    const o = tags.find(x => x.id === t.id)!;
    return o.parent_id !== t.parent_id || o.depth !== t.depth || (o.sort_order ?? 0) !== (t.sort_order ?? 0);
  });
  return { next, changed };
}

const DragGrip = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>
);

// A draggable tag heading in Organize mode (web). Drag the grip to reorder; tap
// the name to expand its quotes (which are drag-reorderable below).
function SortableTagRow({ tag, count, isOpen, hasQuotes, onToggleOpen, canIndent, canOutdent, onIndent, onOutdent }: {
  tag: TagRow; count: number; isOpen: boolean; hasQuotes: boolean; onToggleOpen: () => void;
  canIndent: boolean; canOutdent: boolean; onIndent: () => void; onOutdent: () => void;
}) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: tag.id });
  const depth = tag.depth ?? 0;
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, paddingLeft: 12 + depth * 16 }}
      className={`flex items-center gap-2 py-3 pe-3 border-b border-gray-100 dark:border-[#2D4050] bg-white dark:bg-[#1B2A38] ${isDragging ? 'opacity-60 shadow-lg z-10 relative' : ''}`}
    >
      <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-gray-400 dark:text-[#5C7A8E] touch-none" aria-label={t('common.dragToReorder')}>
        <DragGrip />
      </button>
      <button onClick={onToggleOpen} className="flex-1 flex items-center gap-2 min-w-0 text-start">
        <span className="flex-1 text-sm font-medium text-gray-800 dark:text-[#E2EAF2] truncate">{tag.name}</span>
        <span className="text-xs text-gray-400 dark:text-[#5C7A8E] shrink-0">{count}</span>
        {hasQuotes && <span className={`text-gray-400 dark:text-[#5C7A8E] text-sm shrink-0 transition-transform ${isOpen ? 'rotate-90' : ''}`}>›</span>}
      </button>
      <button onClick={onOutdent} disabled={!canOutdent} title={t('tags.outdent')} className={`px-1.5 text-lg leading-none ${canOutdent ? 'text-[#1B6B7B] dark:text-[#2D9DB3] hover:opacity-70' : 'text-gray-200 dark:text-[#2D4050] cursor-default'}`}>⇤</button>
      <button onClick={onIndent} disabled={!canIndent} title={t('tags.indent')} className={`px-1.5 text-lg leading-none ${canIndent ? 'text-[#1B6B7B] dark:text-[#2D9DB3] hover:opacity-70' : 'text-gray-200 dark:text-[#2D4050] cursor-default'}`}>⇥</button>
    </div>
  );
}

// A draggable quote row under an expanded tag in Organize mode (web).
function SortableQuoteRow({ sel, depth }: { sel: SelRow; depth: number }) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: sel.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, paddingLeft: 20 + depth * 16 }}
      className={`flex items-center gap-3 py-2 pe-4 border-b border-gray-50 dark:border-[#243543] bg-gray-50/40 dark:bg-[#16232F] ${isDragging ? 'opacity-60 shadow-lg z-10 relative' : ''}`}
    >
      <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-gray-300 dark:text-[#3A4D60] touch-none" aria-label={t('common.dragToReorder')}>
        <DragGrip />
      </button>
      <span className="flex-1 text-xs text-gray-600 dark:text-[#8FA4B8] truncate italic">{sel.snapshot_text}</span>
    </div>
  );
}

interface TagsScreenProps {
  userId: string;
  onOpenBook: (bookId: string, passageId?: string) => void;
}

type CheckState = 'checked' | 'indeterminate' | 'unchecked';

function Checkbox({ state, onChange }: { state: CheckState; onChange: () => void }) {
  return (
    <button
      onClick={e => { e.stopPropagation(); onChange(); }}
      className="flex items-center justify-center shrink-0 w-8 h-8 -ms-1"
    >
      <div className={`w-[18px] h-[18px] rounded border-2 flex items-center justify-center transition-colors ${
        state === 'checked'       ? 'bg-[#1B6B7B] dark:bg-[#2D9DB3] border-[#1B6B7B] dark:border-[#2D9DB3]' :
        state === 'indeterminate' ? 'border-[#1B6B7B] dark:border-[#2D9DB3]' : 'border-gray-300 dark:border-[#3A4D60]'
      }`}>
        {state === 'checked'       && <span className="text-white text-[10px] leading-none font-bold">✓</span>}
        {state === 'indeterminate' && <div className="w-2 h-0.5 bg-[#1B6B7B] dark:bg-[#2D9DB3] rounded-full" />}
      </div>
    </button>
  );
}

// Small globe marking a public (published) or community-imported tag on its row —
// same vocabulary as the mobile Tags screen's visibility globe.
function GlobeIcon({ className }: { className?: string }) {
  const { t } = useTranslation();
  return (
    <svg
      viewBox="0 0 24 24" width={11} height={11} fill="none" stroke="currentColor"
      strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"
      className={`shrink-0 ${className ?? ''}`} aria-label={t('tags.publicTag')}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
      <path d="M2 12h20" />
    </svg>
  );
}

function PassageRow({ sel, searchQuery, onOpenBook, onRemove, depth }: { sel: SelRow; searchQuery: string; onOpenBook: (b: string, p?: string) => void; onRemove: () => void; depth: number }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  const menuOptions: MenuOption[] = [
    {
      label: t('tags.removePassage'),
      icon: '✕',
      color: 'danger',
      onClick: () => { if (confirm(t('tags.removePassageConfirm'))) onRemove(); },
    },
  ];

  return (
    <div className="pe-3 py-1.5" style={{ paddingLeft: 36 + depth * 14 }}>
      <AnnotationCard
        variant="tag"
        quote={sel.snapshot_text}
        citation={sel.citation}
        query={searchQuery}
        clampQuote={!expanded}
        onClick={() => setExpanded(v => !v)}
        action={<ContextMenu options={menuOptions} />}
        footer={expanded && sel.book_id ? (
          <button
            onClick={e => { e.stopPropagation(); onOpenBook(sel.book_id, sel.passage_id); }}
            className="mt-2 text-xs text-[#1B6B7B] dark:text-[#2D9DB3] font-medium hover:underline"
          >
            {t('common.openInReader')} →
          </button>
        ) : undefined}
      />
    </div>
  );
}

function TagCard({ tag, selectState, onToggleSelect, searchQuery, onOpenBook, onDelete, onRename, onToggleVisibility, onRemovePassage, depth, hasChildren, isOpen, onToggleOpen, count }: {
  tag: TagRow;
  count?: number;
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
  const { t } = useTranslation();
  const open = isOpen ?? false;
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState(tag.name);

  const menuOptions: MenuOption[] = [
    {
      label: t('common.rename'),
      icon: '✏️',
      onClick: () => setRenaming(true),
    },
    {
      label: tag.visibility === 'published' ? t('tags.setPrivate') : t('tags.setPublic'),
      icon: tag.visibility === 'published' ? '🔓' : '🔒',
      onClick: () => onToggleVisibility(tag.id, tag.visibility === 'published' ? 'private' : 'published'),
    },
    {
      label: t('common.delete'),
      icon: '🗑️',
      color: 'danger',
      onClick: () => {
        if (confirm(t('tags.deleteConfirm'))) onDelete(tag.id);
      },
    },
  ];

  const indent = (depth ?? 0) * 20;

  const rowPaddingLeft = 12 + (depth ?? 0) * 14;

  return (
    <div>
      {renaming && (
        <div className="fixed inset-0 bg-black/30 z-40 flex items-center justify-center" onClick={() => setRenaming(false)}>
          <div className="bg-white dark:bg-[#1B2A38] rounded-2xl shadow-xl max-w-sm mx-4 p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-[#E2EAF2] mb-4">{t('tags.renameTitle')}</h2>
            <input
              autoFocus
              value={newName}
              onChange={e => setNewName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 dark:border-[#2D4050] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B6B7B]/30 dark:focus:ring-[#2D9DB3]/30 mb-4"
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
              <button onClick={() => { setRenaming(false); setNewName(tag.name); }} className="px-4 py-2 text-sm text-gray-600 dark:text-[#8FA4B8] hover:bg-gray-100 dark:hover:bg-[#2D4050] rounded-lg">{t('common.cancel')}</button>
              <button onClick={() => { onRename(tag.id, newName); setRenaming(false); }} className="px-4 py-2 text-sm bg-[#1B6B7B] dark:bg-[#2D9DB3] text-white rounded-lg hover:bg-[#1B6B7B]/90 dark:hover:bg-[#2D9DB3]/90">{t('common.save')}</button>
            </div>
          </div>
        </div>
      )}
      <div
        className="flex items-center py-3.5 pe-4 cursor-pointer select-none hover:bg-gray-50 dark:hover:bg-[#243040] transition-colors"
        style={{ paddingLeft: rowPaddingLeft }}
        onClick={() => onToggleOpen?.()}
      >
        <Checkbox state={selectState} onChange={onToggleSelect} />
        <span className="flex-1 text-sm font-medium text-gray-800 dark:text-[#D2DCE8] truncate ms-1 min-w-0">
          <Highlight text={tag.name} q={searchQuery} />
        </span>
        {(tag.visibility === 'published' || tag.visibility === 'imported') && (
          <GlobeIcon className={tag.visibility === 'published'
            ? 'text-[#5B8EC4] dark:text-[#7BAFD8]'
            : 'text-[#1B6B7B] dark:text-[#2D9DB3]'} />
        )}
        <span className="text-xs text-gray-400 dark:text-[#5C7A8E] shrink-0 mx-2">{count ?? tag.selections.length}</span>
        <span className={`text-gray-400 dark:text-[#5C7A8E] text-sm shrink-0 transition-transform duration-150 inline-block ${open ? 'rotate-90' : ''}`}>›</span>
        <div onClick={e => e.stopPropagation()} className="ms-2">
          <ContextMenu options={menuOptions} />
        </div>
      </div>
      {open && (
        <div>
          {tag.selections.map(sel => (
            <PassageRow key={sel.id} sel={sel} searchQuery={searchQuery} onOpenBook={onOpenBook} onRemove={() => onRemovePassage(tag.id, sel.id)} depth={depth ?? 0} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function TagsScreen({ userId, onOpenBook }: TagsScreenProps) {
  const supabase = createClient();
  const { t } = useTranslation();
  const [tags, setTags] = useState<TagRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [organizing, setOrganizing] = useState(false); // drag-to-reorder mode
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  // On drop: reorder among siblings (parent unchanged — Slice 2), recompute
  // sort_order per parent group, persist changed tags to Supabase.
  const handleTagDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setTags(prev => {
      const from = prev.findIndex(t => t.id === active.id);
      const to = prev.findIndex(t => t.id === over.id);
      if (from < 0 || to < 0) return prev;
      const origById = new Map(prev.map(t => [t.id, t.sort_order ?? 0]));
      const moved = arrayMove(prev, from, to);
      const counter = new Map<string, number>();
      const next = moved.map(t => {
        const key = (t.parent_id ?? '__root__') as string;
        const n = counter.get(key) ?? 0;
        counter.set(key, n + 1);
        return ((t.sort_order ?? 0) === n ? t : { ...t, sort_order: n });
      });
      const now = new Date().toISOString();
      for (const t of next) {
        if ((origById.get(t.id) ?? 0) !== (t.sort_order ?? 0)) {
          pushTag({ id: t.id, user_id: userId, name: t.name, parent_id: t.parent_id, depth: t.depth, sort_order: t.sort_order, visibility: t.visibility, updated_at: now }).catch(() => {});
        }
      }
      return next;
    });
  }, [userId]);

  // Reorder quotes within a single tag; persist selection_tags.sort_order.
  const handleQuoteDragEnd = useCallback((tagId: string, event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setTags(prev => prev.map(t => {
      if (t.id !== tagId) return t;
      const from = t.selections.findIndex(s => s.id === active.id);
      const to = t.selections.findIndex(s => s.id === over.id);
      if (from < 0 || to < 0) return t;
      const sels = arrayMove(t.selections, from, to);
      sels.forEach((s, i) => {
        supabase.from('selection_tags').update({ sort_order: i })
          .eq('tag_id', tagId).eq('selection_id', s.id).then(() => {}, () => {});
      });
      return { ...t, selections: sels };
    }));
  }, [supabase]);

  // Indent / outdent a tag (re-parent one level). Persists the changed subtree.
  const handleReparent = useCallback((tagId: string, dir: 'indent' | 'outdent') => {
    setTags(prev => {
      const result = computeReparent(prev, tagId, dir);
      if (!result) return prev;
      const now = new Date().toISOString();
      for (const t of result.changed) {
        pushTag({ id: t.id, user_id: userId, name: t.name, parent_id: t.parent_id, depth: t.depth, sort_order: t.sort_order, visibility: t.visibility, updated_at: now }).catch(() => {});
      }
      return result.next;
    });
  }, [userId]);

  // Per-tag indent/outdent eligibility for disabling the buttons at boundaries.
  const reparentFlags = useMemo(() => {
    const key = (p: string | null) => p ?? '__root__';
    const groups = new Map<string, TagRow[]>();
    for (const t of tags) {
      const k = key(t.parent_id ?? null);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(t);
    }
    for (const arr of groups.values()) arr.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name));
    const subMax = new Map<string, number>();
    const childrenOf = (id: string) => tags.filter(t => t.parent_id === id);
    const computeMax = (t: TagRow): number => {
      let m = t.depth;
      for (const c of childrenOf(t.id)) m = Math.max(m, computeMax(c));
      subMax.set(t.id, m);
      return m;
    };
    for (const t of tags) if (!t.parent_id) computeMax(t);
    const flags = new Map<string, { canIndent: boolean; canOutdent: boolean }>();
    for (const t of tags) {
      const sibs = groups.get(key(t.parent_id ?? null)) ?? [];
      const idx = sibs.findIndex(s => s.id === t.id);
      flags.set(t.id, { canOutdent: !!t.parent_id, canIndent: idx > 0 && (subMax.get(t.id) ?? t.depth) + 1 < 5 });
    }
    return flags;
  }, [tags]);
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
        .from('selection_tags').select('tag_id, selection_id, sort_order')
        .in('tag_id', tagIds).in('selection_id', selIds);

      // Hand-ordered within each tag (sort_order), created order as tiebreaker.
      const selsByTag: Record<string, SelRow[]> = {};
      for (const st of [...((stData ?? []) as any[])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))) {
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

  // Aggregate quote count per tag = distinct selections across its whole subtree
  // (own + descendants), matching the count shown on the Discover screen. A parent
  // with 0 direct quotes but populated sub-tags now shows the subtree total.
  const aggregateCounts = useMemo(() => {
    const selsById = new Map(tags.map(t => [t.id, t.selections]));
    const m = new Map<string, number>();
    for (const t of tags) {
      const ids = new Set<string>();
      for (const sub of subtreeIds(t.id)) {
        for (const s of (selsById.get(sub) ?? [])) ids.add(s.id);
      }
      m.set(t.id, ids.size);
    }
    return m;
  }, [tags, subtreeIds]);

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
      <div className="px-4 pt-4 pb-3 border-b border-gray-100 dark:border-[#2D4050] shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold text-gray-900 dark:text-[#E2EAF2]">{t('tags.title')}</h1>
            {tags.length > 0 && (
              <button
                onClick={() => setOrganizing(o => !o)}
                className={`text-sm font-medium px-2.5 py-1 rounded-lg transition-colors ${organizing ? 'bg-[#1B6B7B] dark:bg-[#2D9DB3] text-white' : 'text-[#1B6B7B] dark:text-[#2D9DB3] hover:bg-[#1B6B7B]/10'}`}
              >
                {organizing ? t('common.done') : t('tags.organize')}
              </button>
            )}
          </div>
          {!organizing && selectedTagIds.size > 0 && (
            <div className="relative" ref={exportMenuRef}>
              <button
                onClick={() => setShowExportMenu(v => !v)}
                disabled={exporting}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1B6B7B] dark:bg-[#2D9DB3] text-white text-sm font-medium rounded-lg hover:bg-[#1B6B7B]/90 dark:hover:bg-[#2D9DB3]/90 disabled:opacity-60 transition-colors"
                title={t('tags.exportSelected')}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/>
                  <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                {exporting ? t('tags.exporting') : `${t('tags.export')} (${selectedTagIds.size})`}
              </button>
              {showExportMenu && (
                <div className="absolute end-0 top-full mt-1 bg-white dark:bg-[#1B2A38] rounded-xl shadow-lg border border-gray-200 dark:border-[#2D4050] z-20 min-w-[200px]">
                  <div className="px-4 pt-3 pb-2 border-b border-gray-100 dark:border-[#2D4050]">
                    <p className="text-[10px] text-gray-400 dark:text-[#5C7A8E] font-semibold uppercase tracking-widest mb-2">{t('tags.exportInclude')}</p>
                    {([
                      { label: t('notes.title'), checked: includeNotes, set: () => setIncludeNotes(v => !v), enabled: hasNotesForSelectedTags },
                      { label: t('xrefs.title'), checked: includeXrefs, set: () => setIncludeXrefs(v => !v), enabled: hasXrefsForSelectedTags },
                    ]).map(({ label, checked, set, enabled }) => (
                      <div
                        key={label}
                        className={`flex items-center gap-2 py-1 select-none ${enabled ? 'cursor-pointer' : 'cursor-not-allowed opacity-40'}`}
                        onClick={e => { if (!enabled) return; e.stopPropagation(); set(); }}
                        title={enabled ? undefined : t('tags.exportNothingToInclude', { items: label.toLowerCase() })}
                      >
                        <div className={`w-[15px] h-[15px] rounded border-2 flex items-center justify-center transition-colors shrink-0 ${checked && enabled ? 'bg-[#1B6B7B] dark:bg-[#2D9DB3] border-[#1B6B7B] dark:border-[#2D9DB3]' : 'border-gray-300 dark:border-[#3A4D60]'}`}>
                          {checked && enabled && <span className="text-white text-[9px] leading-none font-bold">✓</span>}
                        </div>
                        <span className="text-sm text-gray-700 dark:text-[#B8C7D6]">{label}</span>
                      </div>
                    ))}
                  </div>
                  <div className="py-1">
                    {([
                      { label: 'PDF',           format: 'pdf'  },
                      { label: t('export.docxShort'), format: 'docx' },
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
                </div>
              )}
            </div>
          )}
        </div>
        <div className="relative">
          <svg className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-[#5C7A8E] w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" /></svg>
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder={t('tags.searchTagsPassages')} className="w-full ps-9 pe-14 py-2 text-sm text-gray-900 dark:text-[#E2EAF2] border border-gray-200 dark:border-[#2D4050] rounded-xl outline-none focus:ring-2 focus:ring-[#1B6B7B]/30 dark:focus:ring-[#2D9DB3]/30 focus:border-[#1B6B7B] dark:focus:border-[#2D9DB3] bg-gray-50 dark:bg-[#243040]" />
          {(searchQuery || selectedTagIds.size > 0) && (
            <button onClick={() => { setSearchQuery(''); setSelectedTagIds(new Set()); }} className="absolute end-3 top-1/2 -translate-y-1/2 text-xs font-medium text-[#1B6B7B] dark:text-[#2D9DB3] hover:text-[#0f4a56]">{t('common.clear')}</button>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center py-16"><div className="w-6 h-6 border-2 border-[#1B6B7B] dark:border-[#2D9DB3] border-t-transparent rounded-full animate-spin" /></div>
        ) : organizing ? (
          <div>
            <p className="text-xs text-gray-400 dark:text-[#5C7A8E] text-center py-3 px-4">{t('tags.organizeHint')}</p>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleTagDragEnd}>
              <SortableContext items={tags.map(t => t.id)} strategy={verticalListSortingStrategy}>
                {tags.map(tag => (
                  <div key={tag.id}>
                    <SortableTagRow
                      tag={tag}
                      count={aggregateCounts.get(tag.id) ?? tag.selections.length}
                      isOpen={openTagIds.has(tag.id)}
                      hasQuotes={tag.selections.length > 0}
                      onToggleOpen={() => toggleOpenTag(tag.id)}
                      canIndent={reparentFlags.get(tag.id)?.canIndent ?? false}
                      canOutdent={reparentFlags.get(tag.id)?.canOutdent ?? false}
                      onIndent={() => handleReparent(tag.id, 'indent')}
                      onOutdent={() => handleReparent(tag.id, 'outdent')}
                    />
                    {openTagIds.has(tag.id) && tag.selections.length > 0 && (
                      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={e => handleQuoteDragEnd(tag.id, e)}>
                        <SortableContext items={tag.selections.map(s => s.id)} strategy={verticalListSortingStrategy}>
                          {tag.selections.map(sel => <SortableQuoteRow key={sel.id} sel={sel} depth={tag.depth ?? 0} />)}
                        </SortableContext>
                      </DndContext>
                    )}
                  </div>
                ))}
              </SortableContext>
            </DndContext>
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-[#5C7A8E] text-center py-16 px-4">{searchQuery ? t('tags.noMatch') : t('tags.empty')}</p>
        ) : (
          <div>
            {filtered.map((tag, i) => {
              const next = filtered[i + 1];
              // Divider after this tag's subtree: full-width before a top-level
              // tag, inset before a sub-tag, none at the end.
              const nextDepth = next ? (next.depth ?? 0) : null;
              const inset = nextDepth === null ? null : nextDepth === 0 ? 0 : 12 + nextDepth * 14;
              return (
                <div key={tag.id}>
                  <TagCard
                    tag={tag}
                    depth={tag.depth ?? 0}
                    count={aggregateCounts.get(tag.id) ?? tag.selections.length}
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
                  {inset !== null && (
                    <div className="bg-gray-100 dark:bg-[#2D4050]" style={{ height: 1, marginLeft: inset }} />
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
