'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { isInTrial } from '@/lib/proStatus';
import { applyFontSize, type FontSize } from '@/lib/fontSize';
import { applyColorMode, getStoredColorMode, type ColorMode } from '@/lib/colorMode';
import { UI_LANGUAGES, type TranslationKey } from '@immerse/i18n';
import { useLanguage, useTranslation } from '@/contexts/LanguageProvider';
import Onboarding from './Onboarding';
import type { User } from '@supabase/supabase-js';
import pkg from '../../package.json';

// Single source of truth for the displayed version: package.json.
const APP_VERSION = pkg.version;

// Full feature walkthrough on YouTube (About → "Watch Full Feature Video").
// Same constant exists in the mobile repo: src/screens/SettingsScreen.js.
const FEATURE_VIDEO_URL = 'https://youtu.be/z4pgyDj5QFY';

// Module-level so the light/dark/system buttons can name themselves without a
// switch at the call site.
const APPEARANCE_KEYS = {
  light:  'settings.appearanceLight',
  dark:   'settings.appearanceDark',
  system: 'settings.appearanceSystem',
} as const satisfies Record<ColorMode, TranslationKey>;

const FONT_OPTIONS: { key: FontSize; size: number }[] = [
  { key: 'Small',  size: 14 },
  { key: 'Medium', size: 17 },
  { key: 'Large',  size: 20 },
  { key: 'XL',     size: 24 },
];

interface SettingsPanelProps {
  user: User | null;
}

export default function SettingsPanel({ user }: SettingsPanelProps) {
  const supabase = createClient();
  const { t } = useTranslation();
  const { uiLanguage, setUiLanguage } = useLanguage();
  const isGuest = !user;
  const [fontSize, setFontSize] = useState<FontSize>('Large');
  const [colorMode, setColorMode] = useState<ColorMode>('light');
  const [isPro, setIsPro] = useState(false);
  const [isTrial, setIsTrial] = useState(false);
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [nameSaving, setNameSaving] = useState(false);
  const [stripeLoading, setStripeLoading] = useState(false);
  const [loading, setLoading] = useState(!isGuest);
  const [justUpgraded, setJustUpgraded] = useState(false);
  const [showIntro, setShowIntro] = useState(false);

  useEffect(() => {
    setColorMode(getStoredColorMode());
    if (!isGuest) {
      loadProfile();
    } else if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('immerse_font_size') as FontSize | null;
      if (saved) { setFontSize(saved); applyFontSize(saved); }
    }
    if (typeof window !== 'undefined') {
      setJustUpgraded(new URLSearchParams(window.location.search).get('upgraded') === '1');
    }
  }, [user?.id]);

  async function loadProfile() {
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('font_size, is_pro, full_name, username')
      .eq('id', user.id)
      .single();
    if (data) {
      const loadedSize = (data.font_size as FontSize) ?? 'Large';
      setFontSize(loadedSize);
      applyFontSize(loadedSize);
      const paidPro = data.is_pro ?? false;
      const trial = !paidPro && isInTrial(user.created_at);
      setIsPro(paidPro || trial);
      setIsTrial(trial);
      const name = data.full_name || user.user_metadata?.full_name || '';
      setFullName(name);
      setNameInput(name);
      setUsername(data.username || user.user_metadata?.username || '');
    } else {
      // No profiles row yet (e.g. brand-new account) — still honor the trial.
      const trial = isInTrial(user.created_at);
      setIsPro(trial);
      setIsTrial(trial);
      const name = user.user_metadata?.full_name || '';
      setFullName(name);
      setNameInput(name);
      setUsername(user.user_metadata?.username || '');
    }
    setLoading(false);
  }

  async function handleFontChange(size: FontSize) {
    setFontSize(size);
    applyFontSize(size);   // updates --quote-font-size + localStorage immediately, app-wide
    if (user) {
      await supabase.from('profiles').update({ font_size: size }).eq('id', user.id);
    }
  }

  async function handleSaveName() {
    if (!user) return;
    const trimmed = nameInput.trim();
    if (!trimmed || trimmed === fullName) { setEditingName(false); return; }
    setNameSaving(true);
    await supabase.from('profiles').update({ full_name: trimmed }).eq('id', user.id);
    setFullName(trimmed);
    setEditingName(false);
    setNameSaving(false);
  }

  async function handleUpgrade() {
    setStripeLoading(true);
    const res = await fetch('/api/stripe/checkout', { method: 'POST' });
    const { url } = await res.json();
    if (url) window.location.href = url;
    else setStripeLoading(false);
  }

  async function handleManageSubscription() {
    setStripeLoading(true);
    const res = await fetch('/api/stripe/portal', { method: 'POST' });
    const { url } = await res.json();
    if (url) window.location.href = url;
    else setStripeLoading(false);
  }

  function handleColorModeChange(mode: ColorMode) {
    setColorMode(mode);
    applyColorMode(mode);   // toggles .dark on <html> + persists to localStorage
  }

  const previewSize = FONT_OPTIONS.find(f => f.key === fontSize)?.size ?? 20;

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-lg mx-auto px-8 py-10">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-[#E2EAF2] mb-8">{t('nav.settings')}</h1>

        {justUpgraded && (
          <div className="mb-6 bg-green-50 border border-green-200 text-green-800 text-sm rounded-2xl px-5 py-4 flex items-center gap-3">
            <span className="text-xl">🎉</span>
            <p><span className="font-semibold">{t('settings.welcomeToPro')}</span> {t('settings.proRestoredBody')}</p>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-6 h-6 border-2 border-[#1B6B7B] dark:border-[#2D9DB3] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-6">

            {/* Account */}
            <section className="bg-white dark:bg-[#1B2A38] rounded-2xl border border-gray-100 dark:border-[#2D4050] shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 dark:border-[#2D4050]">
                <span className="text-xs font-bold tracking-widest uppercase text-gray-400 dark:text-[#5C7A8E]">{t('settings.account')}</span>
              </div>

              {!isGuest && (
                <>
                  {/* Full Name */}
                  <div className="px-5 py-4 flex items-center justify-between border-b border-gray-50 dark:border-[#2D4050]/60">
                    <span className="text-xs text-gray-400 dark:text-[#5C7A8E] w-24 shrink-0">{t('settings.fullName')}</span>
                    {editingName ? (
                      <div className="flex items-center gap-2 flex-1">
                        <input
                          autoFocus
                          value={nameInput}
                          onChange={e => setNameInput(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') { setEditingName(false); setNameInput(fullName); } }}
                          className="flex-1 text-sm text-gray-900 dark:text-[#E2EAF2] border border-gray-200 dark:border-[#2D4050] rounded-lg px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-[#1B6B7B]/30 dark:focus:ring-[#2D9DB3]/30 focus:border-[#1B6B7B] dark:focus:border-[#2D9DB3]"
                        />
                        <button onClick={handleSaveName} disabled={nameSaving} className="text-xs text-[#1B6B7B] dark:text-[#2D9DB3] font-semibold hover:underline disabled:opacity-50">
                          {nameSaving ? t('common.saving') : t('common.save')}
                        </button>
                        <button onClick={() => { setEditingName(false); setNameInput(fullName); }} className="text-xs text-gray-400 dark:text-[#5C7A8E] hover:text-gray-600 dark:hover:text-[#8FA4B8]">{t('common.cancel')}</button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 flex-1 justify-end">
                        <span className="text-sm text-gray-700 dark:text-[#B8C7D6]">{fullName || '—'}</span>
                        <button onClick={() => { setEditingName(true); setNameInput(fullName); }} className="text-xs text-[#1B6B7B] dark:text-[#2D9DB3] hover:underline">{t('settings.edit')}</button>
                      </div>
                    )}
                  </div>

                  {/* Username */}
                  <div className="px-5 py-4 flex items-center justify-between border-b border-gray-50 dark:border-[#2D4050]/60">
                    <span className="text-xs text-gray-400 dark:text-[#5C7A8E] w-24 shrink-0">{t('settings.username')}</span>
                    <span className="text-sm text-gray-700 dark:text-[#B8C7D6]">@{username || '—'}</span>
                  </div>
                </>
              )}

              {/* Plan */}
              <div className="px-5 py-4 flex items-center justify-between">
                <span className="text-xs text-gray-400 dark:text-[#5C7A8E] w-24 shrink-0">{t('settings.plan')}</span>
                <div className="flex items-center gap-3">
                  <span className={`text-sm font-semibold ${isPro ? 'text-[#1B6B7B] dark:text-[#2D9DB3]' : 'text-gray-500 dark:text-[#8FA4B8]'}`}>
                    {isGuest ? t('settings.planGuest')
                      : isTrial ? t('settings.planTrial')
                      : isPro ? t('settings.planPro')
                      : t('settings.planStandard')}
                  </span>
                  {!isGuest && (isPro && !isTrial ? (
                    <button
                      onClick={handleManageSubscription}
                      disabled={stripeLoading}
                      className="text-xs text-gray-400 dark:text-[#5C7A8E] hover:text-gray-600 dark:hover:text-[#8FA4B8] hover:underline disabled:opacity-50"
                    >
                      {stripeLoading ? t('common.loading') : t('settings.manage')}
                    </button>
                  ) : (
                    <button
                      onClick={handleUpgrade}
                      disabled={stripeLoading}
                      className="text-xs font-semibold bg-[#1B6B7B] dark:bg-[#2D9DB3] text-white px-3 py-1.5 rounded-lg hover:bg-[#155a68] dark:hover:bg-[#2589A0] transition-colors disabled:opacity-50"
                    >
                      {stripeLoading ? t('common.loading') : t('settings.upgradeCta')}
                    </button>
                  ))}
                  {isGuest && (
                    <a
                      href="/login"
                      className="text-xs font-semibold bg-[#1B6B7B] dark:bg-[#2D9DB3] text-white px-3 py-1.5 rounded-lg hover:bg-[#155a68] dark:hover:bg-[#2589A0] transition-colors"
                    >
                      {t('common.signInCreate')}
                    </a>
                  )}
                </div>
              </div>
            </section>

            {/* Language — the interface only. Which library you read is a
                separate control in the Library header, as on mobile. */}
            <section className="bg-white dark:bg-[#1B2A38] rounded-2xl border border-gray-100 dark:border-[#2D4050] shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 dark:border-[#2D4050]">
                <span className="text-xs font-bold tracking-widest uppercase text-gray-400 dark:text-[#5C7A8E]">{t('settings.language')}</span>
              </div>
              <div className="px-5 py-4">
                <div className="flex gap-2">
                  {UI_LANGUAGES.map(({ code, label }) => (
                    <button
                      key={code}
                      onClick={() => setUiLanguage(code)}
                      className={`flex-1 py-2 rounded-xl border text-sm font-medium transition-colors ${
                        uiLanguage === code
                          ? 'border-[#1B6B7B] dark:border-[#2D9DB3] bg-[#1B6B7B]/8 dark:bg-[#2D9DB3]/8 text-[#1B6B7B] dark:text-[#2D9DB3]'
                          : 'border-gray-200 dark:border-[#2D4050] text-gray-500 dark:text-[#8FA4B8] hover:border-gray-300 dark:hover:border-white/15'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-400 dark:text-[#5C7A8E] mt-3">
                  {t('settings.appLanguageHint')}
                </p>
              </div>
            </section>

            {/* Font size */}
            <section className="bg-white dark:bg-[#1B2A38] rounded-2xl border border-gray-100 dark:border-[#2D4050] shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 dark:border-[#2D4050]">
                <span className="text-xs font-bold tracking-widest uppercase text-gray-400 dark:text-[#5C7A8E]">{t('settings.fontSize')}</span>
              </div>
              <div className="px-5 py-4">
                <div className="flex gap-2 mb-4">
                  {FONT_OPTIONS.map(({ key, size }) => (
                    <button
                      key={key}
                      onClick={() => handleFontChange(key)}
                      className={`flex-1 flex flex-col items-center py-2.5 rounded-xl border transition-colors ${
                        fontSize === key
                          ? 'border-[#1B6B7B] dark:border-[#2D9DB3] bg-[#1B6B7B]/8 dark:bg-[#2D9DB3]/8 text-[#1B6B7B] dark:text-[#2D9DB3]'
                          : 'border-gray-200 dark:border-[#2D4050] text-gray-500 dark:text-[#8FA4B8] hover:border-gray-300 dark:hover:border-white/15'
                      }`}
                    >
                      <span className="font-semibold" style={{ fontSize: Math.min(size, 20) }}>A</span>
                      <span className="text-[10px] mt-1 font-medium">{key}</span>
                    </button>
                  ))}
                </div>
                <p className="text-gray-500 dark:text-[#8FA4B8] border-t border-gray-100 dark:border-[#2D4050] pt-3" style={{ fontSize: previewSize, lineHeight: 1.7 }}>
                  {t('settings.fontPreview', { size: fontSize })}
                </p>
              </div>
            </section>

            {/* Appearance */}
            <section className="bg-white dark:bg-[#1B2A38] rounded-2xl border border-gray-100 dark:border-[#2D4050] shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 dark:border-[#2D4050]">
                <span className="text-xs font-bold tracking-widest uppercase text-gray-400 dark:text-[#5C7A8E]">{t('settings.appearance')}</span>
              </div>
              <div className="px-5 py-4 flex gap-2">
                {(['light', 'dark', 'system'] as ColorMode[]).map(mode => (
                  <button
                    key={mode}
                    onClick={() => handleColorModeChange(mode)}
                    className={`flex-1 py-2 rounded-xl border text-sm font-medium capitalize transition-colors ${
                      colorMode === mode
                        ? 'border-[#1B6B7B] dark:border-[#2D9DB3] bg-[#1B6B7B]/8 dark:bg-[#2D9DB3]/8 text-[#1B6B7B] dark:text-[#2D9DB3]'
                        : 'border-gray-200 dark:border-[#2D4050] text-gray-500 dark:text-[#8FA4B8] hover:border-gray-300 dark:hover:border-white/15'
                    }`}
                  >
                    {t(APPEARANCE_KEYS[mode])}
                  </button>
                ))}
              </div>
            </section>

            {/* About */}
            <section className="bg-white dark:bg-[#1B2A38] rounded-2xl border border-gray-100 dark:border-[#2D4050] shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 dark:border-[#2D4050]">
                <span className="text-xs font-bold tracking-widest uppercase text-gray-400 dark:text-[#5C7A8E]">{t('settings.about')}</span>
              </div>
              <div className="px-5 py-4 flex items-center justify-between border-b border-gray-50 dark:border-[#2D4050]/60">
                <span className="text-xs text-gray-400 dark:text-[#5C7A8E]">{t('settings.version')}</span>
                <span className="text-sm text-gray-500 dark:text-[#8FA4B8]">{APP_VERSION}</span>
              </div>
              <div className="px-5 py-4 flex items-center justify-between border-b border-gray-50 dark:border-[#2D4050]/60">
                <span className="text-xs text-gray-400 dark:text-[#5C7A8E]">{t('settings.privacyPolicy')}</span>
                <a
                  href={uiLanguage === 'en' ? '/privacy' : `/privacy?lang=${uiLanguage}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-[#1B6B7B] dark:text-[#2D9DB3] hover:underline"
                >
                  {t('settings.viewExternal')}
                </a>
              </div>
              <button
                onClick={() => setShowIntro(true)}
                className="w-full px-5 py-4 flex items-center justify-between text-start border-b border-gray-50 dark:border-[#2D4050]/60 hover:bg-gray-50 dark:hover:bg-[#243040] transition-colors"
              >
                <span className="text-xs text-gray-400 dark:text-[#5C7A8E]">{t('settings.introTour')}</span>
                <span className="text-sm text-[#1B6B7B] dark:text-[#2D9DB3] hover:underline">{t('settings.replayOnboarding')} →</span>
              </button>
              <div className="px-5 py-4 flex items-center justify-between">
                <span className="text-xs text-gray-400 dark:text-[#5C7A8E]">{t('settings.fullFeatureVideo')}</span>
                <a
                  href={FEATURE_VIDEO_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-[#1B6B7B] dark:text-[#2D9DB3] hover:underline"
                >
                  {t('settings.watchFeatureVideo')} →
                </a>
              </div>
            </section>

          </div>
        )}
      </div>

      <Onboarding visible={showIntro} onClose={() => setShowIntro(false)} />
    </div>
  );
}
