'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';

type FontSize = 'Small' | 'Medium' | 'Large' | 'XL';
type ColorMode = 'light' | 'dark' | 'system';

const FONT_OPTIONS: { key: FontSize; size: number }[] = [
  { key: 'Small',  size: 14 },
  { key: 'Medium', size: 16 },
  { key: 'Large',  size: 18 },
  { key: 'XL',     size: 21 },
];

interface SettingsPanelProps {
  user: User;
}

export default function SettingsPanel({ user }: SettingsPanelProps) {
  const supabase = createClient();
  const [fontSize, setFontSize] = useState<FontSize>('Large');
  const [colorMode, setColorMode] = useState<ColorMode>('light');
  const [isPro, setIsPro] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfile();
  }, [user.id]);

  useEffect(() => {
    const root = document.documentElement;
    const isDark =
      colorMode === 'dark' ||
      (colorMode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    root.classList.toggle('dark', isDark);
  }, [colorMode]);

  async function loadProfile() {
    const { data } = await supabase
      .from('profiles')
      .select('font_size, color_mode, is_pro')
      .eq('id', user.id)
      .single();
    if (data) {
      setFontSize((data.font_size as FontSize) ?? 'Large');
      setColorMode((data.color_mode as ColorMode) ?? 'light');
      setIsPro(data.is_pro ?? false);
    }
    setLoading(false);
  }

  async function handleFontChange(size: FontSize) {
    setFontSize(size);
    await supabase.from('profiles').update({ font_size: size }).eq('id', user.id);
  }

  async function handleColorModeChange(mode: ColorMode) {
    setColorMode(mode);
    await supabase.from('profiles').update({ color_mode: mode }).eq('id', user.id);
  }

  const displayName = user.user_metadata?.full_name || user.email || '';
  const previewSize = FONT_OPTIONS.find(f => f.key === fontSize)?.size ?? 18;

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-lg mx-auto px-8 py-10">
        <h1 className="text-2xl font-semibold text-gray-900 mb-8">Settings</h1>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-6 h-6 border-2 border-[#1B6B7B] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-6">

            {/* Account */}
            <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100">
                <span className="text-xs font-bold tracking-widest uppercase text-gray-400">Account</span>
              </div>
              <div className="px-5 py-4 flex items-center justify-between">
                <span className="text-sm text-gray-700">{displayName}</span>
                <span className={`text-sm font-semibold ${isPro ? 'text-[#1B6B7B]' : 'text-gray-400'}`}>
                  {isPro ? 'Pro' : 'Free'}
                </span>
              </div>
            </section>

            {/* Font size */}
            <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100">
                <span className="text-xs font-bold tracking-widest uppercase text-gray-400">Font Size</span>
              </div>
              <div className="px-5 py-4">
                <div className="flex gap-2 mb-4">
                  {FONT_OPTIONS.map(({ key, size }) => (
                    <button
                      key={key}
                      onClick={() => handleFontChange(key)}
                      className={`flex-1 flex flex-col items-center py-2.5 rounded-xl border transition-colors ${
                        fontSize === key
                          ? 'border-[#1B6B7B] bg-[#1B6B7B]/8 text-[#1B6B7B]'
                          : 'border-gray-200 text-gray-500 hover:border-gray-300'
                      }`}
                    >
                      <span className="font-semibold" style={{ fontSize: Math.min(size, 20) }}>A</span>
                      <span className="text-[10px] mt-1 font-medium">{key}</span>
                    </button>
                  ))}
                </div>
                <p className="text-gray-500 border-t border-gray-100 pt-3" style={{ fontSize: previewSize, lineHeight: 1.7 }}>
                  Preview text at {fontSize} size.
                </p>
              </div>
            </section>

            {/* Appearance */}
            <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100">
                <span className="text-xs font-bold tracking-widest uppercase text-gray-400">Appearance</span>
              </div>
              <div className="px-5 py-4 flex gap-2">
                {(['light', 'dark', 'system'] as ColorMode[]).map(mode => (
                  <button
                    key={mode}
                    onClick={() => handleColorModeChange(mode)}
                    className={`flex-1 py-2 rounded-xl border text-sm font-medium capitalize transition-colors ${
                      colorMode === mode
                        ? 'border-[#1B6B7B] bg-[#1B6B7B]/8 text-[#1B6B7B]'
                        : 'border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </section>

          </div>
        )}
      </div>
    </div>
  );
}
