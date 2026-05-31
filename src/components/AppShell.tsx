'use client';

import { useState } from 'react';
import type { User } from '@supabase/supabase-js';
import Sidebar from './Sidebar';
import LibraryPanel from './LibraryPanel';
import ReaderPanel from './ReaderPanel';

export type NavTab = 'library' | 'tags' | 'notes' | 'xrefs' | 'community';

export type ReaderTarget = { bookId: string; passageId?: string } | null;

export default function AppShell({ user }: { user: User }) {
  const [activeTab, setActiveTab] = useState<NavTab>('library');
  const [readerTarget, setReaderTarget] = useState<ReaderTarget>(null);

  return (
    <div className="flex h-screen overflow-hidden bg-[#F8F7F4]">
      {/* Sidebar — always visible on md+, hidden on mobile */}
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        user={user}
      />

      {/* Left panel — library / tags / notes / xrefs / community */}
      <div className="w-80 shrink-0 border-r border-gray-200 flex flex-col overflow-hidden bg-white">
        <LibraryPanel
          activeTab={activeTab}
          userId={user.id}
          onOpenBook={(bookId, passageId) => setReaderTarget({ bookId, passageId })}
        />
      </div>

      {/* Right panel — reader */}
      <div className="flex-1 overflow-hidden">
        <ReaderPanel target={readerTarget} userId={user.id} />
      </div>
    </div>
  );
}
