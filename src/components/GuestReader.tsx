'use client';

import { useRouter } from 'next/navigation';
import ReaderPanel from './ReaderPanel';

export default function GuestReader({ bookId }: { bookId: string }) {
  const router = useRouter();

  return (
    <div className="flex flex-col h-screen bg-[#F8F7F4]">
      {/* Guest banner */}
      <div className="bg-[#1C2B35] text-white px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-[#1B6B7B] text-lg">✦</span>
          <span className="font-semibold text-sm">Immerse</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-white/60">Sign in to save annotations</span>
          <button
            onClick={() => router.push(`/login?redirect=/read/${bookId}`)}
            className="bg-[#1B6B7B] text-white text-xs font-semibold px-4 py-1.5 rounded-lg hover:bg-[#155a68] transition-colors"
          >
            Sign In
          </button>
        </div>
      </div>

      {/* Reader */}
      <div className="flex-1 overflow-hidden">
        <ReaderPanel target={{ bookId }} userId="" />
      </div>
    </div>
  );
}
