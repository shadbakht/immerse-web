'use client';

import type { ReaderTarget } from './AppShell';

interface ReaderPanelProps {
  target: ReaderTarget;
  userId: string;
}

export default function ReaderPanel({ target }: ReaderPanelProps) {
  if (!target) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400">
        <div className="text-center">
          <div className="text-4xl mb-3 opacity-30">✦</div>
          <p className="text-sm">Select a book to begin reading</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex items-center justify-center text-gray-400">
      <p className="text-sm">Loading <span className="font-mono text-xs">{target.bookId}</span>…</p>
    </div>
  );
}
