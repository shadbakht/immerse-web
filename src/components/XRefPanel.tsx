'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import PanelSheet from './PanelSheet';
import { buildCitation } from '@/lib/citationUtils';

interface Passage {
  id: string;
  content: string;
  book_title: string;
  author_name: string;
  chapter_label: string | null;
  section_title: string | null;
  paragraph_number: number | null;
  citation_format: string | null;
}

interface XRefPanelProps {
  visible:       boolean;
  onClose:       () => void;
  selectionText: string;
  onSave:        (targetPassageId: string, targetSnapshotText: string) => Promise<void>;
}

export default function XRefPanel({ visible, onClose, selectionText, onSave }: XRefPanelProps) {
  const supabase = createClient();
  const [step, setStep] = useState<1 | 2>(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<Passage[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<Passage | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) { setStep(1); setSearchQuery(''); setResults([]); setSelected(null); }
  }, [visible]);

  useEffect(() => {
    if (searchQuery.trim().length < 3) { setResults([]); return; }
    const timer = setTimeout(() => doSearch(searchQuery.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  async function doSearch(q: string) {
    setSearching(true);
    try {
      const { data } = await supabase
        .from('passages')
        .select('id, content, chapter_label, section_title, paragraph_number, books(title, citation_format, authors(name))')
        .ilike('content', `%${q}%`)
        .limit(10);

      setResults((data ?? []).map((p: any) => ({
        id:               p.id,
        content:          p.content,
        book_title:       p.books?.title ?? '',
        author_name:      p.books?.authors?.name ?? '',
        chapter_label:    p.chapter_label,
        section_title:    p.section_title,
        paragraph_number: p.paragraph_number,
        citation_format:  p.books?.citation_format ?? null,
      })));
    } finally {
      setSearching(false);
    }
  }

  async function handleSave() {
    if (!selected) return;
    setSaving(true);
    try {
      await onSave(selected.id, selected.content.slice(0, 500));
      onClose();
    } finally {
      setSaving(false);
    }
  }

  function citationFor(p: Passage) {
    return buildCitation(p, { title: p.book_title, citation_format: p.citation_format }, p.author_name);
  }

  return (
    <PanelSheet
      visible={visible}
      onClose={onClose}
      title="Cross-Reference"
      maxHeight="75vh"
      footer={
        step === 2 ? (
          <div className="flex gap-3">
            <button onClick={() => setStep(1)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
              Back
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 py-2.5 rounded-xl bg-[#1B6B7B] text-white text-sm font-semibold hover:bg-[#155a68] transition-colors disabled:opacity-40"
            >
              {saving ? 'Saving…' : 'Save Cross-Reference'}
            </button>
          </div>
        ) : undefined
      }
    >
      {step === 1 ? (
        <div className="px-5 py-4 space-y-4">
          {/* Current selection */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Your selection</p>
            <div className="bg-gray-50 rounded-xl px-3 py-2.5 border border-gray-100">
              <p className="text-sm text-gray-700 italic line-clamp-3">"{selectionText}"</p>
            </div>
          </div>

          {/* Search */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Find a passage to link</p>
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search any passage…"
              autoFocus
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-[#1B6B7B]/30 focus:border-[#1B6B7B]"
            />
          </div>

          {/* Results */}
          {searching && <p className="text-sm text-gray-400 text-center py-4">Searching…</p>}
          {!searching && results.length > 0 && (
            <div className="space-y-2">
              {results.map(p => (
                <button
                  key={p.id}
                  onClick={() => { setSelected(p); setStep(2); }}
                  className="w-full text-left bg-gray-50 hover:bg-[#1B6B7B]/5 border border-gray-100 hover:border-[#1B6B7B]/30 rounded-xl px-3 py-2.5 transition-colors"
                >
                  <p className="text-sm text-gray-800 line-clamp-2 italic">"{p.content.slice(0, 120)}…"</p>
                  <p className="text-xs text-gray-400 mt-1">{citationFor(p)}</p>
                </button>
              ))}
            </div>
          )}
          {!searching && searchQuery.length >= 3 && results.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">No results found.</p>
          )}
        </div>
      ) : (
        <div className="px-5 py-4 space-y-4">
          {/* From */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">From</p>
            <div className="bg-gray-50 rounded-xl px-3 py-2.5 border border-gray-100">
              <p className="text-sm text-gray-700 italic">"{selectionText}"</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400">links to</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {/* To */}
          {selected && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">To</p>
              <div className="bg-[#1B6B7B]/5 rounded-xl px-3 py-2.5 border border-[#1B6B7B]/20">
                <p className="text-sm text-gray-700 italic line-clamp-4">"{selected.content}"</p>
                <p className="text-xs text-[#1B6B7B] mt-1.5 font-medium">{citationFor(selected)}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </PanelSheet>
  );
}
