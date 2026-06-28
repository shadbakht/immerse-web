'use client';

import { useEffect, useRef, useState } from 'react';
import PanelSheet from './PanelSheet';

interface NotePanelProps {
  visible:       boolean;
  onClose:       () => void;
  selectionText: string;
  onSave:        (content: string) => Promise<void>;
}

export default function NotePanel({ visible, onClose, selectionText, onSave }: NotePanelProps) {
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (visible) {
      setContent('');
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [visible]);

  async function handleSave() {
    if (!content.trim()) return;
    setSaving(true);
    try {
      await onSave(content.trim());
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <PanelSheet
      visible={visible}
      onClose={onClose}
      title="Add Note"
      footer={
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-[#2D4050] text-sm text-gray-600 dark:text-[#8FA4B8] hover:bg-gray-50 dark:hover:bg-[#243040] transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !content.trim()}
            className="flex-1 py-2.5 rounded-xl bg-[#1B6B7B] dark:bg-[#2D9DB3] text-white text-sm font-semibold hover:bg-[#155a68] dark:hover:bg-[#2589A0] transition-colors disabled:opacity-40"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      }
    >
      {/* Selection preview — pinned (sticky) so it stays visible when focusing
          the textarea brings up the on-screen keyboard and the body auto-scrolls. */}
      <div className="sticky top-0 z-10 bg-white dark:bg-[#1B2A38] px-5 pt-4 pb-2">
        <div className="px-3 py-2.5 bg-gray-50 dark:bg-[#243040] rounded-xl border border-gray-100 dark:border-[#2D4050]">
          <p className="text-xs text-gray-500 dark:text-[#8FA4B8] line-clamp-2">"{selectionText}"</p>
        </div>
      </div>

      {/* Note input */}
      <div className="px-5 pb-4 pt-2">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="Write your note…"
          rows={5}
          className="w-full border border-gray-200 dark:border-[#2D4050] rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-[#E2EAF2] outline-none focus:ring-2 focus:ring-[#1B6B7B]/30 dark:focus:ring-[#2D9DB3]/30 focus:border-[#1B6B7B] dark:focus:border-[#2D9DB3] resize-none leading-relaxed"
        />
      </div>
    </PanelSheet>
  );
}
