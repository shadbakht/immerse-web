'use client';

import { useEffect, useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';

interface XRefRow {
  id: string;
  created_at: string;
  snapshotA: string;
  citationA: string;
  bookIdA: string;
  passageIdA: string;
  snapshotB: string;
  citationB: string;
  bookIdB: string;
  passageIdB: string;
}

interface XRefsScreenProps {
  userId: string;
  onOpenBook: (bookId: string, passageId?: string) => void;
}

function buildCitation(passage: any, book: any): string {
  const parts = [
    (book?.authors as any)?.name,
    book?.title,
    passage?.chapter_label || passage?.section_title,
    passage?.paragraph_number ? `p.${passage.paragraph_number}` : null,
  ].filter(Boolean);
  return parts.join(', ');
}

function highlight(text: string, q: string) {
  if (!q.trim()) return <span>{text}</span>;
  const words = q.trim().split(/\s+/);
  const pattern = new RegExp(`(${words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
  const parts = text.split(pattern);
  return (
    <>
      {parts.map((p, i) =>
        pattern.test(p)
          ? <mark key={i} className="bg-yellow-100 text-yellow-900 rounded px-0.5">{p}</mark>
          : <span key={i}>{p}</span>
      )}
    </>
  );
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
      const { data } = await supabase
        .from('xrefs')
        .select(`
          id, created_at,
          sel_a:selections!xrefs_selection_a_id_fkey(
            id, snapshot_text, passage_id, book_id,
            passages(chapter_label, section_title, paragraph_number, books(id, title, authors(name)))
          ),
          sel_b:selections!xrefs_selection_b_id_fkey(
            id, snapshot_text, passage_id, book_id,
            passages(chapter_label, section_title, paragraph_number, books(id, title, authors(name)))
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      setRows((data ?? []).map((x: any) => {
        const selA = x.sel_a;
        const selB = x.sel_b;
        const passA = selA?.passages;
        const passB = selB?.passages;
        const bookA = passA?.books;
        const bookB = passB?.books;
        return {
          id:         x.id,
          created_at: x.created_at,
          snapshotA:  selA?.snapshot_text ?? '',
          citationA:  buildCitation(passA, bookA),
          bookIdA:    bookA?.id ?? selA?.book_id ?? '',
          passageIdA: selA?.passage_id ?? '',
          snapshotB:  selB?.snapshot_text ?? '',
          citationB:  buildCitation(passB, bookB),
          bookIdB:    bookB?.id ?? selB?.book_id ?? '',
          passageIdB: selB?.passage_id ?? '',
        };
      }));
    } finally {
      setLoading(false);
    }
  }

  function formatDate(iso: string) {
    const d = new Date(iso);
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 3600)   return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400)  return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r =>
      r.snapshotA.toLowerCase().includes(q) ||
      r.snapshotB.toLowerCase().includes(q) ||
      r.citationA.toLowerCase().includes(q) ||
      r.citationB.toLowerCase().includes(q)
    );
  }, [rows, searchQuery]);

  return (
    <div className="h-full flex flex-col max-w-2xl mx-auto w-full">
      {/* Header */}
      <div className="px-6 pt-8 pb-4 shrink-0">
        <h1 className="text-2xl font-semibold text-gray-900 mb-4">Cross-References</h1>
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search cross-references…"
            className="w-full pl-9 pr-4 py-2 text-sm text-gray-900 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#1B6B7B]/30 focus:border-[#1B6B7B] bg-gray-50"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-6 pb-8">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-6 h-6 border-2 border-[#1B6B7B] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !userId ? (
          <p className="text-sm text-gray-400 text-center py-16">Sign in to see your cross-references.</p>
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
                  {/* Collapsed: show both snippets */}
                  <button
                    className="w-full text-left px-5 py-4"
                    onClick={() => setExpandedIds(prev => {
                      const next = new Set(prev);
                      next.has(row.id) ? next.delete(row.id) : next.add(row.id);
                      return next;
                    })}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-[#10B981] text-base shrink-0 mt-0.5">⬡</span>
                      <div className="flex-1 min-w-0 space-y-2">
                        <p className="text-xs italic text-gray-700 leading-relaxed line-clamp-2">
                          "{highlight(row.snapshotA, searchQuery)}"
                        </p>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-px bg-gray-100" />
                          <span className="text-xs text-gray-300">↔</span>
                          <div className="flex-1 h-px bg-gray-100" />
                        </div>
                        <p className="text-xs italic text-gray-700 leading-relaxed line-clamp-2">
                          "{highlight(row.snapshotB, searchQuery)}"
                        </p>
                      </div>
                      <span className={`text-gray-400 text-lg transition-transform shrink-0 ${isExpanded ? 'rotate-90' : ''}`}>›</span>
                    </div>
                    <p className="text-xs text-gray-300 mt-2 text-right">{formatDate(row.created_at)}</p>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-gray-50">
                      {/* Side A */}
                      <div className="px-5 py-3 border-b border-gray-50">
                        <p className="text-xs italic text-gray-700 leading-relaxed mb-1">
                          "{highlight(row.snapshotA, searchQuery)}"
                        </p>
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs text-[#1B6B7B]">{highlight(row.citationA, searchQuery)}</p>
                          {row.bookIdA && (
                            <button onClick={() => onOpenBook(row.bookIdA, row.passageIdA)} className="text-xs text-gray-400 hover:text-[#1B6B7B] shrink-0 hover:underline">
                              Open →
                            </button>
                          )}
                        </div>
                      </div>
                      {/* Side B */}
                      <div className="px-5 py-3">
                        <p className="text-xs italic text-gray-700 leading-relaxed mb-1">
                          "{highlight(row.snapshotB, searchQuery)}"
                        </p>
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs text-[#1B6B7B]">{highlight(row.citationB, searchQuery)}</p>
                          {row.bookIdB && (
                            <button onClick={() => onOpenBook(row.bookIdB, row.passageIdB)} className="text-xs text-gray-400 hover:text-[#1B6B7B] shrink-0 hover:underline">
                              Open →
                            </button>
                          )}
                        </div>
                      </div>
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
