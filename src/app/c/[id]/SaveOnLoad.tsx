'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { copyCommunityTag } from '@/lib/shareLinks';
import { useTranslation } from '@/contexts/LanguageProvider';

type SaveState = 'idle' | 'saving' | 'saved' | 'signin';

/**
 * Handles the one-time "Save to my Compilations" flow for a shared compilation.
 *
 * - Always logs one `shared_compilation_viewed` analytics event on mount
 *   (fire-and-forget; never awaited, never throws).
 * - When the URL carries `?save=1`: if signed out, bounce to /login with a
 *   `redirect` back to `/c/<id>?save=1`; if signed in, run the idempotent copy
 *   and strip `save` from the URL afterwards.
 */
export default function SaveOnLoad({ id }: { id: string }) {
  const { t } = useTranslation();
  const [state, setState] = useState<SaveState>('idle');
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
      .insert({
        event_type: 'shared_compilation_viewed',
        properties: { compilation_id: id, saved: wantsSave },
        platform: 'web',
      })
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
        await copyCommunityTag(id, user.id);
        setState('saved');
      } catch {
        setState('idle');
      } finally {
        const url = new URL(window.location.href);
        url.searchParams.delete('save');
        window.history.replaceState({}, '', url.toString());
      }
    })();
  }, [id]);

  return (
    <div className="mt-8 border-t border-gray-100 pt-4 dark:border-[#2D4050]">
      {state === 'saved' ? (
        <p className="text-sm font-medium text-[#1B6B7B] dark:text-[#2D9DB3]">
          {'✓ '}
          {t('sharePage.saved')}
        </p>
      ) : (
        <>
          <a
            href={`/c/${id}?save=1`}
            className="inline-block rounded-lg bg-[#1B6B7B] px-4 py-2 text-sm font-medium text-white dark:bg-[#2D9DB3]"
          >
            {state === 'saving' ? t('sharePage.saving') : t('sharePage.save')}
          </a>
          <p className="mt-2 text-[11px] text-gray-400 dark:text-[#5C7A8E]">
            {t('sharePage.saveHint')}
          </p>
        </>
      )}
    </div>
  );
}
