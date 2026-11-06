'use client';

import { useState } from 'react';

/**
 * Hands the /get link on: the native share sheet where there is one (phones),
 * otherwise copies it. Shares the bare /get URL — no ?lang — so each person
 * who opens it gets their own language.
 */
export default function CopyLinkButton({ url, label, copiedLabel, shareText }: { url: string; label: string; copiedLabel: string; shareText: string }) {
  const [copied, setCopied] = useState(false);

  async function onClick() {
    if (typeof navigator.share === 'function' && /android|iphone|ipad|ipod/i.test(navigator.userAgent)) {
      try { await navigator.share({ title: 'Immerse Research', text: shareText, url }); return; }
      catch (e) { if ((e as Error).name === 'AbortError') return; }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard blocked — nothing useful to show */ }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="text-sm text-gray-600 dark:text-[#8FA4B8] bg-white dark:bg-[#1B2A38] border border-gray-200 dark:border-[#2D4050] rounded-full px-4 py-2 hover:border-gray-300 dark:hover:border-[#3D5468] transition-colors"
    >
      {copied ? `✓ ${copiedLabel}` : `🔗 ${label}`}
    </button>
  );
}
