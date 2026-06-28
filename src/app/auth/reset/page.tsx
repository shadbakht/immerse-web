'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setError('');
    if (!password || !confirm) { setError('Please enter and confirm your new password.'); return; }
    if (password.length < 8)   { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirm)  { setError('Passwords don’t match.'); return; }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setDone(true);
    } catch (err: any) {
      setError(err.message ?? 'Could not update your password. The reset link may have expired — please request a new one.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0F1923] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="flex justify-center mb-4">
            <Image src="/immerse-icon.png" alt="Immerse" width={72} height={72} className="rounded-2xl" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Reset Password</h1>
          <p className="text-sm text-gray-400 dark:text-[#5C7A8E] mt-2">Choose a new password for your account</p>
        </div>

        {done ? (
          <div className="text-center space-y-4">
            <div className="text-4xl">✅</div>
            <p className="text-white font-semibold text-lg">Password updated</p>
            <p className="text-gray-400 dark:text-[#5C7A8E] text-sm leading-relaxed">You can now use your new password.</p>
            <button
              onClick={() => { router.push('/'); router.refresh(); }}
              className="block w-full bg-[#1B6B7B] dark:bg-[#2D9DB3] text-white font-semibold py-3.5 rounded-xl hover:bg-[#155a68] dark:hover:bg-[#2589A0] transition"
            >
              Continue to Immerse
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <input
              type="password"
              placeholder="New password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoFocus
              className="w-full bg-white/10 text-white placeholder-gray-500 rounded-xl px-4 py-3.5 outline-none focus:ring-2 focus:ring-[#1B6B7B] dark:focus:ring-[#2D9DB3]"
            />
            <input
              type="password"
              placeholder="Confirm new password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
              className="w-full bg-white/10 text-white placeholder-gray-500 rounded-xl px-4 py-3.5 outline-none focus:ring-2 focus:ring-[#1B6B7B] dark:focus:ring-[#2D9DB3]"
            />

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full bg-[#1B6B7B] dark:bg-[#2D9DB3] text-white font-semibold py-3.5 rounded-xl hover:bg-[#155a68] dark:hover:bg-[#2589A0] transition disabled:opacity-50"
            >
              {loading ? 'Please wait…' : 'Update Password'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
