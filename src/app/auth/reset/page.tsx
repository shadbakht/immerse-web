'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useTranslation } from '@/contexts/LanguageProvider';

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();
  const { t } = useTranslation();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setError('');
    if (!password || !confirm) { setError(t('auth.enterConfirmPassword')); return; }
    if (password.length < 8)   { setError(t('auth.passwordTooShort')); return; }
    if (password !== confirm)  { setError(t('auth.passwordsDontMatch')); return; }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setDone(true);
    } catch (err: any) {
      setError(err.message ?? t('auth.resetFailed'));
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
          <h1 className="text-3xl font-bold text-white tracking-tight">{t('auth.resetPassword')}</h1>
          <p className="text-sm text-gray-400 dark:text-[#5C7A8E] mt-2">{t('auth.chooseNewPassword')}</p>
        </div>

        {done ? (
          <div className="text-center space-y-4">
            <div className="text-4xl">✅</div>
            <p className="text-white font-semibold text-lg">{t('auth.passwordUpdated')}</p>
            <p className="text-gray-400 dark:text-[#5C7A8E] text-sm leading-relaxed">{t('auth.passwordUpdatedBody')}</p>
            <button
              onClick={() => { router.push('/'); router.refresh(); }}
              className="block w-full bg-[#1B6B7B] dark:bg-[#2D9DB3] text-white font-semibold py-3.5 rounded-xl hover:bg-[#155a68] dark:hover:bg-[#2589A0] transition"
            >
              {t('auth.continueToImmerse')}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <input
              type="password"
              placeholder={t('auth.newPasswordPlaceholder')}
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoFocus
              className="w-full bg-white/10 text-white placeholder-gray-500 rounded-xl px-4 py-3.5 outline-none focus:ring-2 focus:ring-[#1B6B7B] dark:focus:ring-[#2D9DB3]"
            />
            <input
              type="password"
              placeholder={t('auth.confirmNewPasswordPlaceholder')}
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
              {loading ? t('common.pleaseWait') : t('auth.updatePassword')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
