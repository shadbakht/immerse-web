'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { useTranslation } from '@/contexts/LanguageProvider';

// Reached only from /auth/callback, which already checked
// profiles.username_confirmed === false — a Google/Apple sign-in whose
// username was auto-derived, never chosen. No skip: this page doesn't
// redirect on its own until one of the two paths below actually succeeds.
//
// The second path, "Already have an Immerse account?", is deliberately NOT a
// data merge (reassigning tags/notes/etc. between two already-populated
// accounts is a much bigger, riskier operation) — it only works because the
// fresh account reaching this page is still empty. It switches the session to
// the existing account (proven via a mailed code) and attaches this OAuth
// identity to THAT account instead; the fresh one is simply abandoned.
function ChooseUsernameInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') ?? '/';
  const supabase = createClient();
  const { t } = useTranslation();

  const [mode, setMode] = useState<'username' | 'linkEmail' | 'linkCode'>('username');
  const [userId, setUserId] = useState<string | null>(null);
  const [provider, setProvider] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [status, setStatus] = useState<null | 'checking' | 'available' | 'taken' | 'invalid'>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [linkEmail, setLinkEmail] = useState('');
  const [linkCode, setLinkCode] = useState('');
  const [linkCooldown, setLinkCooldown] = useState(0);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/login'); return; }
      setUserId(data.user.id);
      setProvider((data.user.app_metadata?.provider as string) ?? null);
      supabase.from('profiles').select('username').eq('id', data.user.id).maybeSingle().then(({ data: p }) => {
        if (p?.username) setUsername(p.username);
      });
    });
  }, []);

  useEffect(() => {
    if (mode !== 'username') return;
    const raw = username.toLowerCase().trim();
    if (!raw) { setStatus(null); return; }
    if (!/^[a-z0-9_]{3,20}$/.test(raw)) { setStatus('invalid'); return; }
    setStatus('checking');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      let query = supabase.from('profiles').select('id').eq('username', raw);
      if (userId) query = query.neq('id', userId);
      const { data } = await query.maybeSingle();
      setStatus(data ? 'taken' : 'available');
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [username, userId, mode]);

  useEffect(() => {
    if (linkCooldown <= 0) return;
    const id = setTimeout(() => setLinkCooldown(s => s - 1), 1000);
    return () => clearTimeout(id);
  }, [linkCooldown]);

  async function handleSubmitUsername() {
    setError('');
    const raw = username.toLowerCase().trim();
    if (!raw || status === 'invalid') { setError(t('auth.invalidUsernameBody')); return; }
    if (status === 'taken')           { setError(t('auth.usernameAlreadyTaken')); return; }
    if (status !== 'available')       { setError(t('auth.checkUsernameBody')); return; }
    if (!userId) return;

    setLoading(true);
    try {
      const { error } = await supabase.from('profiles').update({ username: raw, username_confirmed: true }).eq('id', userId);
      if (error) throw error;
      router.push(next);
      router.refresh();
    } catch (err: any) {
      setError(err.message ?? t('common.somethingWrong'));
    } finally {
      setLoading(false);
    }
  }

  // shouldCreateUser: false is the safety rail — this must only ever
  // authenticate an EXISTING account, never silently create one from a
  // typo'd email, since the next step re-points the whole session at
  // whatever it resolves to.
  async function sendLinkCode() {
    setError('');
    const trimmed = linkEmail.trim();
    if (!trimmed) { setError(t('auth.enterEmailBody')); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({ email: trimmed, options: { shouldCreateUser: false } });
      if (error) throw error;
      setMode('linkCode');
      setLinkCooldown(60);
    } catch (err: any) {
      setError(err.message ?? t('common.somethingWrong'));
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyLinkCode() {
    setError('');
    const clean = linkCode.replace(/\D/g, '');
    if (clean.length < 6) { setError(t('auth.codeIncorrect')); return; }
    // Captured before verifyOtp's session switch, which would otherwise
    // silently change what app_metadata.provider resolves to.
    const targetProvider = provider ?? 'google';
    setLoading(true);
    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({ email: linkEmail.trim(), token: clean, type: 'email' });
      if (verifyError) throw verifyError;
      // linkIdentity's own authorize call already carries the now-current
      // session's JWT, so the server knows which account to attach the
      // identity to before the browser even navigates away — the redirect
      // back through /auth/callback (which re-checks username_confirmed,
      // already true on the existing account) is what lands them in the app.
      const { error: linkError } = await supabase.auth.linkIdentity({
        provider: targetProvider as any,
        options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
      });
      if (linkError) throw linkError;
    } catch (err: any) {
      setError(classifyCodeError(err));
      setLoading(false);
    }
    // On success the browser navigates away — no further state update needed.
  }

  function classifyCodeError(e: any) {
    return /rate|too many|429/i.test(e?.message ?? '') ? t('auth.tooManyAttempts') : t('auth.codeIncorrect');
  }

  async function handleResendLinkCode() {
    if (linkCooldown > 0) return;
    setError('');
    const { error } = await supabase.auth.signInWithOtp({ email: linkEmail.trim(), options: { shouldCreateUser: false } });
    if (error) { setError(classifyCodeError(error)); return; }
    setLinkCooldown(60);
  }

  return (
    <div className="min-h-screen bg-[#0F1923] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="flex justify-center mb-4">
            <Image src="/immerse-icon.png" alt="Immerse" width={72} height={72} className="rounded-2xl" />
          </div>
          {mode === 'username' && (
            <>
              <h1 className="text-2xl font-bold text-white tracking-tight">{t('auth.chooseUsernameTitle')}</h1>
              <p className="text-sm text-gray-400 dark:text-[#5C7A8E] mt-2">{t('auth.chooseUsernameBlurb')}</p>
            </>
          )}
          {mode === 'linkEmail' && (
            <>
              <h1 className="text-2xl font-bold text-white tracking-tight">{t('auth.alreadyHaveAccount')}</h1>
              <p className="text-sm text-gray-400 dark:text-[#5C7A8E] mt-2">{t('auth.linkAccountBlurb')}</p>
            </>
          )}
          {mode === 'linkCode' && (
            <>
              <p className="text-white font-semibold text-lg">{t('auth.enterCode')}</p>
              <p className="text-gray-400 dark:text-[#5C7A8E] text-sm mt-2">{t('auth.enterCodeBody', { email: linkEmail.trim() })}</p>
            </>
          )}
        </div>

        {mode === 'username' && (
          <div className="space-y-3">
            <div className="relative">
              <input
                type="text"
                placeholder={t('auth.usernamePlaceholder')}
                value={username}
                onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                onKeyDown={e => { if (e.key === 'Enter') handleSubmitUsername(); }}
                autoCapitalize="none"
                autoCorrect="off"
                autoFocus
                className={`w-full bg-white/10 text-white placeholder-gray-500 rounded-xl px-4 py-3.5 outline-none focus:ring-2 focus:ring-[#1B6B7B] dark:focus:ring-[#2D9DB3] ${
                  status === 'taken'     ? 'ring-2 ring-red-500'   :
                  status === 'available' ? 'ring-2 ring-green-500' : ''
                }`}
              />
              {status && (
                <span className={`absolute end-4 top-1/2 -translate-y-1/2 text-xs font-medium ${
                  status === 'available' ? 'text-green-400' :
                  status === 'taken'     ? 'text-red-400'   :
                  status === 'invalid'   ? 'text-red-400'   : 'text-gray-400 dark:text-[#5C7A8E]'
                }`}>
                  {status === 'checking'  ? '…'                          :
                   status === 'available' ? t('auth.usernameAvailable')  :
                   status === 'taken'     ? t('auth.usernameTakenShort') : t('auth.usernameHint')}
                </span>
              )}
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <button
              onClick={handleSubmitUsername}
              disabled={loading}
              className="w-full bg-[#1B6B7B] dark:bg-[#2D9DB3] text-white font-semibold py-3.5 rounded-xl hover:bg-[#155a68] dark:hover:bg-[#2589A0] transition disabled:opacity-50"
            >
              {loading ? t('common.pleaseWait') : t('common.continue')}
            </button>

            <button
              onClick={() => { setMode('linkEmail'); setError(''); }}
              className="w-full text-center text-[#1B6B7B] dark:text-[#2D9DB3] text-sm py-1 hover:underline"
            >
              {t('auth.alreadyHaveAccount')}
            </button>
          </div>
        )}

        {mode === 'linkEmail' && (
          <div className="space-y-3">
            <input
              type="email"
              placeholder={t('auth.emailAddressPlaceholder')}
              value={linkEmail}
              onChange={e => setLinkEmail(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') sendLinkCode(); }}
              autoFocus
              className="w-full bg-white/10 text-white placeholder-gray-500 rounded-xl px-4 py-3.5 outline-none focus:ring-2 focus:ring-[#1B6B7B] dark:focus:ring-[#2D9DB3]"
            />
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button
              onClick={sendLinkCode}
              disabled={loading}
              className="w-full bg-[#1B6B7B] dark:bg-[#2D9DB3] text-white font-semibold py-3.5 rounded-xl hover:bg-[#155a68] dark:hover:bg-[#2589A0] transition disabled:opacity-50"
            >
              {loading ? t('common.pleaseWait') : t('common.continue')}
            </button>
            <button
              onClick={() => { setMode('username'); setError(''); }}
              className="w-full text-center text-gray-400 dark:text-[#5C7A8E] text-sm py-2 hover:text-white transition"
            >
              {t('common.back')}
            </button>
          </div>
        )}

        {mode === 'linkCode' && (
          <div className="space-y-3">
            <input
              inputMode="numeric"
              maxLength={6}
              placeholder={t('auth.codePlaceholder')}
              value={linkCode}
              onChange={e => setLinkCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              onKeyDown={e => { if (e.key === 'Enter') handleVerifyLinkCode(); }}
              autoFocus
              className="w-full bg-white/10 text-white text-center text-2xl tracking-[0.5em] placeholder-gray-500 rounded-xl px-4 py-3.5 outline-none focus:ring-2 focus:ring-[#1B6B7B] dark:focus:ring-[#2D9DB3]"
            />
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button
              onClick={handleVerifyLinkCode}
              disabled={loading}
              className="w-full bg-[#1B6B7B] dark:bg-[#2D9DB3] text-white font-semibold py-3.5 rounded-xl hover:bg-[#155a68] dark:hover:bg-[#2589A0] transition disabled:opacity-50"
            >
              {loading ? t('auth.verifying') : t('auth.verify')}
            </button>
            <button
              onClick={handleResendLinkCode}
              disabled={linkCooldown > 0}
              className="w-full text-center text-[#1B6B7B] dark:text-[#2D9DB3] text-sm py-1 hover:underline disabled:opacity-50 disabled:no-underline"
            >
              {linkCooldown > 0 ? t('auth.resendCodeIn', { seconds: linkCooldown }) : t('auth.resendCode')}
            </button>
            <button
              onClick={() => { setMode('linkEmail'); setLinkCode(''); setError(''); }}
              className="w-full text-center text-gray-400 dark:text-[#5C7A8E] text-sm py-2 hover:text-white transition"
            >
              {t('auth.wrongEmailBack')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ChooseUsernamePage() {
  return (
    <Suspense>
      <ChooseUsernameInner />
    </Suspense>
  );
}
