'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { pushTag, deleteRemote } from '@/lib/annotationSync';
import PanelSheet from './PanelSheet';
import { ContextMenu, type MenuOption } from './ContextMenu';

interface Tag {
  id: string;
  name: string;
  parent_id: string | null;
  depth: number;
  sort_order: number;
}

interface TagPanelProps {
  visible:      boolean;
  onClose:      () => void;
  userId:       string;
  selectionText: string;
  onSave:       (tagIds: string[]) => Promise<void>;
}

export default function TagPanel({ visible, onClose, userId, selectionText, onSave }: TagPanelProps) {
  const supabase = createClient();
  const [tags, setTags] = useState<Tag[]>([]);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [newTagName, setNewTagName] = useState('');
  const [newTagParentId, setNewTagParentId] = useState<string | null>(null);
  const [openNodes, setOpenNodes] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (visible && userId) loadTags();
  }, [visible, userId]);

  async function loadTags() {
    const { data } = await supabase
      .from('tags')
      .select('id, name, parent_id, depth, sort_order')
      .eq('user_id', userId)
      .order('depth')
      .order('sort_order')
      .order('name');
    setTags(data ?? []);
  }

  async function handleDeleteTag(id: string) {
    try { await supabase.from('tags').delete().eq('id', id); } catch {}
    deleteRemote('tags', id).catch(() => {});
    setTags(prev => prev.filter(t => t.id !== id));
    setChecked(prev => { const next = new Set(prev); next.delete(id); return next; });
  }

  async function handleCreateTag() {
    if (!newTagName.trim()) return;
    setCreating(true);
    try {
      const parent = newTagParentId ? tags.find(t => t.id === newTagParentId) : null;
      const { data } = await supabase
        .from('tags')
        .insert({
          user_id:    userId,
          name:       newTagName.trim(),
          parent_id:  newTagParentId,
          depth:      parent ? parent.depth + 1 : 0,
          sort_order: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select('id, name, parent_id, depth, sort_order')
        .single();
      if (data) {
        setTags(prev => [...prev, data]);
        setChecked(prev => new Set(prev).add(data.id));
        // Push to sync service
        await pushTag({
          id: data.id,
          user_id: userId,
          name: data.name,
          updated_at: new Date().toISOString(),
        }).catch(() => {});
      }
      setNewTagName('');
      setNewTagParentId(null);
    } finally {
      setCreating(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      await onSave([...checked]);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  function toggleNode(id: string) {
    setOpenNodes(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function renderTag(tag: Tag, allTags: Tag[]) {
    const children = allTags.filter(t => t.parent_id === tag.id);
    const isOpen = openNodes.has(tag.id);
    const isChecked = checked.has(tag.id);

    const deleteOption: MenuOption[] = [{
      label: 'Delete',
      icon: '🗑️',
      color: 'danger',
      onClick: () => { if (confirm(`Delete tag "${tag.name}"?`)) handleDeleteTag(tag.id); },
    }];

    return (
      <div key={tag.id}>
        <div
          className="flex items-center gap-2 px-5 py-2.5 hover:bg-gray-50 dark:hover:bg-[#243040]"
          style={{ paddingLeft: 20 + tag.depth * 20 }}
        >
          {/* Checkbox */}
          <button
            onClick={() => {
              const next = new Set(checked);
              isChecked ? next.delete(tag.id) : next.add(tag.id);
              setChecked(next);
            }}
            className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
              isChecked ? 'bg-[#1B6B7B] dark:bg-[#2D9DB3] border-[#1B6B7B] dark:border-[#2D9DB3]' : 'border-gray-300 dark:border-[#3A4D60]'
            }`}
          >
            {isChecked && <span className="text-white text-xs leading-none">✓</span>}
          </button>

          {/* Name */}
          <span className="flex-1 text-sm text-gray-800 dark:text-[#D2DCE8]">{tag.name}</span>

          {/* Add child button */}
          <button
            onClick={() => { setNewTagParentId(tag.id); setNewTagName(''); }}
            className="text-gray-300 dark:text-[#4A6478] hover:text-[#1B6B7B] dark:hover:text-[#2D9DB3] text-lg leading-none transition-colors px-1"
            title="Add sub-tag"
          >
            +
          </button>

          {/* Chevron */}
          {children.length > 0 && (
            <button onClick={() => toggleNode(tag.id)} className="text-gray-400 dark:text-[#5C7A8E] text-sm px-1">
              <span className={`inline-block transition-transform ${isOpen ? 'rotate-90' : ''}`}>›</span>
            </button>
          )}

          {/* Kebab menu */}
          <div onClick={e => e.stopPropagation()}>
            <ContextMenu options={deleteOption} />
          </div>
        </div>

        {isOpen && children.map(child => renderTag(child, allTags))}
      </div>
    );
  }

  const rootTags = tags.filter(t => !t.parent_id);

  return (
    <PanelSheet
      visible={visible}
      onClose={onClose}
      title="Add Tag"
      footer={
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-[#2D4050] text-sm text-gray-600 dark:text-[#8FA4B8] hover:bg-gray-50 dark:hover:bg-[#243040] transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || checked.size === 0}
            className="flex-1 py-2.5 rounded-xl bg-[#1B6B7B] dark:bg-[#2D9DB3] text-white text-sm font-semibold hover:bg-[#155a68] dark:hover:bg-[#2589A0] transition-colors disabled:opacity-40"
          >
            {saving ? 'Saving…' : `Save${checked.size > 0 ? ` (${checked.size})` : ''}`}
          </button>
        </div>
      }
    >
      {/* Selection preview */}
      <div className="mx-5 mt-4 mb-3 px-3 py-2.5 bg-gray-50 dark:bg-[#243040] rounded-xl border border-gray-100 dark:border-[#2D4050]">
        <p className="text-xs text-gray-500 dark:text-[#8FA4B8] line-clamp-2">"{selectionText}"</p>
      </div>

      {/* New tag input */}
      <div className="px-5 pb-3">
        {newTagParentId && (
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="text-xs text-gray-400 dark:text-[#5C7A8E]">Sub-tag of</span>
            <span className="text-xs font-medium text-[#1B6B7B] dark:text-[#2D9DB3]">
              {tags.find(t => t.id === newTagParentId)?.name}
            </span>
            <button onClick={() => setNewTagParentId(null)} className="text-gray-300 dark:text-[#4A6478] hover:text-gray-500 dark:hover:text-[#8FA4B8] text-xs ml-1">✕</button>
          </div>
        )}
        <div className="flex gap-2">
          <input
            value={newTagName}
            onChange={e => setNewTagName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreateTag()}
            placeholder="New tag name…"
            className="flex-1 border border-gray-200 dark:border-[#2D4050] rounded-xl px-3 py-2 text-sm text-gray-900 dark:text-[#E2EAF2] outline-none focus:ring-2 focus:ring-[#1B6B7B]/30 dark:focus:ring-[#2D9DB3]/30 focus:border-[#1B6B7B] dark:focus:border-[#2D9DB3]"
          />
          <button
            onClick={handleCreateTag}
            disabled={!newTagName.trim() || creating}
            className="px-4 py-2 bg-[#1B6B7B] dark:bg-[#2D9DB3] text-white text-sm rounded-xl disabled:opacity-40 hover:bg-[#155a68] dark:hover:bg-[#2589A0] transition-colors"
          >
            Create
          </button>
        </div>
      </div>

      {/* Tag list */}
      <div className="pb-2">
        {rootTags.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-[#5C7A8E] text-center py-8">No tags yet. Create your first one above.</p>
        ) : (
          rootTags.map(tag => renderTag(tag, tags))
        )}
      </div>
    </PanelSheet>
  );
}
