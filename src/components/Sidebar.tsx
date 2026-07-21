'use client';

import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import type { User } from '@supabase/supabase-js';
import type { ReactNode } from 'react';
import type { NavTab } from './AppShell';
import type { TranslationKey } from '@immerse/i18n';
import { useTranslation } from '@/contexts/LanguageProvider';
import {
  HomeIcon,
  LibraryIcon,
  TagIcon,
  NoteIcon,
  XRefIcon,
  SettingsIcon,
} from './Icons';

// Module level, so it cannot call the translation hook — it carries the key
// and the label is resolved at render, the same shape the mobile screens use
// for their module-level helpers.
const NAV_ITEMS: { tab: NavTab; labelKey: TranslationKey; icon: ReactNode }[] = [
  { tab: 'home',      labelKey: 'nav.home',     icon: <HomeIcon      size={20} /> },
  { tab: 'library',   labelKey: 'nav.library',  icon: <LibraryIcon   size={20} /> },
  { tab: 'tags',      labelKey: 'nav.tags',     icon: <TagIcon       size={18} /> },
  { tab: 'notes',     labelKey: 'nav.notes',    icon: <NoteIcon      size={18} /> },
  { tab: 'xrefs',     labelKey: 'nav.xrefs',    icon: <XRefIcon      size={18} /> },
  { tab: 'community', labelKey: 'nav.discover', icon: <span className="text-base">🌐</span> },
];

interface SidebarProps {
  activeTab:    NavTab;
  onTabChange:  (tab: NavTab) => void;
  user:         User | null;
}

export default function Sidebar({ activeTab, onTabChange, user }: SidebarProps) {
  const { t } = useTranslation();
  const [fullName, setFullName] = useState<string | null>(null);

  useEffect(() => {
    if (!user) { setFullName(null); return; }
    const supabase = createClient();
    supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single()
      .then(({ data }) => { if (data?.full_name) setFullName(data.full_name); });
  }, [user?.id]);
  const router = useRouter();
  const supabase = createClient();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  const displayName = user
    ? (fullName || user.user_metadata?.full_name || user.email || t('nav.reader'))
    : t('nav.guest');

  return (
    <div className="w-56 shrink-0 flex flex-col bg-[#1C2B35] text-white h-full">
      {/* Header */}
      <div className="px-5 pt-6 pb-5 border-b border-white/10">
        <div className="text-2xl font-bold tracking-tight">Immerse</div>
        <div className="text-xs text-white/50 mt-1 truncate">{displayName}</div>
      </div>

      {/* Nav items */}
      <nav className="flex-1 py-3">
        {NAV_ITEMS.map(({ tab, labelKey, icon }) => (
          <button
            key={tab}
            onClick={() => onTabChange(tab)}
            className={`w-full flex items-center gap-3 px-5 py-3.5 text-sm transition-colors text-left ${
              activeTab === tab
                ? 'bg-white/10 text-white font-medium'
                : 'text-white/70 hover:bg-white/5 hover:text-white'
            }`}
          >
            <span className="w-5 flex items-center justify-center shrink-0">{icon}</span>
            {t(labelKey)}
          </button>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-5 pb-6 pt-3 border-t border-white/10 flex items-center justify-between">
        <button
          onClick={user ? handleSignOut : () => router.push('/login')}
          className="text-xs text-white/40 hover:text-white/70 transition-colors"
        >
          {user ? t('nav.signOut') : t('home.signInCreate')}
        </button>
        <button
          onClick={() => onTabChange('settings')}
          className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors"
        >
          <SettingsIcon size={14} color="currentColor" />
          {t('nav.settings')}
        </button>
      </div>
    </div>
  );
}
