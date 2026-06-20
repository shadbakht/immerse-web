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
  onOpenBook?: (bookId: string, passageId?: string) => void;
}

type OpenBookFn = (bookId: string, passageId?: string) => void;

const PAGE_SIZE = 20;

/**
 * Open a community-payload selection in the reader. The payload carries mobile
 * slugs (`bookId`) and text pids (`startPid`), so resolve them to the web's
 * book/passage UUIDs via book_slug_map + passage_pid_map. Falls back to opening
 * the book at the top if the pid isn't mapped.
 */
async function openCommunitySelection(sel: any, onOpenBook: OpenBookFn) {
  const slug = sel?.bookId as string | undefined;
  const pid  = sel?.startPid as string | undefined;
  if (!slug) return;

  const supabase = createClient();
  const { data: bookRow } = await supabase
    .from('book_slug_map')
    .select('book_id')
    .eq('local_id', slug)
    .maybeSingle();
  const bookUuid = (bookRow as { book_id?: string } | null)?.book_id;
  if (!bookUuid) return;

  let passageUuid: string | undefined;
  if (pid) {
    const { data: pidRow } = await supabase
      .from('passage_pid_map')
      .select('passage_id')
      .eq('pid', pid)
      .maybeSingle();
    passageUuid = (pidRow as { passage_id?: string } | null)?.passage_id;
  }
  onOpenBook(bookUuid, passageUuid);
}

// ── One expandable quote (feed + profile) ────────────────────────────────────

function CommunitySelection({ sel, onOpenBook }: { sel: any; onOpenBook?: OpenBookFn }) {
  const [expanded, setExpanded] = useState(false);
  const [opening, setOpening]   = useState(false);
  const citation = sel.citation ?? sel.bookTitle;

  async function handleOpen() {
    if (!onOpenBook || opening) return;
    setOpening(true);
    try { await openCommunitySelection(sel, onOpenBook); }
    finally { setOpening(false); }
  }

  return (
    <div className="px-5 py-3">
      <p
        className={`font-serif text-xs italic text-gray-700 leading-relaxed cursor-pointer select-none ${expanded ? '' : 'line-clamp-3'}`}
        onClick={() => setExpanded(e => !e)}
      >
        &quot;{sel.snapshotText}&quot;
      </p>
      {citation && <p className="text-xs text-gray-400 mt-1">{citation}</p>}
      {expanded && onOpenBook && sel.bookId && (
        <button
          onClick={handleOpen}
          disabled={opening}
          className="mt-2 text-xs text-[#1B6B7B] font-medium hover:underline disabled:opacity-60"
        >
          {opening ? 'Opening…' : 'Open in reader →'}
        </button>
      )}
    </div>
  );
}

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
  onOpenBook,
  showAuthor = true,
}: {
  ct:             CommunityTag;
  isImported:     boolean;
  onImport:       (ct: CommunityTag) => void;
  onProfilePress: (ct: CommunityTag) => void;
  onOpenBook?:    OpenBookFn;
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
            <CommunitySelection key={i} sel={sel} onOpenBook={onOpenBook} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Feed column ───────────────────────────────────────────────────────────────

function FeedColumn({
  title,
  tags,
  loading,
  searchQuery,
  subscribedIds,
  onImport,
  onProfilePress,
  onOpenBook,
}: {
  title:          string;
  tags:           CommunityTag[];
  loading:        boolean;
  searchQuery:    string;
  subscribedIds:  Set<string>;
  onImport:       (ct: CommunityTag) => void;
  onProfilePress: (ct: CommunityTag) => void;
  onOpenBook?:    OpenBookFn;
}) {
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
    <div className="flex-1 flex flex-col overflow-hidden min-w-0">
      <div className="px-4 py-2.5 border-b border-gray-100 shrink-0">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{title}</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-6 h-6 border-2 border-[#1B6B7B] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-4">
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
                onImport={onImport}
                onProfilePress={onProfilePress}
                onOpenBook={onOpenBook}
              />
            ))}
          </div>
        )}
      </div>
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
  onOpenBook,
}: {
  profile:       ProfileUser;
  currentUserId: string;
  subscribedIds: Set<string>;
  onImport:      (ct: CommunityTagRow) => void;
  onBack:        () => void;
  onOpenBook?:   OpenBookFn;
}) {
  const supabase      = createClient();
  const [tags, setTags]               = useState<CommunityTag[]>([]);
  const [loading, setLoading]         = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('community_tags')
      .select('id, user_id, name, payload, selection_count, import_count, published_at, updated_at, profiles(full_name, username)')
      .eq('user_id', profile.userId)
      .order('updated_at', { ascending: false })
      .then(({ data }) => {
        setTags((data ?? []) as unknown as CommunityTag[]);
        setLoading(false);
      });

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

        <div className="flex items-center gap-2 shrink-0">
          {profile.userId !== currentUserId && (
            <span className="text-[10px] leading-tight text-gray-400 text-right max-w-[120px]">
              Auto-imports user&apos;s public tags to your app
            </span>
          )}
          <button
            onClick={profile.userId === currentUserId ? undefined : handleFollowToggle}
            disabled={profile.userId === currentUserId || followLoading}
            className={`text-xs font-semibold px-4 py-1.5 rounded-full border-[1.5px] transition-colors disabled:opacity-60 ${
              profile.userId === currentUserId
                ? 'border-gray-300 text-gray-400 cursor-not-allowed'
                : isFollowing
                  ? 'bg-[#1B6B7B] border-[#1B6B7B] text-white'
                  : 'border-[#1B6B7B] text-[#1B6B7B] hover:bg-[#1B6B7B]/5'
            }`}
          >
            {profile.userId === currentUserId ? 'Follow' : followLoading ? '…' : isFollowing ? 'Unfollow' : 'Follow'}
          </button>
        </div>
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
                onOpenBook={onOpenBook}
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

export default function CommunityPanel({ user, onOpenBook }: CommunityPanelProps) {
  const supabase = createClient();
  const [recentTags, setRecentTags]       = useState<CommunityTag[]>([]);
  const [trendingTags, setTrendingTags]   = useState<CommunityTag[]>([]);
  const [recentLoading, setRecentLoading]   = useState(true);
  const [trendingLoading, setTrendingLoading] = useState(true);
  const [searchQuery, setSearchQuery]     = useState('');
  const [subscribedIds, setSubscribedIds] = useState<Set<string>>(new Set());
  const [profileView, setProfileView]     = useState<ProfileUser | null>(null);

  const loadSubscribedIds = useCallback(async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from('community_tag_subscriptions')
      .select('community_tag_id')
      .eq('subscriber_id', user.id);
    setSubscribedIds(new Set((data ?? []).map((r: { community_tag_id: string }) => r.community_tag_id)));
  }, [user?.id]);

  async function loadRecent() {
    setRecentLoading(true);
    try {
      const { data } = await supabase
        .from('community_tags')
        .select('id, user_id, name, payload, selection_count, import_count, published_at, updated_at, profiles(full_name, username)')
        .order('published_at', { ascending: false })
        .range(0, PAGE_SIZE - 1);
      setRecentTags((data ?? []) as unknown as CommunityTag[]);
    } finally {
      setRecentLoading(false);
    }
  }

  async function loadTrending() {
    setTrendingLoading(true);
    try {
      const { data } = await (supabase
        .from('community_tags')
        .select('id, user_id, name, payload, selection_count, import_count, published_at, updated_at, profiles(full_name, username)')
        .order('import_count', { ascending: false }) as any)
        .order('published_at', { ascending: false })
        .range(0, PAGE_SIZE - 1);
      setTrendingTags((data ?? []) as unknown as CommunityTag[]);
    } finally {
      setTrendingLoading(false);
    }
  }

  useEffect(() => {
    loadRecent();
    loadTrending();
    loadSubscribedIds();
    if (user?.id) {
      syncSubscribedTags(user.id).catch(e => console.warn('[Community] syncSubscribed error:', e));
      syncFollowedUsers(user.id).catch(e => console.warn('[Community] syncFollowed error:', e));
    }
  }, []);

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

  // ── Profile view ────────────────────────────────────────────────────────────
  if (profileView && user?.id) {
    return (
      <ProfileView
        profile={profileView}
        currentUserId={user.id}
        subscribedIds={subscribedIds}
        onImport={handleImport}
        onBack={() => setProfileView(null)}
        onOpenBook={onOpenBook}
      />
    );
  }

  // ── Feed view ───────────────────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col w-full relative">
      {/* Header + search */}
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

      {/* Two-column split */}
      <div className="flex-1 flex overflow-hidden">
        <FeedColumn
          title="Recent"
          tags={recentTags}
          loading={recentLoading}
          searchQuery={searchQuery}
          subscribedIds={subscribedIds}
          onImport={handleImport}
          onProfilePress={handleProfilePress}
          onOpenBook={onOpenBook}
        />
        <div className="w-px bg-gray-200 shrink-0" />
        <FeedColumn
          title="Trending"
          tags={trendingTags}
          loading={trendingLoading}
          searchQuery={searchQuery}
          subscribedIds={subscribedIds}
          onImport={handleImport}
          onProfilePress={handleProfilePress}
          onOpenBook={onOpenBook}
        />
      </div>

      {/* Guest overlay */}
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
