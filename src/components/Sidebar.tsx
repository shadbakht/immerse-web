'use client';

import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import type { NavTab } from './AppShell';

const NAV_ITEMS: { tab: NavTab; label: string; icon: string; mirror?: boolean }[] = [
  { tab: 'home',      label: 'Home',       icon: '🏠' },
  { tab: 'library',   label: 'Library',    icon: '📚' },
  { tab: 'tags',      label: 'Tags',        icon: '🏷️', mirror: true },
  { tab: 'notes',     label: 'Notes',       icon: '📝' },
  { tab: 'xrefs',     label: 'X-Refs',      icon: '🔗' },
  { tab: 'community', label: 'Community',   icon: '🌐' },
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
        {NAV_ITEMS.map(({ tab, label, icon, mirror }) => (
          <button
            key={tab}
            onClick={() => onTabChange(tab)}
            className={`w-full flex items-center gap-3 px-5 py-3.5 text-sm transition-colors text-left ${
              activeTab === tab
                ? 'bg-white/10 text-white font-medium'
                : 'text-white/70 hover:bg-white/5 hover:text-white'
            }`}
          >
            <span className={`text-base inline-block${mirror ? ' scale-x-[-1]' : ''}`}>{icon}</span>
            {label}
          </button>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-5 pb-6 pt-3 border-t border-white/10 flex items-center justify-between">
        {user ? (
          <>
            <button
              onClick={() => onTabChange('settings')}
              className="text-xs text-white/40 hover:text-white/70 transition-colors"
            >
              Settings
            </button>
            <button
              onClick={handleSignOut}
              className="text-xs text-white/40 hover:text-white/70 transition-colors"
            >
              Sign Out
            </button>
          </>
        ) : (
          <button
            onClick={() => router.push('/login')}
            className="w-full bg-[#1B6B7B] hover:bg-[#155a68] transition-colors text-white font-semibold text-sm py-2.5 rounded-xl"
          >
            Sign In or Create Account
          </button>
        )}
      </div>
    </div>
  );
}
