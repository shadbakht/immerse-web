'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

// Unlisted: not linked from anywhere in the app, not in the sitemap, and
// noindex (see layout.tsx beside this file). It deliberately shows no price —
// the amount appears only on Stripe's own payment page.
export default function LifetimePage() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => setSignedIn(!!data.user));
  }, []);

  async function buy() {
    setFailed(false);
    setBusy(true);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: 'lifetime' }),
      });
      const data = res.ok ? await res.json().catch(() => null) : null;
      if (data?.url) { window.location.href = data.url; return; }
      setFailed(true);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F8F7F4] dark:bg-[#0F1923] flex items-center justify-center px-6">
      <div className="max-w-sm w-full bg-white dark:bg-[#1B2A38] rounded-2xl border border-gray-100 dark:border-[#2D4050] shadow-sm p-8 text-center">
        <h1 className="text-xl font-bold text-gray-900 dark:text-[#E2EAF2] mb-2">Immerse Pro — Lifetime</h1>
        <p className="text-sm text-gray-500 dark:text-[#8FA4B8] leading-relaxed mb-6">
          One payment, Pro for good — no subscription to manage.
        </p>
        {signedIn === false ? (
          <Link
            href="/login?redirect=/lifetime"
            className="block w-full text-sm font-bold bg-[#1B6B7B] dark:bg-[#2D9DB3] text-white py-3 rounded-xl hover:bg-[#155a68] dark:hover:bg-[#2589A0] transition-colors"
          >
            Sign in to continue
          </Link>
        ) : (
          <button
            onClick={buy}
            disabled={busy || signedIn === null}
            className="w-full text-sm font-bold bg-[#1B6B7B] dark:bg-[#2D9DB3] text-white py-3 rounded-xl hover:bg-[#155a68] dark:hover:bg-[#2589A0] transition-colors disabled:opacity-50"
          >
            {busy ? 'Loading…' : 'Continue to payment'}
          </button>
        )}
        {failed && <p className="mt-3 text-xs text-red-500">Something went wrong. Please try again.</p>}
      </div>
    </div>
  );
}
