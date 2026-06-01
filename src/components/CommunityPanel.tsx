'use client';

import { useEffect, useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';

interface CommunityTag {
  id: string;
  user_id: string;
  name: string;
  payload: any[];
  selection_count: number;
  import_count: number;
  published_at: string;
  updated_at: string;
  profiles: { full_name: string | null; username: string | null } | null;
}

interface CommunityPanelProps {
  user: import('@supabase/supabase-js').User | null;
}

const PAGE_SIZE = 20;

function formatDate(iso: string) {
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60)     return 'just now';
  if (diff < 3600)   return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function TagCard({ ct }: { ct: CommunityTag }) {
  const [expanded, setExpanded] = useState(false);
  const displayName = ct.profiles?.full_name || ct.profiles?.username || 'Anonymous';
  const allSelections = useMemo(() => {
    if (!Array.isArray(ct.payload)) return [];
    return ct.payload.flatMap((t: any) => t.selections ?? []);
  }, [ct.payload]);
  const lastAddedAt = useMemo(() => {
    const dates = allSelections.map((s: any) => s.createdAt).filter(Boolean);
    if (dates.length === 0) return ct.updated_at;
    return dates.reduce((max: string, d: string) => (d > max ? d : max), dates[0]);
  }, [allSelections, ct.updated_at]);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <button
        className="w-full text-left px-5 py-4 flex items-center gap-3"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-gray-900 truncate">{ct.name}</div>
          <div className="text-xs text-gray-400 mt-0.5">
            <span className="text-[#1B6B7B]">@{displayName}</span>
            {'  ·  '}{formatDate(lastAddedAt)}
            {'  ·  '}{ct.import_count} {ct.import_count === 1 ? 'import' : 'imports'}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-gray-400">{ct.selection_count}</span>
          <span className={`text-gray-400 text-lg transition-transform ${expanded ? 'rotate-90' : ''}`}>›</span>
        </div>
      </button>

      {expanded && allSelections.length > 0 && (
        <div className="border-t border-gray-50 divide-y divide-gray-50">
          {allSelections.map((sel: any, i: number) => (
            <div key={i} className="px-5 py-3">
              <p className="text-xs italic text-gray-700 leading-relaxed line-clamp-3">"{sel.snapshotText}"</p>
              {(sel.citation || sel.bookTitle) && (
                <p className="text-xs text-gray-400 mt-1">{sel.citation ?? sel.bookTitle}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CommunityPanel({ user }: CommunityPanelProps) {
  const supabase = createClient();
  const [tab, setTab] = useState<'recent' | 'trending'>('recent');
  const [tags, setTags] = useState<CommunityTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  async function load(currentTab: 'recent' | 'trending') {
    setLoading(true);
    try {
      let query = supabase
        .from('community_tags')
        .select('id, user_id, name, payload, selection_count, import_count, published_at, updated_at, profiles(full_name, username)')
        .order(currentTab === 'trending' ? 'import_count' : 'published_at', { ascending: false })
        .range(0, PAGE_SIZE - 1);
      if (currentTab === 'trending') query = (query as any).order('published_at', { ascending: false });
      const { data } = await query;
      setTags(data ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(tab); }, [tab]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return tags;
    return tags.filter(ct =>
      ct.name?.toLowerCase().includes(q) ||
      ct.profiles?.username?.toLowerCase().includes(q) ||
      ct.profiles?.full_name?.toLowerCase().includes(q),
    );
  }, [tags, searchQuery]);

  return (
    <div className="h-full flex flex-col relative">
      {/* Search */}
      <div className="px-6 pt-6 pb-3 shrink-0 border-b border-gray-100">
        <h1 className="text-2xl font-semibold text-gray-900 mb-4">Community</h1>
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search tags and users…"
            className="w-full pl-9 pr-4 py-2 text-sm text-gray-900 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#1B6B7B]/30 focus:border-[#1B6B7B] bg-gray-50"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-100 shrink-0">
        {(['recent', 'trending'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
              tab === t
                ? 'border-[#1B6B7B] text-[#1B6B7B]'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-6 h-6 border-2 border-[#1B6B7B] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-3xl mb-3">{searchQuery ? '🔍' : '🏷️'}</p>
            <p className="text-sm font-semibold text-gray-700 mb-1">{searchQuery ? 'No results' : 'No shared tags yet'}</p>
            <p className="text-xs text-gray-400">{searchQuery ? 'Try a different search term.' : 'Be the first to share a tag.'}</p>
          </div>
        ) : (
          <div className="space-y-3 max-w-2xl mx-auto">
            {filtered.map(ct => <TagCard key={ct.id} ct={ct} />)}
          </div>
        )}
      </div>

      {/* Guest / non-pro overlay */}
      {!user && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center px-8">
          <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center shadow-xl">
            <div className="text-4xl mb-4">✦</div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">Sign In to Access Community</h2>
            <p className="text-sm text-gray-500 leading-relaxed mb-6">
              See what other readers are discovering across all traditions.
            </p>
            <a
              href="/login"
              className="block w-full bg-[#1B6B7B] text-white font-semibold py-3 rounded-xl hover:bg-[#155a68] transition-colors text-sm"
            >
              Sign In or Create Account
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
