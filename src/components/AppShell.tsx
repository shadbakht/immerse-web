'use client';

import { useState, useEffect } from 'react';
import { syncSubscribedTags, syncFollowedUsers } from '@/lib/communitySync';
import type { User } from '@supabase/supabase-js';
import Sidebar from './Sidebar';
import LibraryPanel from './LibraryPanel';
import ReaderPanel from './ReaderPanel';
import HomePanel from './HomePanel';
import SettingsPanel from './SettingsPanel';
import NotesScreen from './NotesScreen';
import SignInPrompt from './SignInPrompt';
import CommunityPanel from './CommunityPanel';
import TagsScreen from './TagsScreen';
import XRefsScreen from './XRefsScreen';

export type NavTab = 'home' | 'library' | 'tags' | 'notes' | 'xrefs' | 'community' | 'settings';

function ComingSoon({ label }: { label: string }) {
  return (
    <div className="h-full flex items-center justify-center text-gray-400 text-sm">
      {label} — coming soon
    </div>
  );
}

export type ReaderTarget = { bookId: string; passageId?: string; highlightQuery?: string } | null;

export interface XRefPickFrom {
  text: string;
  startPassageId: string;
  bookId: string;
  passageId: string;
  startOffset: number;
  endOffset: number;
}

interface AppShellProps {
  user:          User | null;
  initialBookId?: string;
}

export default function AppShell({ user, initialBookId }: AppShellProps) {
  const [activeTab, setActiveTab] = useState<NavTab>(initialBookId ? 'library' : 'home');
  const [readerTarget, setReaderTarget] = useState<ReaderTarget>(
    initialBookId ? { bookId: initialBookId } : null,
  );
  const [libraryCollapsed, setLibraryCollapsed] = useState(false);
  const [xrefPickFrom, setXrefPickFrom] = useState<XRefPickFrom | null>(null);

  // Library is the only split-panel tab; everything else is full-width
  const isFullWidth = activeTab !== 'library';
  const userId = user?.id ?? '';

  // Silently sync subscribed and followed community tags on every page load
  useEffect(() => {
    if (!userId) return;
    syncSubscribedTags(userId).catch(e => console.warn('[AppShell] syncSubscribed error:', e));
    syncFollowedUsers(userId).catch(e => console.warn('[AppShell] syncFollowed error:', e));
  }, [userId]);

  function openBook(bookId: string, passageId?: string, highlightQuery?: string, collapseLibrary = false) {
    setReaderTarget({ bookId, passageId, highlightQuery });
    setActiveTab('library');
    setLibraryCollapsed(collapseLibrary);
    history.replaceState(null, '', `/read/${bookId}`);
  }

  function openBookFromHome(bookId: string, passageId?: string, highlightQuery?: string) {
    openBook(bookId, passageId, highlightQuery, true);
  }

  function handleStartXrefPick(from: XRefPickFrom) {
    setXrefPickFrom(from);
    setLibraryCollapsed(false);
    setActiveTab('library');
  }

  function handleXrefPickDone() {
    const from = xrefPickFrom;
    setXrefPickFrom(null);
    if (from) {
      setReaderTarget({ bookId: from.bookId, passageId: from.passageId });
      setActiveTab('library');
      history.replaceState(null, '', `/read/${from.bookId}`);
    }
  }

  function handleTabChange(tab: NavTab) {
    // Expanding the library panel when user explicitly clicks the Library tab
    if (tab === 'library') setLibraryCollapsed(false);
    setActiveTab(tab as NavTab);
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#F8F7F4]">
      <Sidebar activeTab={activeTab} onTabChange={handleTabChange} user={user} />

      {isFullWidth ? (
        <div className="flex-1 overflow-hidden">
          {activeTab === 'home'      && <HomePanel userId={userId} onOpenBook={openBookFromHome} onTabChange={tab => setActiveTab(tab as NavTab)} />}
          {activeTab === 'settings'  && <SettingsPanel user={user} />}
          {activeTab === 'tags'      && user  && <TagsScreen userId={userId} onOpenBook={openBook} />}
          {activeTab === 'tags'      && !user && <SignInPrompt message="Create and organize quote compilations from across the library." />}
          {activeTab === 'notes'     && user  && <NotesScreen userId={userId} onOpenBook={openBook} />}
          {activeTab === 'notes'     && !user && <SignInPrompt message="Attach personal notes to any passage you've highlighted." />}
          {activeTab === 'xrefs'     && user  && <XRefsScreen userId={userId} onOpenBook={openBook} />}
          {activeTab === 'xrefs'     && !user && <SignInPrompt message="Link passages across different books and traditions." />}
          {activeTab === 'community' && <CommunityPanel user={user} />}
        </div>
      ) : (
        <>
          {libraryCollapsed ? (
            <div className="w-10 shrink-0 border-r border-gray-200 flex flex-col items-center bg-white">
              <button
                onClick={() => setLibraryCollapsed(false)}
                className="mt-4 w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors text-lg font-medium"
                title="Expand Library"
              >
                ›
              </button>
            </div>
          ) : (
            <div className="w-[368px] shrink-0 border-r border-gray-200 flex flex-col overflow-hidden bg-white">
              <LibraryPanel activeTab={activeTab} userId={userId} onOpenBook={openBook} onCollapse={() => setLibraryCollapsed(true)} />
            </div>
          )}
          <div className="flex-1 overflow-hidden">
            <ReaderPanel
              target={readerTarget}
              userId={userId}
              onOpenBook={openBook}
              xrefPickFrom={xrefPickFrom}
              onStartXrefPick={handleStartXrefPick}
              onXrefPickDone={handleXrefPickDone}
            />
          </div>
        </>
      )}
    </div>
  );
}
