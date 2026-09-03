'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { copySharedCompilation, saveSharedXrefs, type SaveXrefsResult } from '@/lib/sharedSets';
import { useTranslation } from '@/contexts/LanguageProvider';
import { openInApp } from '@/lib/openInApp';

type SaveState = 'idle' | 'saving' | 'saved' | 'signin';
export type ShareKind = 'compilation' | 'xrefs';

/**
 * Handles the one-time "save this to my library" flow for a shared set.
 *
 * - Always logs exactly ONE view event on mount — `shared_compilation_viewed`
 *   or `shared_xrefs_viewed` depending on `kind`. This component always
 *   mounts, so it is the single place either event is fired; neither view
 *   component may fire its own (that would double-count).
 * - When the URL carries `?save=1`: if signed out, bounce to /login with a
 *   `redirect` back to `/c/<id>?save=1`; if signed in, run the idempotent copy
 *   and strip `save` from the URL afterwards.
 *
 * `kind` defaults to 'compilation' so `SharedCompilationView`'s existing
 * `<SaveOnLoad id={id} />` call site is unchanged.
 */
export default function SaveOnLoad({ id, kind = 'compilation' }: { id: string; kind?: ShareKind }) {
  const { t } = useTranslation();
  const [state, setState] = useState<SaveState>('idle');
  const [partial, setPartial] = useState<SaveXrefsResult | null>(null);
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    const wantsSave =
      new URLSearchParams(window.location.search).get('save') === '1';

    const supabase = createClient();

    // Fire-and-forget: view analytics must never surface or block.
    void supabase
      .from('analytics_events')
      .insert(
        kind === 'xrefs'
          ? {
              event_type: 'shared_xrefs_viewed',
              properties: { shared_set_id: id, saved: wantsSave },
              platform: 'web',
            }
          : {
              event_type: 'shared_compilation_viewed',
              properties: { compilation_id: id, saved: wantsSave },
              platform: 'web',
            },
      )
      .then(() => {}, () => {});

    if (!wantsSave) return;

    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setState('signin');
        const dest = `/c/${id}?save=1`;
        window.location.href = `/login?redirect=${encodeURIComponent(dest)}`;
        return;
      }

      setState('saving');
      try {
        if (kind === 'xrefs') {
          setPartial(await saveSharedXrefs(id, user.id));
        } else {
          await copySharedCompilation(id, user.id);
        }
        setState('saved');
      } catch {
        setState('idle');
      } finally {
        const url = new URL(window.location.href);
        url.searchParams.delete('save');
        window.history.replaceState({}, '', url.toString());
      }
    })();
  }, [id, kind]);

  const savedText = (): string => {
    if (kind !== 'xrefs') return t('sharePage.saved');
    if (partial && partial.skipped > 0) {
      return t('sharePage.savedXrefsPartial', {
        saved: partial.saved,
        total: partial.total,
        skipped: partial.skipped,
      });
    }
    return t('sharePage.savedXrefs');
  };

  return (
    <div className="mt-8 border-t border-gray-100 pt-4 dark:border-[#2D4050]">
      {state === 'saved' ? (
        <p className="text-sm font-medium text-[#1B6B7B] dark:text-[#2D9DB3]">
          {'✓ '}
          {savedText()}
        </p>
      ) : (
        <>
          <button
            type="button"
            onClick={() =>
              openInApp(`immerse://c/${id}?save=1`, `/c/${id}?save=1`)
            }
            className="inline-block rounded-lg bg-[#1B6B7B] px-4 py-2 text-sm font-medium text-white dark:bg-[#2D9DB3]"
          >
            {state === 'saving'
              ? t('sharePage.saving')
              : kind === 'xrefs'
                ? t('sharePage.saveXrefs')
                : t('sharePage.save')}
          </button>
          <p className="mt-2 text-[11px] text-gray-400 dark:text-[#5C7A8E]">
            {t('sharePage.saveHint')}
          </p>
        </>
      )}
    </div>
  );
}
