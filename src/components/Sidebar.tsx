'use client';

import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import type { ReactNode } from 'react';
import type { NavTab } from './AppShell';
import {
  HomeIcon,
  LibraryIcon,
  TagIcon,
  NoteIcon,
  XRefIcon,
  CommunityIcon,
  SettingsIcon,
} from './Icons';

const NAV_ITEMS: { tab: NavTab; label: string; icon: ReactNode }[] = [
  { tab: 'home',      label: 'Home',      icon: <HomeIcon      size={20} /> },
  { tab: 'library',   label: 'Library',   icon: <LibraryIcon   size={20} /> },
  { tab: 'tags',      label: 'Tags',      icon: <TagIcon       size={18} /> },
  { tab: 'notes',     label: 'Notes',     icon: <NoteIcon      size={18} /> },
  { tab: 'xrefs',     label: 'X-Refs',    icon: <XRefIcon      size={18} /> },
  { tab: 'community', label: 'Community', icon: <CommunityIcon size={20} /> },
];

interface SidebarProps {
  activeTab:    NavTab;
  onTabChange:  (tab: NavTab) => void;
  user:         User | null;
}

export default function Sidebar({ activeTab, onTabChange, user }: SidebarProps) {
  const router = useRouter();
  const supabase = createClient();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  const displayName = user
    ? (user.user_metadata?.full_name || user.email || 'Reader')
    : 'Guest';

  return (
    <div className="w-56 shrink-0 flex flex-col bg-[#1C2B35] text-white h-full">
      {/* Header */}
      <div className="px-5 pt-6 pb-5 border-b border-white/10">
        <div className="text-2xl font-bold tracking-tight">Immerse</div>
        <div className="text-xs text-white/50 mt-1 truncate">{displayName}</div>
      </div>

      {/* Nav items */}
      <nav className="flex-1 py-3">
        {NAV_ITEMS.map(({ tab, label, icon }) => (
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
            {label}
          </button>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-5 pb-6 pt-3 border-t border-white/10 flex items-center justify-between">
        <button
          onClick={user ? handleSignOut : () => router.push('/login')}
          className="text-xs text-white/40 hover:text-white/70 transition-colors"
        >
          {user ? 'Sign Out' : 'Sign In / Create Account'}
        </button>
        <button
          onClick={() => onTabChange('settings')}
          className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors"
        >
          <SettingsIcon size={14} color="currentColor" />
          Settings
        </button>
      </div>
    </div>
  );
}
