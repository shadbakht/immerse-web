'use client';

// Settings → Blocked users: everyone blocked from Discover's "⋮", with Unblock.
// Mirrors mobile's BlockedUsersScreen. Blocks live in Supabase (user_blocks).

import { useEffect, useState } from 'react';
import { useTranslation } from '@/contexts/LanguageProvider';
import { fetchBlockedProfiles, unblockUser, type BlockedProfile } from '@/lib/moderation';

export function BlockedUsersSection({ userId, cardClass, headClass }: { userId: string; cardClass: string; headClass: string }) {
  const { t } = useTranslation();
  const [list, setList] = useState<BlockedProfile[] | null>(null);

  useEffect(() => {
    let alive = true;
    fetchBlockedProfiles(userId).then(l => { if (alive) setList(l); }).catch(() => { if (alive) setList([]); });
    return () => { alive = false; };
  }, [userId]);

  async function unblock(p: BlockedProfile) {
    try {
      await unblockUser(userId, p.id);
      setList(prev => (prev ?? []).filter(x => x.id !== p.id));
    } catch {
      alert(t('common.tryAgain'));
    }
  }

  return (
    <section className={cardClass}>
      <div className={headClass}>{t('moderation.blockedUsers')}</div>
      {list === null ? (
        <p className="px-5 py-4 text-sm text-gray-400 dark:text-[#5C7A8E]">…</p>
      ) : list.length === 0 ? (
        <p className="px-5 py-4 text-sm text-gray-500 dark:text-[#8FA4B8]">{t('moderation.noBlocked')}</p>
      ) : list.map(p => (
        <div key={p.id} className="px-5 py-3 flex items-center justify-between gap-3 border-b last:border-b-0 border-gray-50 dark:border-[#2D4050]/60">
          <div className="min-w-0">
            <div className="text-sm text-gray-700 dark:text-[#D2DCE8] truncate">
              {p.full_name?.trim() || (p.username ? `@${p.username}` : t('discover.anonymous'))}
            </div>
            {!!p.full_name?.trim() && !!p.username && <div className="text-xs text-gray-400 dark:text-[#5C7A8E]">@{p.username}</div>}
          </div>
          <button onClick={() => unblock(p)} className="text-sm font-semibold text-[#1B6B7B] dark:text-[#2D9DB3] hover:underline shrink-0">
            {t('moderation.unblock')}
          </button>
        </div>
      ))}
    </section>
  );
}
