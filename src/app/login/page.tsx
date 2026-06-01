'use client';

import { useState, useRef, useEffect, Suspense } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect') ?? '/';
  const supabase = createClient();

  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [usernameStatus, setUsernameStatus] = useState<null | 'checking' | 'available' | 'taken' | 'invalid'>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isSignUp) return;
    const raw = username.toLowerCase().trim();
    if (!raw) { setUsernameStatus(null); return; }
    if (!/^[a-z0-9_]{3,20}$/.test(raw)) { setUsernameStatus('invalid'); return; }
    setUsernameStatus('checking');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const { data } = await supabase.from('profiles').select('id').eq('username', raw).maybeSingle();
      setUsernameStatus(data ? 'taken' : 'available');
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [username, isSignUp]);

  function switchMode() {
    setIsSignUp(v => !v);
    setError('');
    setSuccess('');
    setUsername('');
    setUsernameStatus(null);
  }

  async function handleSubmit() {
    setError('');
    if (!email || !password) { setError('Please enter email and password.'); return; }

    if (isSignUp) {
      const raw = username.toLowerCase().trim();
      if (!raw || !/^[a-z0-9_]{3,20}$/.test(raw)) {
        setError('Username must be 3–20 characters: letters, numbers, underscores only.');
        return;
      }
      if (usernameStatus === 'taken')     { setError('Username is already taken.'); return; }
      if (usernameStatus !== 'available') { setError('Please wait for username validation.'); return; }
    }

    setLoading(true);
    try {
      if (!isSignUp) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push(redirectTo);
        router.refresh();
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName || email, username: username.toLowerCase().trim() } },
        });
        if (error) throw error;
        setSuccess(`Check your email — we sent a confirmation link to ${email}`);
      }
    } catch (err: any) {
      setError(err.message ?? 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0F1923] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="flex justify-center mb-4">
            <Image src="/immerse-icon.png" alt="Immerse" width={72} height={72} className="rounded-2xl" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Immerse</h1>
          <p className="text-sm text-gray-400 mt-2">Sacred texts from all traditions</p>
        </div>

        {success ? (
          <div className="text-center space-y-4">
            <div className="text-4xl">📬</div>
            <p className="text-white font-semibold text-lg">Check your email</p>
            <p className="text-gray-400 text-sm leading-relaxed">{success}</p>
            <button onClick={() => { setSuccess(''); setIsSignUp(false); }} className="text-[#1B6B7B] text-sm hover:underline">
              Back to Sign In
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Sign-up only fields */}
            {isSignUp && (
              <>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Username"
                    value={username}
                    onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    autoCapitalize="none"
                    autoCorrect="off"
                    className={`w-full bg-white/10 text-white placeholder-gray-500 rounded-xl px-4 py-3.5 outline-none focus:ring-2 focus:ring-[#1B6B7B] ${
                      usernameStatus === 'taken'     ? 'ring-2 ring-red-500'   :
                      usernameStatus === 'available' ? 'ring-2 ring-green-500' : ''
                    }`}
                  />
                  {usernameStatus && (
                    <span className={`absolute right-4 top-1/2 -translate-y-1/2 text-xs font-medium ${
                      usernameStatus === 'available' ? 'text-green-400' :
                      usernameStatus === 'taken'     ? 'text-red-400'   :
                      usernameStatus === 'invalid'   ? 'text-red-400'   : 'text-gray-400'
                    }`}>
                      {usernameStatus === 'checking'  ? '…'            :
                       usernameStatus === 'available' ? '✓ Available'  :
                       usernameStatus === 'taken'     ? '✗ Taken'      : '3–20 chars'}
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  placeholder="Full Name"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  className="w-full bg-white/10 text-white placeholder-gray-500 rounded-xl px-4 py-3.5 outline-none focus:ring-2 focus:ring-[#1B6B7B]"
                />
              </>
            )}

            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full bg-white/10 text-white placeholder-gray-500 rounded-xl px-4 py-3.5 outline-none focus:ring-2 focus:ring-[#1B6B7B]"
            />
            <input
              type="password"
              placeholder={isSignUp ? 'Create Password' : 'Password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
              className="w-full bg-white/10 text-white placeholder-gray-500 rounded-xl px-4 py-3.5 outline-none focus:ring-2 focus:ring-[#1B6B7B]"
            />

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full bg-[#1B6B7B] text-white font-semibold py-3.5 rounded-xl hover:bg-[#155a68] transition disabled:opacity-50"
            >
              {loading ? 'Please wait…' : isSignUp ? 'Create Account' : 'Sign In'}
            </button>

            <div className="flex items-center gap-3 my-1">
              <div className="flex-1 h-px bg-white/10" />
            </div>

            <button
              onClick={switchMode}
              className="w-full border border-[#1B6B7B] text-[#1B6B7B] font-semibold py-3.5 rounded-xl hover:bg-[#1B6B7B]/10 transition"
            >
              {isSignUp ? 'Sign In' : 'Sign Up'}
            </button>

            <div className="flex items-center gap-3 my-1">
              <div className="flex-1 h-px bg-white/10" />
              <span className="text-xs text-gray-600">or</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>

            <a
              href="/?guest=1"
              className="block w-full text-center border border-white/15 text-white/70 font-medium py-3.5 rounded-xl hover:bg-white/5 hover:text-white transition"
            >
              Continue as Guest
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginPageInner />
    </Suspense>
  );
}
