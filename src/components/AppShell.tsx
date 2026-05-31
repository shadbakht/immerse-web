'use client';

import { useState } from 'react';
import type { User } from '@supabase/supabase-js';
import Sidebar from './Sidebar';
import LibraryPanel from './LibraryPanel';
import ReaderPanel from './ReaderPanel';
import HomePanel from './HomePanel';
import SettingsPanel from './SettingsPanel';

export type NavTab = 'home' | 'library' | 'tags' | 'notes' | 'xrefs' | 'community' | 'settings';

function ComingSoon({ label }: { label: string }) {
  return (
    <div className="h-full flex items-center justify-center text-gray-400 text-sm">
      {label} — coming soon
    </div>
  );
}

export type ReaderTarget = { bookId: string; passageId?: string; highlightQuery?: string } | null;

interface AppShellProps {
  user:          User | null;
  initialBookId?: string;
}

export default function AppShell({ user, initialBookId }: AppShellProps) {
  const [activeTab, setActiveTab] = useState<NavTab>(initialBookId ? 'library' : 'home');
  const [readerTarget, setReaderTarget] = useState<ReaderTarget>(
    initialBookId ? { bookId: initialBookId } : null,
  );

  // Library is the only split-panel tab; everything else is full-width
  const isFullWidth = activeTab !== 'library';
  const userId = user?.id ?? '';

  function openBook(bookId: string, passageId?: string, highlightQuery?: string) {
    setReaderTarget({ bookId, passageId, highlightQuery });
    setActiveTab('library');
    history.replaceState(null, '', `/read/${bookId}`);
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#F8F7F4]">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} user={user} />

      {isFullWidth ? (
        <div className="flex-1 overflow-hidden">
          {activeTab === 'home'      && <HomePanel userId={userId} onOpenBook={openBook} />}
          {activeTab === 'settings'  && user  && <SettingsPanel user={user} />}
          {activeTab === 'settings'  && !user && <ComingSoon label="Sign in to access settings" />}
          {activeTab === 'tags'      && <ComingSoon label="Tags" />}
          {activeTab === 'notes'     && <ComingSoon label="Notes" />}
          {activeTab === 'xrefs'     && <ComingSoon label="Cross-References" />}
          {activeTab === 'community' && <ComingSoon label="Community" />}
        </div>
      ) : (
        <>
          <div className="w-[368px] shrink-0 border-r border-gray-200 flex flex-col overflow-hidden bg-white">
            <LibraryPanel activeTab={activeTab} userId={userId} onOpenBook={openBook} />
          </div>
          <div className="flex-1 overflow-hidden">
            <ReaderPanel target={readerTarget} userId={userId} />
          </div>
        </>
      )}
    </div>
  );
}
