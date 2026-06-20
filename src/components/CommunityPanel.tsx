'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  importCommunityTag,
  syncSubscribedTags,
  syncFollowedUsers,
  followUser,
  unfollowUser,
  type CommunityTagRow,
} from '@/lib/communitySync';
import { exportAsDocx, exportAsPdf, type TagRow } from '@/lib/tagExport';

const EMPTY_SET: Set<string> = new Set();

/** Build export-ready TagRow[] from a community tag's payload, keeping only the
 *  selected nodes (quotes + citations only — no notes/xrefs). */
function payloadToTagRows(ct: CommunityTag, exportIds: Set<string>): TagRow[] {
  const payload = Array.isArray(ct.payload) ? ct.payload : [];
  return (payload as any[])
    .filter(t => exportIds.has(t.exportId))
    .map(t => ({
      id:         `${ct.id}:${t.exportId}`,
      name:       t.name,
      parent_id:  t.parentExportId ? `${ct.id}:${t.parentExportId}` : null,
      depth:      t.depth ?? 0,
      sort_order: t.sortOrder ?? 0,
      created_at: '',
      visibility: 'published',
      selections: (t.selections ?? []).map((s: any, i: number) => ({
        id:            `${ct.id}:${t.exportId}:${i}`,
        snapshot_text: s.snapshotText ?? '',
        passage_id:    '',
        book_id:       '',
        citation:      s.citation ?? s.bookTitle ?? '',
      })),
    }));
}

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
        className={`font-serif text-sm text-gray-700 leading-relaxed cursor-pointer select-none ${expanded ? '' : 'line-clamp-3'}`}
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

// ── Payload tree helpers + tri-state checkbox ────────────────────────────────

type CheckState = 'checked' | 'indeterminate' | 'unchecked';

function childrenOf(payload: any[], exportId: string | null) {
  return (payload ?? [])
    .filter((t: any) => (t.parentExportId ?? null) === exportId)
    .sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || String(a.name).localeCompare(String(b.name)));
}

function rootNodeOf(payload: any[]) {
  return (payload ?? []).find((t: any) => (t.parentExportId ?? null) === null) ?? (payload ?? [])[0];
}

function subtreeExportIds(payload: any[], exportId: string): string[] {
  const out = [exportId];
  const queue = [exportId];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const c of childrenOf(payload, cur)) { out.push(c.exportId); queue.push(c.exportId); }
  }
  return out;
}

function nodeCheckState(payload: any[], exportId: string, selectedIds: Set<string>): CheckState {
  const ids = subtreeExportIds(payload, exportId);
  const n = ids.filter(id => selectedIds.has(id)).length;
  if (n === 0) return 'unchecked';
  if (n === ids.length) return 'checked';
  return 'indeterminate';
}

function Checkbox({ state, onChange }: { state: CheckState; onChange: () => void }) {
  return (
    <button
      onClick={e => { e.stopPropagation(); onChange(); }}
      className="flex items-center justify-center shrink-0 w-7 h-7 -ml-1"
    >
      <div className={`w-[18px] h-[18px] rounded border-2 flex items-center justify-center transition-colors ${
        state === 'checked'       ? 'bg-[#1B6B7B] border-[#1B6B7B]' :
        state === 'indeterminate' ? 'border-[#1B6B7B]' : 'border-gray-300'
      }`}>
        {state === 'checked'       && <span className="text-white text-[10px] leading-none font-bold">✓</span>}
        {state === 'indeterminate' && <div className="w-2 h-0.5 bg-[#1B6B7B] rounded-full" />}
      </div>
    </button>
  );
}

// One sub-tag node (depth ≥ 1) inside a card: checkbox + name + count + chevron,
// expandable into its own selections and nested children.
function SubTagNode({ node, payload, depth, selectedIds, onToggleSelect, onOpenBook }: {
  node: any; payload: any[]; depth: number;
  selectedIds: Set<string>;
  onToggleSelect: (exportId: string) => void;
  onOpenBook?: OpenBookFn;
}) {
  const [open, setOpen] = useState(false);
  const kids = childrenOf(payload, node.exportId);
  const sels = node.selections ?? [];
  return (
    <div>
      <div className="flex items-center gap-2 py-2 pr-4" style={{ paddingLeft: 16 + depth * 16 }}>
        <Checkbox state={nodeCheckState(payload, node.exportId, selectedIds)} onChange={() => onToggleSelect(node.exportId)} />
        <button className="flex-1 min-w-0 text-left text-sm text-gray-700 truncate" onClick={() => setOpen(o => !o)}>{node.name}</button>
        <span className="text-xs text-gray-400 shrink-0">{sels.length}</span>
        <span className={`text-gray-400 text-xs shrink-0 transition-transform cursor-pointer ${open ? 'rotate-90' : ''}`} onClick={() => setOpen(o => !o)}>›</span>
      </div>
      {open && (
        <div className="divide-y divide-gray-50 border-t border-gray-50">
          {sels.map((sel: any, i: number) => <CommunitySelection key={i} sel={sel} onOpenBook={onOpenBook} />)}
          {kids.map((c: any) => (
            <SubTagNode key={c.exportId} node={c} payload={payload} depth={depth + 1}
              selectedIds={selectedIds} onToggleSelect={onToggleSelect} onOpenBook={onOpenBook} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Tag card (feed + profile views) ──────────────────────────────────────────

function TagCard({
  ct,
  isImported,
  isOwn,
  onImport,
  onProfilePress,
  onOpenBook,
  selectedIds,
  onToggleSelect,
  showAuthor = true,
}: {
  ct:             CommunityTag;
  isImported:     boolean;
  isOwn?:         boolean;
  onImport:       (ct: CommunityTag) => void;
  onProfilePress: (ct: CommunityTag) => void;
  onOpenBook?:    OpenBookFn;
  selectedIds:    Set<string>;
  onToggleSelect: (ct: CommunityTag, exportId: string) => void;
  showAuthor?:    boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [importing, setImporting] = useState(false);
  const displayName = ct.profiles?.username ?? 'Anonymous';

  const payload = Array.isArray(ct.payload) ? ct.payload : [];
  const root = rootNodeOf(payload);
  const rootSels = root?.selections ?? [];
  const childTags = root ? childrenOf(payload, root.exportId) : [];

  const allSelections = useMemo(() => payload.flatMap((t: any) => t.selections ?? []), [payload]);

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
        {root && (
          <Checkbox
            state={nodeCheckState(payload, root.exportId, selectedIds)}
            onChange={() => onToggleSelect(ct, root.exportId)}
          />
        )}
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
          {(isOwn || isImported) ? (
            <button
              disabled
              title={isOwn ? 'This is your own tag' : 'Already imported'}
              className="text-xs font-semibold text-gray-400 bg-gray-100 px-3 py-1 rounded-full cursor-not-allowed"
            >
              {isOwn ? 'Import' : 'Imported'}
            </button>
          ) : (
            <button
              onClick={handleImport}
              disabled={importing}
              className="text-xs font-semibold text-white bg-[#1B6B7B] hover:bg-[#155a68] disabled:opacity-60 px-3 py-1 rounded-full transition-colors"
            >
              {importing ? '…' : 'Import'}
            </button>
          )}

          <span className="text-xs text-gray-400">{ct.selection_count}</span>

          <span
            className={`text-gray-400 text-xs transition-transform cursor-pointer ${expanded ? 'rotate-90' : ''}`}
            onClick={() => setExpanded(e => !e)}
          >
            ›
          </span>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-50 divide-y divide-gray-50">
          {rootSels.map((sel: any, i: number) => (
            <CommunitySelection key={i} sel={sel} onOpenBook={onOpenBook} />
          ))}
          {childTags.map((c: any) => (
            <SubTagNode
              key={c.exportId}
              node={c}
              payload={payload}
              depth={1}
              selectedIds={selectedIds}
              onToggleSelect={(exportId) => onToggleSelect(ct, exportId)}
              onOpenBook={onOpenBook}
            />
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
  selection,
  onToggleSelect,
  currentUserId,
}: {
  title:          string;
  tags:           CommunityTag[];
  loading:        boolean;
  searchQuery:    string;
  subscribedIds:  Set<string>;
  onImport:       (ct: CommunityTag) => void;
  onProfilePress: (ct: CommunityTag) => void;
  onOpenBook?:    OpenBookFn;
  selection:      Map<string, Set<string>>;
  onToggleSelect: (ct: CommunityTag, exportId: string) => void;
  currentUserId?: string;
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
                isOwn={!!currentUserId && ct.user_id === currentUserId}
                onImport={onImport}
                onProfilePress={onProfilePress}
                onOpenBook={onOpenBook}
                selectedIds={selection.get(ct.id) ?? EMPTY_SET}
                onToggleSelect={onToggleSelect}
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
  selection,
  onToggleSelect,
}: {
  profile:       ProfileUser;
  currentUserId: string;
  subscribedIds: Set<string>;
  onImport:      (ct: CommunityTagRow) => void;
  onBack:        () => void;
  onOpenBook?:   OpenBookFn;
  selection:      Map<string, Set<string>>;
  onToggleSelect: (ct: CommunityTag, exportId: string) => void;
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
                isOwn={ct.user_id === currentUserId}
                onImport={onImport}
                onProfilePress={() => {}}
                onOpenBook={onOpenBook}
                selectedIds={selection.get(ct.id) ?? EMPTY_SET}
                onToggleSelect={onToggleSelect}
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

  // Export selection: ctId → set of selected exportIds (tag nodes within that card).
  const [selection, setSelection] = useState<Map<string, { ct: CommunityTag; ids: Set<string> }>>(new Map());
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [exporting, setExporting] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // Per-ct view of the selection (just the id sets) for passing to cards.
  const selectionIds = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const [ctId, { ids }] of selection) m.set(ctId, ids);
    return m;
  }, [selection]);

  const selectedCount = useMemo(
    () => [...selection.values()].reduce((sum, { ids }) => sum + ids.size, 0),
    [selection],
  );

  const toggleSelect = useCallback((ct: CommunityTag, exportId: string) => {
    const payload = Array.isArray(ct.payload) ? ct.payload : [];
    const ids = subtreeExportIds(payload, exportId);
    setSelection(prev => {
      const next = new Map(prev);
      const cur = new Set(next.get(ct.id)?.ids ?? []);
      const allSel = ids.every(id => cur.has(id));
      if (allSel) ids.forEach(id => cur.delete(id));
      else ids.forEach(id => cur.add(id));
      if (cur.size === 0) next.delete(ct.id);
      else next.set(ct.id, { ct, ids: cur });
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => setSelection(new Map()), []);

  async function handleExport(format: 'pdf' | 'docx') {
    setShowExportMenu(false);
    setExporting(true);
    try {
      const tagRows = [...selection.values()].flatMap(({ ct, ids }) => payloadToTagRows(ct, ids));
      const opts = { includeNotes: false, includeXrefs: false };
      if (format === 'pdf') await exportAsPdf(tagRows, opts);
      else                  await exportAsDocx(tagRows, opts);
    } catch (e) {
      console.warn('[Community] export error:', e);
    } finally {
      setExporting(false);
    }
  }

  useEffect(() => {
    if (!showExportMenu) return;
    function onDown(e: MouseEvent) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) setShowExportMenu(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [showExportMenu]);

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
        selection={selectionIds}
        onToggleSelect={toggleSelect}
      />
    );
  }

  // ── Feed view ───────────────────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col w-full relative">
      {/* Header + search */}
      <div className="px-4 pt-4 pb-3 shrink-0 border-b border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-semibold text-gray-900">Community</h1>
          {selectedCount > 0 && (
            <div className="flex items-center gap-2">
              <button onClick={clearSelection} className="text-xs text-gray-500 hover:text-gray-700">Clear</button>
              <div className="relative" ref={exportMenuRef}>
                <button
                  onClick={() => setShowExportMenu(v => !v)}
                  disabled={exporting}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1B6B7B] text-white text-sm font-medium rounded-lg hover:bg-[#1B6B7B]/90 disabled:opacity-60 transition-colors"
                  title="Export selected tags"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="17 8 12 3 7 8"/>
                    <line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                  {exporting ? 'Exporting…' : `Export (${selectedCount})`}
                </button>
                {showExportMenu && (
                  <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-gray-200 z-20 min-w-[160px] py-1">
                    {([{ label: 'PDF', format: 'pdf' }, { label: 'Word (.docx)', format: 'docx' }] as const).map(({ label, format }) => (
                      <button
                        key={format}
                        onClick={() => handleExport(format)}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={selectedCount > 0 ? 'Search selected tags…' : 'Search tags and users…'}
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
          selection={selectionIds}
          onToggleSelect={toggleSelect}
          currentUserId={user?.id}
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
          selection={selectionIds}
          onToggleSelect={toggleSelect}
          currentUserId={user?.id}
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
