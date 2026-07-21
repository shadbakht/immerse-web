'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { syncSubscribedTags, syncFollowedUsers } from '@/lib/communitySync';
import { initFontSize } from '@/lib/fontSize';
import { initColorMode } from '@/lib/colorMode';
import { loadSlugMaps } from '@/lib/catalog';
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
import { useTranslation } from '@/contexts/LanguageProvider';

export type NavTab = 'home' | 'library' | 'tags' | 'notes' | 'xrefs' | 'community' | 'settings';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Resolve a corpus slug to its Supabase uuid so everything downstream (the
// reader query, reading_progress writes, prayer-style checks) only ever sees a
// uuid. Returns uuids / imported:* ids untouched.
async function resolveBookId(bookId: string): Promise<string> {
  if (UUID_RE.test(bookId) || bookId.startsWith('imported:')) return bookId;
  try {
    const { slugToUuid } = await loadSlugMaps(createClient());
    return slugToUuid.get(bookId) ?? bookId;
  } catch { return bookId; }
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
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<NavTab>(initialBookId ? 'library' : 'home');
  const [readerTarget, setReaderTarget] = useState<ReaderTarget>(
    initialBookId ? { bookId: initialBookId } : null,
  );
  const [libraryCollapsed, setLibraryCollapsed] = useState(false);
  const [xrefPickFrom, setXrefPickFrom] = useState<XRefPickFrom | null>(null);

  // Library is the only split-panel tab; everything else is full-width
  const isFullWidth = activeTab !== 'library';
  const userId = user?.id ?? '';

  // Apply the reading/quote font size app-wide (local value first, then profile).
  useEffect(() => {
    initFontSize(createClient(), userId || null);
  }, [userId]);

  // Apply the saved light/dark/system color mode on load.
  useEffect(() => { initColorMode(); }, []);

  // If the page was opened at /read/<slug> (slug, not uuid), resolve it to a
  // uuid so the reader and reading_progress writes don't choke on the slug.
  useEffect(() => {
    if (!initialBookId || UUID_RE.test(initialBookId) || initialBookId.startsWith('imported:')) return;
    resolveBookId(initialBookId).then(id => {
      if (id !== initialBookId) {
        setReaderTarget(t => (t && t.bookId === initialBookId ? { ...t, bookId: id } : t));
        history.replaceState(null, '', `/read/${id}`);
      }
    });
  }, [initialBookId]);

  // Silently sync subscribed and followed community tags on every page load
  useEffect(() => {
    if (!userId) return;
    syncSubscribedTags(userId).catch(e => console.warn('[AppShell] syncSubscribed error:', e));
    syncFollowedUsers(userId).catch(e => console.warn('[AppShell] syncFollowed error:', e));
  }, [userId]);

  function openBook(bookId: string, passageId?: string, highlightQuery?: string, collapseLibrary = false) {
    // Switch to the reader IMMEDIATELY — never block the tab change on slug
    // resolution. The reader (loadBook) resolves a slug→uuid itself for
    // rendering; we also resolve in the background so reading_progress writes
    // use the uuid.
    setActiveTab('library');
    setLibraryCollapsed(collapseLibrary);
    setReaderTarget({ bookId, passageId, highlightQuery });
    history.replaceState(null, '', `/read/${bookId}`);
    if (!UUID_RE.test(bookId) && !bookId.startsWith('imported:')) {
      resolveBookId(bookId).then(id => {
        if (id !== bookId) {
          setReaderTarget(t => (t && t.bookId === bookId ? { ...t, bookId: id } : t));
          history.replaceState(null, '', `/read/${id}`);
        }
      });
    }
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
    <div className="flex h-screen overflow-hidden bg-[#F8F7F4] dark:bg-[#0F1923]">
      <Sidebar activeTab={activeTab} onTabChange={handleTabChange} user={user} />

      {isFullWidth ? (
        <div className="flex-1 overflow-hidden">
          {activeTab === 'home'      && <HomePanel userId={userId} onOpenBook={openBookFromHome} onTabChange={tab => setActiveTab(tab as NavTab)} />}
          {activeTab === 'settings'  && <SettingsPanel user={user} />}
          {activeTab === 'tags'      && user  && <TagsScreen userId={userId} onOpenBook={openBook} />}
          {activeTab === 'tags'      && !user && <SignInPrompt message={t('tags.signInBody')} />}
          {activeTab === 'notes'     && user  && <NotesScreen userId={userId} onOpenBook={openBook} />}
          {activeTab === 'notes'     && !user && <SignInPrompt message={t('notes.signInBody')} />}
          {activeTab === 'xrefs'     && user  && <XRefsScreen userId={userId} onOpenBook={openBook} />}
          {activeTab === 'xrefs'     && !user && <SignInPrompt message={t('xrefs.signInBody')} />}
          {activeTab === 'community' && <CommunityPanel user={user} onOpenBook={openBook} />}
        </div>
      ) : (
        <>
          {libraryCollapsed ? (
            <div className="w-10 shrink-0 border-r border-gray-200 dark:border-[#2D4050] flex flex-col items-center bg-white dark:bg-[#1B2A38]">
              <button
                onClick={() => setLibraryCollapsed(false)}
                className="mt-4 w-8 h-8 flex items-center justify-center text-gray-400 dark:text-[#5C7A8E] hover:text-gray-700 dark:hover:text-[#B8C7D6] hover:bg-gray-100 dark:hover:bg-[#2D4050] rounded-lg transition-colors text-lg font-medium"
                title={t('common.expandLibrary')}
              >
                ›
              </button>
            </div>
          ) : (
            <div className="w-[424px] shrink-0 border-r border-gray-200 dark:border-[#2D4050] flex flex-col overflow-hidden bg-white dark:bg-[#1B2A38]">
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
