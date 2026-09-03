'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { AnnotationCard } from './AnnotationCard';
import { useTranslation } from '@/contexts/LanguageProvider';
import { openInApp } from '@/lib/openInApp';
import { loadCatalog, bookLanguage } from '@/lib/catalog';

export type OpenBookFn = (
  bookId: string,
  passageId?: string,
  passageSnapshot?: string,
  appLink?: { slug: string; pid?: string; lang: string; snap: string },
) => void;

/**
 * Default "Open in reader" for the standalone share page. Hands off to the
 * Immerse app (immerse://read/<slug>?pid&lang&snap) with the web reader as the
 * fallback when the app is not installed.
 */
const DEFAULT_OPEN_BOOK: OpenBookFn = (bookId, passageId, _snap, appLink) => {
  if (typeof window === 'undefined') return;
  const webFallback = `/read/${bookId}${passageId ? `?p=${passageId}` : ''}${passageId ? '&' : '?'}flash=1`;
  if (appLink) {
    const qs = new URLSearchParams({ pid: appLink.pid ?? '', lang: appLink.lang, snap: appLink.snap });
    openInApp(`immerse://read/${encodeURIComponent(appLink.slug)}?${qs.toString()}`, webFallback);
  } else {
    window.location.href = webFallback;
  }
};

/**
 * Open a community-payload selection in the reader. The payload carries mobile
 * slugs (`bookId`) and text pids (`startPid`), so resolve them to the web's
 * book/passage UUIDs via book_slug_map + passage_pid_map. Passes the payload's
 * own snapshot text through too — if the pid isn't mapped (or maps to a
 * passage that no longer exists), ReaderPanel's loadBook falls back to a
 * snapshot-text content match instead of silently opening at the book's top.
 */
export async function openCommunitySelection(sel: any, onOpenBook: OpenBookFn) {
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

  const catalog = await loadCatalog();
  const lang = bookLanguage(catalog, slug ?? '');
  const snap = String(sel?.snapshotText ?? '').slice(0, 60);

  onOpenBook(bookUuid, passageUuid, sel?.snapshotText, { slug: slug!, pid, lang, snap });
}

// ── One expandable quote (feed + profile + share page) ───────────────────────

function CommunitySelection({ sel, onOpenBook, depth = 0 }: { sel: any; onOpenBook?: OpenBookFn; depth?: number }) {
  const { t } = useTranslation();
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
    <div className="pe-4 py-1.5" style={{ paddingLeft: 32 + depth * 16 }}>
      <AnnotationCard
        variant="discover"
        quote={sel.snapshotText}
        citation={citation}
        clampQuote={!expanded}
        onClick={() => setExpanded(e => !e)}
        footer={expanded && onOpenBook && sel.bookId ? (
          <button
            onClick={e => { e.stopPropagation(); handleOpen(); }}
            disabled={opening}
            className="mt-2 text-xs text-[#1B6B7B] dark:text-[#2D9DB3] font-medium hover:underline disabled:opacity-60"
          >
            {opening ? t('common.opening') : `${t('common.openInReader')} →`}
          </button>
        ) : undefined}
      />
    </div>
  );
}

// ── Payload tree helpers + tri-state checkbox ────────────────────────────────

export type CheckState = 'checked' | 'indeterminate' | 'unchecked';

export function childrenOf(payload: any[], exportId: string | null) {
  return (payload ?? [])
    .filter((t: any) => (t.parentExportId ?? null) === exportId)
    .sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || String(a.name).localeCompare(String(b.name)));
}

export function rootNodeOf(payload: any[]) {
  return (payload ?? []).find((t: any) => (t.parentExportId ?? null) === null) ?? (payload ?? [])[0];
}

export function subtreeExportIds(payload: any[], exportId: string): string[] {
  const out = [exportId];
  const queue = [exportId];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const c of childrenOf(payload, cur)) { out.push(c.exportId); queue.push(c.exportId); }
  }
  return out;
}

export function nodeCheckState(payload: any[], exportId: string, selectedIds: Set<string>): CheckState {
  const ids = subtreeExportIds(payload, exportId);
  const n = ids.filter(id => selectedIds.has(id)).length;
  if (n === 0) return 'unchecked';
  if (n === ids.length) return 'checked';
  return 'indeterminate';
}

export function Checkbox({ state, onChange }: { state: CheckState; onChange: () => void }) {
  return (
    <button
      onClick={e => { e.stopPropagation(); onChange(); }}
      className="flex items-center justify-center shrink-0 w-7 h-7 -ms-1"
    >
      <div className={`w-[18px] h-[18px] rounded border-2 flex items-center justify-center transition-colors ${
        state === 'checked'       ? 'bg-[#1B6B7B] dark:bg-[#2D9DB3] border-[#1B6B7B] dark:border-[#2D9DB3]' :
        state === 'indeterminate' ? 'border-[#1B6B7B] dark:border-[#2D9DB3]' : 'border-gray-300 dark:border-[#3A4D60]'
      }`}>
        {state === 'checked'       && <span className="text-white text-[10px] leading-none font-bold">✓</span>}
        {state === 'indeterminate' && <div className="w-2 h-0.5 bg-[#1B6B7B] dark:bg-[#2D9DB3] rounded-full" />}
      </div>
    </button>
  );
}

// One sub-tag node (depth ≥ 1) inside a card: (checkbox +) name + count + chevron,
// expandable into its own selections and nested children.
function SubTagNode({ node, payload, depth, readOnly, selectedIds, onToggleSelect, onOpenBook }: {
  node: any; payload: any[]; depth: number;
  readOnly?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (exportId: string) => void;
  onOpenBook?: OpenBookFn;
}) {
  const [open, setOpen] = useState(false);
  const kids = childrenOf(payload, node.exportId);
  const sels = node.selections ?? [];
  return (
    <div>
      {/* Sub-level divider: hairline inset to this sub-tag's indentation */}
      <div className="bg-gray-100 dark:bg-[#2D4050]" style={{ height: 1, marginLeft: 16 + depth * 16 }} />
      <div className="flex items-center gap-2 py-2 pe-4" style={{ paddingLeft: 16 + depth * 16 }}>
        {!readOnly && selectedIds && (
          <Checkbox state={nodeCheckState(payload, node.exportId, selectedIds)} onChange={() => onToggleSelect?.(node.exportId)} />
        )}
        <button className="flex-1 min-w-0 text-start text-sm text-gray-700 dark:text-[#B8C7D6] truncate" onClick={() => setOpen(o => !o)}>{node.name}</button>
        <span className="text-xs text-gray-400 dark:text-[#5C7A8E] shrink-0">{sels.length}</span>
        <span className={`text-gray-400 dark:text-[#5C7A8E] text-sm shrink-0 transition-transform cursor-pointer ${open ? 'rotate-90' : ''}`} onClick={() => setOpen(o => !o)}>›</span>
      </div>
      {open && (
        <div>
          {sels.map((sel: any, i: number) => <CommunitySelection key={i} sel={sel} depth={depth} onOpenBook={onOpenBook} />)}
          {kids.map((c: any) => (
            <SubTagNode key={c.exportId} node={c} payload={payload} depth={depth + 1}
              readOnly={readOnly} selectedIds={selectedIds} onToggleSelect={onToggleSelect} onOpenBook={onOpenBook} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Shared presentational tree ──────────────────────────────────────────────
//
// Renders the CONTENTS of a compilation's payload tree: the root node's own
// selections, then each child sub-tag. The root-level checkbox (in Discover's
// TagCard header) is the caller's concern — this matches what TagCard's
// expanded block renders today.

export function CompilationTree({
  payload,
  onOpenBook,
  readOnly = false,
  selectedIds,
  onToggleSelect,
}: {
  payload: any[];
  onOpenBook?: OpenBookFn;
  readOnly?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (exportId: string) => void;
}) {
  const list = Array.isArray(payload) ? payload : [];
  const root = rootNodeOf(list);
  const rootSels = root?.selections ?? [];
  const childTags = root ? childrenOf(list, root.exportId) : [];
  const effectiveOpenBook = onOpenBook ?? DEFAULT_OPEN_BOOK;

  return (
    <div>
      {rootSels.map((sel: any, i: number) => (
        <CommunitySelection key={i} sel={sel} depth={0} onOpenBook={effectiveOpenBook} />
      ))}
      {childTags.map((c: any) => (
        <SubTagNode
          key={c.exportId}
          node={c}
          payload={list}
          depth={1}
          readOnly={readOnly}
          selectedIds={readOnly ? undefined : selectedIds}
          onToggleSelect={onToggleSelect}
          onOpenBook={effectiveOpenBook}
        />
      ))}
    </div>
  );
}
