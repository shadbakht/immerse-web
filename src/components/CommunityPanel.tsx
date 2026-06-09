'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  importCommunityTag,
  syncSubscribedTags,
  syncFollowedUsers,
  followUser,
  unfollowUser,
  type CommunityTagRow,
} from '@/lib/communitySync';

interface CommunityTag extends CommunityTagRow {
  import_count: number;
  profiles: { full_name: string | null; username: string | null } | null;
}

interface ProfileUser {
  userId:      string;
  displayName: string;
  username:    string | null;
}

interface CommunityPanelProps {
  user: import('@supabase/supabase-js').User | null;
}

const PAGE_SIZE = 20;

function formatDate(iso: string) {
  const d    = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60)     return 'just now';
  if (diff < 3600)   return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// ── Tag card (feed + profile views) ──────────────────────────────────────────

function TagCard({
  ct,
  isImported,
  onImport,
  onProfilePress,
  showAuthor = true,
}: {
  ct:             CommunityTag;
  isImported:     boolean;
  onImport:       (ct: CommunityTag) => void;
  onProfilePress: (ct: CommunityTag) => void;
  showAuthor?:    boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [importing, setImporting] = useState(false);
  const displayName = ct.profiles?.username ?? 'Anonymous';

  const allSelections = useMemo(() => {
    if (!Array.isArray(ct.payload)) return [];
    return ct.payload.flatMap((t: any) => t.selections ?? []);
  }, [ct.payload]);

  const lastAddedAt = useMemo(() => {
    const dates = allSelections.map((s: any) => s.createdAt).filter(Boolean);
    if (dates.length === 0) return ct.updated_at;
    return dates.reduce((max: string, d: string) => (d > max ? d : max), dates[0]);
  }, [allSelections, ct.updated_at]);

  async function handleImport(e: React.MouseEvent) {
    e.stopPropagation();
    setImporting(true);
    await onImport(ct);
    setImporting(false);
  }

  return (
    <div className="border-b border-gray-100">
      <div className="flex items-center px-4 py-3.5 gap-2">
        <div
          className="flex-1 min-w-0 cursor-pointer"
          onClick={() => setExpanded(e => !e)}
        >
          <div className="text-sm font-medium text-gray-800 truncate">{ct.name}</div>
          <div className="text-xs text-gray-400 mt-0.5">
            {showAuthor && (
              <>
                <button
                  className="text-[#1B6B7B] hover:underline"
                  onClick={e => { e.stopPropagation(); onProfilePress(ct); }}
                >
                  @{displayName}
                </button>
                {'  ·  '}
              </>
            )}
            {formatDate(lastAddedAt)}
            {'  ·  '}{ct.import_count} {ct.import_count === 1 ? 'import' : 'imports'}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-gray-400">{ct.selection_count}</span>

          {isImported ? (
            <span className="text-xs font-medium text-[#1B6B7B] bg-[#1B6B7B]/10 px-2 py-1 rounded-full">
              Imported
            </span>
          ) : (
            <button
              onClick={handleImport}
              disabled={importing}
              className="text-xs font-semibold text-white bg-[#1B6B7B] hover:bg-[#155a68] disabled:opacity-60 px-3 py-1 rounded-full transition-colors"
            >
              {importing ? '…' : 'Import'}
            </button>
          )}

          <span
            className={`text-gray-400 text-xs transition-transform cursor-pointer ${expanded ? 'rotate-90' : ''}`}
            onClick={() => setExpanded(e => !e)}
          >
            ›
          </span>
        </div>
      </div>

      {expanded && allSelections.length > 0 && (
        <div className="border-t border-gray-50 divide-y divide-gray-50">
          {allSelections.map((sel: any, i: number) => (
            <div key={i} className="px-5 py-3">
              <p className="font-serif text-xs italic text-gray-700 leading-relaxed line-clamp-3">"{sel.snapshotText}"</p>
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

// ── Publisher profile view ────────────────────────────────────────────────────

function ProfileView({
  profile,
  currentUserId,
  subscribedIds,
  onImport,
  onBack,
}: {
  profile:       ProfileUser;
  currentUserId: string;
  subscribedIds: Set<string>;
  onImport:      (ct: CommunityTagRow) => void;
  onBack:        () => void;
}) {
  const supabase      = createClient();
  const [tags, setTags]               = useState<CommunityTag[]>([]);
  const [loading, setLoading]         = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(true);

  useEffect(() => {
    // Load tags
    supabase
      .from('community_tags')
      .select('id, user_id, name, payload, selection_count, import_count, published_at, updated_at, profiles(full_name, username)')
      .eq('user_id', profile.userId)
      .order('updated_at', { ascending: false })
      .then(({ data }) => {
        setTags((data ?? []) as unknown as CommunityTag[]);
        setLoading(false);
      });

    // Load follow state
    if (profile.userId === currentUserId) {
      setFollowLoading(false);
      return;
    }
    supabase
      .from('community_user_follows')
      .select('id')
      .eq('subscriber_id', currentUserId)
      .eq('followed_user_id', profile.userId)
      .maybeSingle()
      .then(({ data }) => {
        setIsFollowing(!!data);
        setFollowLoading(false);
      });
  }, [profile.userId, currentUserId]);

  async function handleFollowToggle() {
    if (followLoading) return;
    setFollowLoading(true);
    try {
      if (isFollowing) {
        await unfollowUser(currentUserId, profile.userId);
        setIsFollowing(false);
      } else {
        await followUser(currentUserId, profile.userId);
        setIsFollowing(true);
      }
    } catch (e) {
      console.warn('[CommunityPanel] follow toggle error:', e);
    }
    setFollowLoading(false);
  }

  const initials = profile.displayName[0]?.toUpperCase() ?? '?';

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 pt-5 pb-4 shrink-0 border-b border-gray-100 flex items-center gap-3">
        <button
          onClick={onBack}
          className="text-2xl text-[#1B6B7B] leading-none w-8 shrink-0"
          aria-label="Back"
        >
          ‹
        </button>

        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-full bg-[#1B6B7B] flex items-center justify-center shrink-0">
            <span className="text-white font-bold text-base">{initials}</span>
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold text-gray-900 truncate">{profile.displayName}</div>
            {profile.username && (
              <div className="text-xs text-gray-400">@{profile.username}</div>
            )}
          </div>
        </div>

        {profile.userId !== currentUserId && (
          <button
            onClick={handleFollowToggle}
            disabled={followLoading}
            className={`shrink-0 text-xs font-semibold px-4 py-1.5 rounded-full border-[1.5px] transition-colors disabled:opacity-50 ${
              isFollowing
                ? 'bg-[#1B6B7B] border-[#1B6B7B] text-white'
                : 'border-[#1B6B7B] text-[#1B6B7B] hover:bg-[#1B6B7B]/5'
            }`}
          >
            {followLoading ? '…' : isFollowing ? 'Following' : 'Follow'}
          </button>
        )}
      </div>

      {/* Tag list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-6 h-6 border-2 border-[#1B6B7B] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : tags.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-3xl mb-3">🏷️</p>
            <p className="text-sm font-semibold text-gray-700 mb-1">No public tags</p>
            <p className="text-xs text-gray-400">This user hasn't shared any tags yet.</p>
          </div>
        ) : (
          <div>
            {tags.map(ct => (
              <TagCard
                key={ct.id}
                ct={ct}
                isImported={subscribedIds.has(ct.id)}
                onImport={onImport}
                onProfilePress={() => {}}
                showAuthor={false}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

export default function CommunityPanel({ user }: CommunityPanelProps) {
  const supabase    = createClient();
  const [tab, setTab]           = useState<'recent' | 'trending'>('recent');
  const [tags, setTags]         = useState<CommunityTag[]>([]);
  const [loading, setLoading]   = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [subscribedIds, setSubscribedIds] = useState<Set<string>>(new Set());
  const [profileView, setProfileView]     = useState<ProfileUser | null>(null);

  // Load the set of community_tag IDs the user has already imported
  const loadSubscribedIds = useCallback(async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from('community_tag_subscriptions')
      .select('community_tag_id')
      .eq('subscriber_id', user.id);
    setSubscribedIds(new Set((data ?? []).map((r: { community_tag_id: string }) => r.community_tag_id)));
  }, [user?.id]);

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
      setTags((data ?? []) as unknown as CommunityTag[]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(tab);
    loadSubscribedIds();
    // Silently sync on panel mount
    if (user?.id) {
      syncSubscribedTags(user.id).catch(e => console.warn('[Community] syncSubscribed error:', e));
      syncFollowedUsers(user.id).catch(e => console.warn('[Community] syncFollowed error:', e));
    }
  }, [tab]);

  const handleImport = useCallback(async (ct: CommunityTagRow) => {
    if (!user?.id) return;
    try {
      await importCommunityTag(ct, user.id);
      setSubscribedIds(prev => new Set(prev).add(ct.id));
    } catch (e) {
      console.warn('[Community] import error:', e);
    }
  }, [user?.id]);

  const handleProfilePress = useCallback((ct: CommunityTag) => {
    const displayName = ct.profiles?.username ?? 'Anonymous';
    setProfileView({ userId: ct.user_id, displayName, username: ct.profiles?.username ?? null });
  }, []);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return tags;
    return tags.filter(ct =>
      ct.name?.toLowerCase().includes(q) ||
      ct.profiles?.username?.toLowerCase().includes(q) ||
      ct.profiles?.full_name?.toLowerCase().includes(q),
    );
  }, [tags, searchQuery]);

  // ── Profile view ────────────────────────────────────────────────────────────
  if (profileView && user?.id) {
    return (
      <ProfileView
        profile={profileView}
        currentUserId={user.id}
        subscribedIds={subscribedIds}
        onImport={handleImport}
        onBack={() => setProfileView(null)}
      />
    );
  }

  // ── Feed view ───────────────────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col max-w-2xl mx-auto w-full relative">
      {/* Search */}
      <div className="px-4 pt-4 pb-3 shrink-0 border-b border-gray-100">
        <h1 className="text-lg font-semibold text-gray-900 mb-3">Community</h1>
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
      <div className="flex-1 overflow-y-auto">
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
          <div>
            {filtered.map(ct => (
              <TagCard
                key={ct.id}
                ct={ct}
                isImported={subscribedIds.has(ct.id)}
                onImport={handleImport}
                onProfilePress={handleProfilePress}
              />
            ))}
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
