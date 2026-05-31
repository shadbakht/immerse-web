'use client';

import { useState } from 'react';
import type { User } from '@supabase/supabase-js';
import Sidebar from './Sidebar';
import LibraryPanel from './LibraryPanel';
import ReaderPanel from './ReaderPanel';
import HomePanel from './HomePanel';
import SettingsPanel from './SettingsPanel';

export type NavTab = 'home' | 'library' | 'tags' | 'notes' | 'xrefs' | 'community' | 'settings';

export type ReaderTarget = { bookId: string; passageId?: string } | null;

interface AppShellProps {
  user: User;
  initialBookId?: string;
}

export default function AppShell({ user, initialBookId }: AppShellProps) {
  const [activeTab, setActiveTab] = useState<NavTab>(initialBookId ? 'library' : 'home');
  const [readerTarget, setReaderTarget] = useState<ReaderTarget>(
    initialBookId ? { bookId: initialBookId } : null,
  );

  const fullWidthTabs: NavTab[] = ['home', 'settings'];
  const isFullWidth = fullWidthTabs.includes(activeTab);

  function openBook(bookId: string, passageId?: string) {
    setReaderTarget({ bookId, passageId });
    setActiveTab('library');
    history.replaceState(null, '', `/read/${bookId}`);
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#F8F7F4]">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} user={user} />

      {isFullWidth ? (
        <div className="flex-1 overflow-hidden">
          {activeTab === 'home'     && <HomePanel userId={user.id} onOpenBook={openBook} />}
          {activeTab === 'settings' && <SettingsPanel user={user} />}
        </div>
      ) : (
        <>
          <div className="w-80 shrink-0 border-r border-gray-200 flex flex-col overflow-hidden bg-white">
            <LibraryPanel activeTab={activeTab} userId={user.id} onOpenBook={openBook} />
          </div>
          <div className="flex-1 overflow-hidden">
            <ReaderPanel target={readerTarget} userId={user.id} />
          </div>
        </>
      )}
    </div>
  );
}
