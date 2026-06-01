'use client';

import { useEffect, useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';

interface XRefRow {
  id: string;
  created_at: string;
  snapshotA: string; citationA: string; bookIdA: string; passageIdA: string;
  snapshotB: string; citationB: string; bookIdB: string; passageIdB: string;
}

interface XRefsScreenProps {
  userId: string;
  onOpenBook: (bookId: string, passageId?: string) => void;
}

function buildCitation(passage: any, book: any): string {
  return [
    (book?.authors as any)?.name,
    book?.title,
    passage?.chapter_label || passage?.section_title,
    passage?.paragraph_number ? `p.${passage.paragraph_number}` : null,
  ].filter(Boolean).join(', ');
}

function Highlight({ text, q }: { text: string; q: string }) {
  if (!q.trim()) return <>{text}</>;
  const pattern = new RegExp(`(${q.trim().split(/\s+/).map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
  return <>{text.split(pattern).map((p, i) => pattern.test(p) ? <mark key={i} className="bg-yellow-100 text-yellow-900 rounded px-0.5">{p}</mark> : <span key={i}>{p}</span>)}</>;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 3600)   return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function XRefsScreen({ userId, onOpenBook }: XRefsScreenProps) {
  const supabase = createClient();
  const [rows, setRows] = useState<XRefRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => { if (userId) load(); }, [userId]);

  async function load() {
    setLoading(true);
    try {
      // 1. User's xrefs
      const { data: xrefData } = await supabase
        .from('xrefs')
        .select('id, created_at, selection_a_id, selection_b_id')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      const xrefList = xrefData ?? [];
      if (xrefList.length === 0) { setRows([]); return; }

      // 2. All involved selections — via user_id to ensure RLS works
      const { data: selData } = await supabase
        .from('selections')
        .select('id, snapshot_text, passage_id, book_id, passages(chapter_label, section_title, paragraph_number, books(id, title, authors(name)))')
        .eq('user_id', userId);
      const selMap: Record<string, any> = {};
      for (const s of (selData ?? []) as any[]) selMap[s.id] = s;

      function hydrate(selId: string) {
        const sel     = selMap[selId];
        const passage = sel?.passages;
        const book    = passage?.books;
        return {
          snapshot:  sel?.snapshot_text ?? '',
          citation:  buildCitation(passage, book),
          bookId:    book?.id ?? sel?.book_id ?? '',
          passageId: sel?.passage_id ?? '',
        };
      }

      setRows((xrefList as any[]).map(x => {
        const a = hydrate(x.selection_a_id);
        const b = hydrate(x.selection_b_id);
        return {
          id: x.id, created_at: x.created_at,
          snapshotA: a.snapshot, citationA: a.citation, bookIdA: a.bookId, passageIdA: a.passageId,
          snapshotB: b.snapshot, citationB: b.citation, bookIdB: b.bookId, passageIdB: b.passageId,
        };
      }));
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r =>
      r.snapshotA.toLowerCase().includes(q) || r.snapshotB.toLowerCase().includes(q) ||
      r.citationA.toLowerCase().includes(q) || r.citationB.toLowerCase().includes(q)
    );
  }, [rows, searchQuery]);

  return (
    <div className="h-full flex flex-col max-w-2xl mx-auto w-full">
      <div className="px-6 pt-8 pb-4 shrink-0">
        <h1 className="text-2xl font-semibold text-gray-900 mb-4">Cross-References</h1>
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search cross-references…"
            className="w-full pl-9 pr-4 py-2 text-sm text-gray-900 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#1B6B7B]/30 focus:border-[#1B6B7B] bg-gray-50" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-8">
        {loading ? (
          <div className="flex justify-center py-16"><div className="w-6 h-6 border-2 border-[#1B6B7B] border-t-transparent rounded-full animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-16">
            {searchQuery ? 'No cross-references match your search.' : 'No cross-references yet. Select passages in the reader to link them.'}
          </p>
        ) : (
          <div className="space-y-3">
            {filtered.map(row => {
              const isExpanded = expandedIds.has(row.id);
              return (
                <div key={row.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <button className="w-full text-left px-5 py-4"
                    onClick={() => setExpandedIds(prev => { const n = new Set(prev); n.has(row.id) ? n.delete(row.id) : n.add(row.id); return n; })}>
                    <div className="flex items-start gap-3">
                      <span className="text-[#10B981] text-base shrink-0 mt-0.5">⬡</span>
                      <div className="flex-1 min-w-0 space-y-2">
                        <p className="text-xs italic text-gray-700 leading-relaxed line-clamp-2">"<Highlight text={row.snapshotA} q={searchQuery} />"</p>
                        <div className="flex items-center gap-2"><div className="flex-1 h-px bg-gray-100" /><span className="text-xs text-gray-300">↔</span><div className="flex-1 h-px bg-gray-100" /></div>
                        <p className="text-xs italic text-gray-700 leading-relaxed line-clamp-2">"<Highlight text={row.snapshotB} q={searchQuery} />"</p>
                      </div>
                      <span className={`text-gray-400 text-lg transition-transform shrink-0 ${isExpanded ? 'rotate-90' : ''}`}>›</span>
                    </div>
                    <p className="text-xs text-gray-300 mt-2 text-right">{formatDate(row.created_at)}</p>
                  </button>
                  {isExpanded && (
                    <div className="border-t border-gray-50">
                      {[
                        { snapshot: row.snapshotA, citation: row.citationA, bookId: row.bookIdA, passageId: row.passageIdA },
                        { snapshot: row.snapshotB, citation: row.citationB, bookId: row.bookIdB, passageId: row.passageIdB },
                      ].map((side, i) => (
                        <div key={i} className={`px-5 py-3 ${i === 0 ? 'border-b border-gray-50' : ''}`}>
                          <p className="text-xs italic text-gray-700 leading-relaxed mb-1">"<Highlight text={side.snapshot} q={searchQuery} />"</p>
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs text-[#1B6B7B]"><Highlight text={side.citation} q={searchQuery} /></p>
                            {side.bookId && <button onClick={() => onOpenBook(side.bookId, side.passageId)} className="text-xs text-gray-400 hover:text-[#1B6B7B] shrink-0 hover:underline">Open →</button>}
                          </div>
                        </div>
                      ))}
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
