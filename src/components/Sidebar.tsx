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
  DiscoverIcon,
  SettingsIcon,
} from './Icons';

// Module level, so it cannot call the translation hook — it carries the key
// and the label is resolved at render, the same shape the mobile screens use
// for their module-level helpers.
//
// Every destination is one flat geometric glyph in its own colour, so the row
// is identifiable by shape and hue alike. Home is the only neutral one — it
// brightens to white when selected and sits back in grey when it isn't, which
// is why `icon` is a function of the active state rather than an element.
const NAV_ITEMS: { tab: NavTab; labelKey: TranslationKey; icon: (active: boolean) => ReactNode }[] = [
  { tab: 'home',      labelKey: 'nav.home',     icon: (active) => <HomeIcon size={20} color={active ? '#FFFFFF' : 'rgba(255,255,255,0.80)'} /> },
  { tab: 'library',   labelKey: 'nav.library',  icon: () => <LibraryIcon  size={18} /> },
  { tab: 'tags',      labelKey: 'nav.tags',     icon: () => <TagIcon      size={18} /> },
  { tab: 'notes',     labelKey: 'nav.notes',    icon: () => <NoteIcon     size={18} /> },
  { tab: 'xrefs',     labelKey: 'nav.xrefs',    icon: () => <XRefIcon     size={18} /> },
  { tab: 'community', labelKey: 'nav.discover', icon: () => <DiscoverIcon size={18} /> },
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
            className={`w-full flex items-center gap-3 px-5 py-3.5 text-sm transition-colors text-start ${
              activeTab === tab
                ? 'bg-white/10 text-white font-medium'
                : 'text-white/70 hover:bg-white/5 hover:text-white'
            }`}
          >
            {/* w-6 — wide enough for the Library glyph, the widest of the six */}
            <span className="w-6 flex items-center justify-center shrink-0">{icon(activeTab === tab)}</span>
            {t(labelKey)}
          </button>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-5 pb-6 pt-3 border-t border-white/10 flex items-center justify-between gap-3">
        {user ? (
          <button
            onClick={handleSignOut}
            className="text-xs text-white/40 hover:text-white/70 transition-colors"
          >
            {t('nav.signOut')}
          </button>
        ) : (
          // Filled pill, not a subtle text link — a guest's route to signing
          // in should stand out, not blend into the sign-out/settings row.
          <button
            onClick={() => router.push('/login')}
            className="bg-[#1B6B7B] dark:bg-[#2D9DB3] text-white text-xs font-semibold px-4 py-2 rounded-full hover:bg-[#155a68] dark:hover:bg-[#2589A0] transition-colors text-start shrink-0"
          >
            {t('home.signInCreate')}
          </button>
        )}
        {/* Icon-only — a labeled button here was getting clipped by the
            sidebar's fixed width once the sign-in pill grew wider than the
            old text link. Sized to match the pill's own height. */}
        <button
          onClick={() => onTabChange('settings')}
          aria-label={t('nav.settings')}
          className="w-9 h-9 flex items-center justify-center rounded-full text-white/65 hover:text-white/90 hover:bg-white/5 transition-colors shrink-0"
        >
          <SettingsIcon size={20} color="currentColor" />
        </button>
      </div>
    </div>
  );
}
