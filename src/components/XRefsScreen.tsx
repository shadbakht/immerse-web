'use client';

import { useEffect, useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { fetchSelectionsByUser } from '@/lib/fetchAnnotationSelections';

interface XRefRow {
  id: string; created_at: string;
  snapshotA: string; citationA: string; bookIdA: string; passageIdA: string;
  snapshotB: string; citationB: string; bookIdB: string; passageIdB: string;
}

interface XRefsScreenProps {
  userId: string;
  onOpenBook: (bookId: string, passageId?: string) => void;
}

function Highlight({ text, q }: { text: string; q: string }) {
  if (!q.trim()) return <>{text}</>;
  const pat = new RegExp(`(${q.trim().split(/\s+/).map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
  return <>{text.split(pat).map((p, i) => pat.test(p) ? <mark key={i} className="bg-yellow-100 text-yellow-900 rounded px-0.5">{p}</mark> : <span key={i}>{p}</span>)}</>;
}

function formatDate(iso: string) {
  const d = new Date(iso), diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 3600)   return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function XRefCard({ row, searchQuery, onOpenBook }: { row: XRefRow; searchQuery: string; onOpenBook: (b: string, p?: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const sides = [
    { key: 'a', snapshot: row.snapshotA, citation: row.citationA, bookId: row.bookIdA, passageId: row.passageIdA },
    { key: 'b', snapshot: row.snapshotB, citation: row.citationB, bookId: row.bookIdB, passageId: row.passageIdB },
  ];

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Two quotes side by side — click either side to expand */}
      <div className="grid grid-cols-2 divide-x divide-gray-100 cursor-pointer select-none hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded(v => !v)}>
        {sides.map(side => (
          <div key={side.key} className="px-4 py-4 flex flex-col gap-2">
            <p className="text-xs text-[#1B6B7B] font-medium leading-snug">
              <Highlight text={side.citation} q={searchQuery} />
            </p>
            <p className={`text-sm italic text-gray-700 leading-relaxed ${expanded ? '' : 'line-clamp-3'}`}>
              "<Highlight text={side.snapshot} q={searchQuery} />"
            </p>
            {expanded && side.bookId && (
              <button
                onClick={e => { e.stopPropagation(); onOpenBook(side.bookId, side.passageId); }}
                className="text-xs text-[#1B6B7B] font-medium hover:underline text-left"
              >
                Open in reader →
              </button>
            )}
          </div>
        ))}
      </div>
      {/* Footer */}
      <div className="px-4 py-2 border-t border-gray-100">
        <p className="text-xs text-gray-300">{formatDate(row.created_at)}</p>
      </div>
    </div>
  );
}

export default function XRefsScreen({ userId, onOpenBook }: XRefsScreenProps) {
  const supabase = createClient();
  const [rows, setRows] = useState<XRefRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => { if (userId) load(); }, [userId]);

  async function load() {
    setLoading(true);
    try {
      const [{ data: xrefData }, selMap] = await Promise.all([
        supabase.from('xrefs').select('id, created_at, selection_a_id, selection_b_id').eq('user_id', userId).order('created_at', { ascending: false }),
        fetchSelectionsByUser(userId),
      ]);

      function get(id: string) {
        const s = selMap[id] ?? { snapshot_text: '', citation: '', passage_id: '', book_id: '' };
        return { snapshot: s.snapshot_text, citation: s.citation, bookId: s.book_id, passageId: s.passage_id };
      }

      setRows((xrefData ?? []).map((x: any) => {
        const a = get(x.selection_a_id), b = get(x.selection_b_id);
        return { id: x.id, created_at: x.created_at, snapshotA: a.snapshot, citationA: a.citation, bookIdA: a.bookId, passageIdA: a.passageId, snapshotB: b.snapshot, citationB: b.citation, bookIdB: b.bookId, passageIdB: b.passageId };
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
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" /></svg>
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search cross-references…" className="w-full pl-9 pr-4 py-2 text-sm text-gray-900 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#1B6B7B]/30 focus:border-[#1B6B7B] bg-gray-50" />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-6 pb-8">
        {loading ? (
          <div className="flex justify-center py-16"><div className="w-6 h-6 border-2 border-[#1B6B7B] border-t-transparent rounded-full animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-16">{searchQuery ? 'No cross-references match your search.' : 'No cross-references yet. Select passages in the reader to link them.'}</p>
        ) : (
          <div className="space-y-3">
            {filtered.map(row => (
              <XRefCard key={row.id} row={row} searchQuery={searchQuery} onOpenBook={onOpenBook} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
