'use client';

// Settings → Appearance. The web counterpart to mobile's AppearanceScreen.
//
// Web keeps this inline rather than pushing it to its own route: the settings
// panel already scrolls and there is room, whereas on a phone the same controls
// would have buried everything below them. The control set and every scale are
// identical — they come from the same readerTypography module.
//
// This owns the reader preferences and broadcasts changes on the
// `appearance-changed` window event, which ReaderPanel listens for. Settings
// and the reader are siblings under AppShell, so threading a dozen typography
// props through it to repaint what are really just CSS variables would be
// worse than an event.

import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useTranslation } from '@/contexts/LanguageProvider';
import { directionOf, type TranslationKey } from '@immerse/i18n';
import {
  TYPEFACES, LINE_SPACING, MARGINS, LETTER_SPACING_RANGE, WORD_SPACING_RANGE,
  WEIGHT_RANGE, DEFAULT_READER_PREFS, resolveTheme,
  type ReaderPrefs, type LineSpacing, type Margins, type ParagraphStyle,
  type ReaderThemeKey, type Typeface,
} from '@/lib/readerTypography';
import { getStoredPrefs, saveReaderPrefs } from '@/lib/readerPrefs';
import { type ColorMode } from '@/lib/colorMode';
import { type FontSize, FONT_SIZE_PX } from '@/lib/fontSize';

const CARD =
  'bg-white dark:bg-[#1B2A38] rounded-2xl border border-gray-100 dark:border-[#2D4050] shadow-sm overflow-hidden';
const CARD_HEAD =
  'px-5 py-3 border-b border-gray-100 dark:border-[#2D4050] text-xs font-bold tracking-widest uppercase text-gray-400 dark:text-[#5C7A8E]';
const PILL_ON =
  'border-[#1B6B7B] dark:border-[#2D9DB3] bg-[#1B6B7B]/8 dark:bg-[#2D9DB3]/8 text-[#1B6B7B] dark:text-[#2D9DB3]';
const PILL_OFF =
  'border-gray-200 dark:border-[#2D4050] text-gray-500 dark:text-[#8FA4B8] hover:border-gray-300 dark:hover:border-white/15';

const LINE_KEYS: LineSpacing[] = ['tight', 'normal', 'relaxed', 'loose'];
const MARGIN_KEYS: Margins[] = ['narrow', 'normal', 'wide'];
const PARA_KEYS: ParagraphStyle[] = ['spaced', 'indented'];
const THEME_KEYS: ReaderThemeKey[] = ['light', 'sepia', 'quiet', 'dark', 'night', 'system'];
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

interface Props {
  supabase: SupabaseClient;
  userId: string | null;
  fontSize: FontSize;
  onFontChange: (s: FontSize) => void;
  fontOptions: { key: FontSize; size: number }[];
  colorMode: ColorMode;
  onColorModeChange: (m: ColorMode) => void;
  appearanceKeys: Record<ColorMode, TranslationKey>;
}

export default function AppearanceSection({
  supabase, userId, fontSize, onFontChange, fontOptions,
  colorMode, onColorModeChange, appearanceKeys,
}: Props) {
  const { t, uiLanguage } = useTranslation();
  const [prefs, setPrefsState] = useState<ReaderPrefs>(DEFAULT_READER_PREFS);
  const [fineOpen, setFineOpen] = useState(false);

  useEffect(() => { setPrefsState(getStoredPrefs()); }, []);

  const isDark = () =>
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

  function update(patch: Partial<ReaderPrefs>) {
    const next = { ...prefs, ...patch };
    setPrefsState(next);
    saveReaderPrefs(supabase, userId, next, {
      fontSizePx: FONT_SIZE_PX[fontSize], isDark: isDark(),
    });
    window.dispatchEvent(new CustomEvent<ReaderPrefs>('appearance-changed', { detail: next }));
  }

  const palette = resolveTheme(prefs.theme, isDark());
  const bodyPx = FONT_SIZE_PX[fontSize];
  const face = TYPEFACES.find(f => f.key === prefs.typeface) ?? TYPEFACES[0];

  return (
    <section className={CARD}>
      <div className={CARD_HEAD}>{t('appearance.title')}</div>

      {/* ── Live specimen. Unlike mobile's, this one CAN use the real webfont:
             the same @font-face rules that serve the reader serve this page. */}
      <div className="px-5 pt-4">
        <div
          className="appearance-specimen rounded-xl border px-6 py-5"
          lang={uiLanguage}
          dir={directionOf(uiLanguage)}
          style={{
            background: palette.bg,
            borderColor: palette.rule,
            color: palette.fg,
            fontFamily: face.stack,
            fontSize: bodyPx,
            lineHeight: LINE_SPACING[prefs.lineSpacing],
            fontWeight: prefs.weight,
            letterSpacing: `${prefs.letterSpacing}em`,
            wordSpacing: `${prefs.wordSpacing}em`,
            textAlign: prefs.justify ? 'justify' : 'start',
            hyphens: 'auto',
          }}
        >
          <div
            className="text-[10px] font-bold tracking-[0.14em] uppercase mb-2.5"
            style={{ color: palette.muted }}
          >
            {t('appearance.preview')}
          </div>
          {/* Chapter eyebrow — mirrors readerHtml.ts .chapter-label: centred,
              accent-coloured small caps flanked by hairline rules. The drop cap
              on the paragraph below is the reader's own ::first-letter rule,
              scoped to .appearance-specimen in globals.css. Spacing (0.4em top,
              1.1em to the paragraph, line-height 1.4) matches the mobile
              specimen's .chapter-heading / .chapter-label so the eyebrow sits
              the same distance from the drop cap on phone and laptop. */}
          <div
            className="flex items-center justify-center gap-3.5 uppercase"
            style={{
              color: palette.accent,
              fontSize: '0.85em',
              fontWeight: 600,
              letterSpacing: '0.14em',
              lineHeight: 1.4,
              margin: '0.4em 0 1.1em',
            }}
          >
            <span className="flex-1 h-px" style={{ background: palette.rule }} />
            {t('appearance.previewHeading')}
            <span className="flex-1 h-px" style={{ background: palette.rule }} />
          </div>
          <p className="dropcap-open">{t('appearance.previewText')}</p>
          <p style={{
            textIndent: prefs.paragraphStyle === 'indented' ? '1.4em' : 0,
            marginTop: prefs.paragraphStyle === 'indented' ? 0 : '1em',
          }}>
            {t('appearance.previewText')}
          </p>
        </div>
      </div>

      {/* ── Typeface ── */}
      <Group label={t('appearance.typeface')}>
        <div className="grid grid-cols-2 gap-2">
          {TYPEFACES.map(f => (
            <button
              key={f.key}
              onClick={() => update({ typeface: f.key as Typeface })}
              className={`text-start px-3.5 py-2.5 rounded-xl border transition-colors ${
                prefs.typeface === f.key ? PILL_ON : PILL_OFF
              }`}
            >
              <span
                className="block text-[15px] font-semibold"
                style={{ fontFamily: f.stack }}
              >
                {f.labelKey ? t(f.labelKey as TranslationKey) : f.label}
              </span>
              <span className="block text-[11px] opacity-70 mt-0.5 leading-snug">
                {t(f.blurbKey as TranslationKey)}
              </span>
            </button>
          ))}
        </div>
      </Group>

      {/* ── Text size. NOT part of reader_prefs — it lives in
             profiles.font_size and drives quote text on every screen. ── */}
      <Group label={t('appearance.textSize')}>
        <div className="flex gap-2">
          {fontOptions.map(({ key, size }) => (
            <button
              key={key}
              onClick={() => onFontChange(key)}
              className={`flex-1 py-2.5 rounded-xl border transition-colors ${
                fontSize === key ? PILL_ON : PILL_OFF
              }`}
            >
              <span className="font-semibold" style={{ fontSize: Math.min(size, 20) }}>A</span>
            </button>
          ))}
        </div>
      </Group>

      <Group label={t('appearance.lineSpacing')}>
        <Pills
          options={LINE_KEYS.map(k => ({
            key: k, label: t(`appearance.lineSpacing${cap(k)}` as TranslationKey),
          }))}
          value={prefs.lineSpacing}
          onChange={k => update({ lineSpacing: k as LineSpacing })}
        />
      </Group>

      <Group label={t('appearance.margins')}>
        <Pills
          options={MARGIN_KEYS.map(k => ({
            key: k, label: t(`appearance.margins${cap(k)}` as TranslationKey),
          }))}
          value={prefs.margins}
          onChange={k => update({ margins: k as Margins })}
        />
      </Group>

      <Group label={t('appearance.paragraphStyle')} hint={t('appearance.paragraphHint')}>
        <Pills
          options={PARA_KEYS.map(k => ({
            key: k, label: t(`appearance.paragraph${cap(k)}` as TranslationKey),
          }))}
          value={prefs.paragraphStyle}
          onChange={k => update({ paragraphStyle: k as ParagraphStyle })}
        />
        <Toggle
          label={t('appearance.justify')}
          hint={t('appearance.justifyHint')}
          value={prefs.justify}
          onChange={v => update({ justify: v })}
        />
      </Group>

      {/* ── Page colour ── */}
      <Group label={t('appearance.theme')}>
        <div className="grid grid-cols-3 gap-2">
          {THEME_KEYS.map(key => {
            const p = resolveTheme(key, isDark());
            const on = prefs.theme === key;
            return (
              <button
                key={key}
                onClick={() => update({ theme: key })}
                className="flex flex-col items-center gap-1.5"
              >
                <span
                  className={`w-full h-12 rounded-xl flex items-center justify-center text-[15px] font-semibold border ${
                    on
                      ? 'border-[2.5px] border-[#1B6B7B] dark:border-[#2D9DB3]'
                      : 'border-gray-300/70 dark:border-white/15'
                  }`}
                  style={{ background: p.bg, color: p.fg }}
                >
                  Aa
                </span>
                <span className={`text-[11px] ${on ? 'text-[#1B6B7B] dark:text-[#2D9DB3] font-semibold' : 'text-gray-500 dark:text-[#8FA4B8]'}`}>
                  {key === 'system'
                    ? t('appearance.themeSystem')
                    : t(`appearance.theme${cap(key)}` as TranslationKey)}
                </span>
              </button>
            );
          })}
        </div>
      </Group>

      {/* ── Fine tuning ── */}
      <div className="px-5 py-4 border-t border-gray-100 dark:border-[#2D4050]">
        <button
          onClick={() => setFineOpen(o => !o)}
          className="w-full flex items-center justify-between text-xs font-bold tracking-widest uppercase text-gray-400 dark:text-[#5C7A8E]"
        >
          {t('appearance.fineTuning')}
          <span className={`transition-transform ${fineOpen ? 'rotate-90' : ''}`}>›</span>
        </button>
        {fineOpen && (
          <div className="mt-4 space-y-3">
            <Stepper
              label={t('appearance.characterSpacing')}
              value={prefs.letterSpacing} range={LETTER_SPACING_RANGE}
              format={v => (v === 0 ? '0' : `${v > 0 ? '+' : ''}${v.toFixed(2)}`)}
              onChange={v => update({ letterSpacing: v })}
            />
            <Stepper
              label={t('appearance.wordSpacing')}
              value={prefs.wordSpacing} range={WORD_SPACING_RANGE}
              format={v => (v === 0 ? '0' : `+${v.toFixed(2)}`)}
              onChange={v => update({ wordSpacing: v })}
            />
            <Stepper
              label={t('appearance.textWeight')}
              value={prefs.weight} range={WEIGHT_RANGE}
              format={v => String(v)}
              onChange={v => update({ weight: v })}
            />
            <Toggle
              label={t('appearance.paragraphNumbers')}
              hint={t('appearance.paragraphNumbersHint')}
              value={prefs.showParagraphNumbers}
              onChange={v => update({ showParagraphNumbers: v })}
            />
          </div>
        )}
      </div>

      {/* ── App theme (chrome, not the page) ── */}
      <Group label={t('appearance.appTheme')} hint={t('appearance.appThemeHint')}>
        <Pills
          options={(['light', 'dark', 'system'] as ColorMode[]).map(m => ({
            key: m, label: t(appearanceKeys[m]),
          }))}
          value={colorMode}
          onChange={m => onColorModeChange(m as ColorMode)}
        />
      </Group>

      <div className="px-5 pb-5">
        <button
          onClick={() => update(DEFAULT_READER_PREFS)}
          className="w-full py-2.5 rounded-xl border border-gray-200 dark:border-[#2D4050] text-sm font-semibold text-red-600 dark:text-[#EF5350] hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
        >
          {t('appearance.reset')}
        </button>
      </div>
    </section>
  );
}

// ── Building blocks ──────────────────────────────────────────────────────────

function Group({ label, hint, children }: {
  label: string; hint?: string; children: React.ReactNode;
}) {
  return (
    <div className="px-5 py-4 border-t border-gray-100 dark:border-[#2D4050]">
      <div className="text-xs font-bold tracking-widest uppercase text-gray-400 dark:text-[#5C7A8E] mb-3">
        {label}
      </div>
      {children}
      {hint && <p className="text-xs text-gray-400 dark:text-[#5C7A8E] mt-2.5 leading-relaxed">{hint}</p>}
    </div>
  );
}

function Pills({ options, value, onChange }: {
  options: { key: string; label: string }[];
  value: string;
  onChange: (k: string) => void;
}) {
  return (
    <div className="flex gap-2">
      {options.map(o => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          className={`flex-1 py-2 rounded-xl border text-sm font-medium transition-colors ${
            value === o.key ? PILL_ON : PILL_OFF
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Toggle({ label, hint, value, onChange }: {
  label: string; hint?: string; value: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 mt-3">
      <div className="min-w-0">
        <div className="text-sm text-gray-700 dark:text-[#B8C7D6]">{label}</div>
        {hint && <div className="text-xs text-gray-400 dark:text-[#5C7A8E] mt-0.5 leading-relaxed">{hint}</div>}
      </div>
      <button
        role="switch"
        aria-checked={value}
        aria-label={label}
        onClick={() => onChange(!value)}
        className={`shrink-0 w-11 h-6 rounded-full transition-colors relative ${
          value ? 'bg-[#1B6B7B] dark:bg-[#2D9DB3]' : 'bg-gray-300 dark:bg-[#2D4050]'
        }`}
      >
        <span
          className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${
            value ? 'start-[22px]' : 'start-0.5'
          }`}
        />
      </button>
    </div>
  );
}

function Stepper({ label, value, range, format, onChange }: {
  label: string;
  value: number;
  range: { min: number; max: number; step: number };
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  // Rounding through the step avoids the float drift that turns 0.30000000004
  // into a label nobody wants to read.
  const step = (dir: number) => {
    const next = Math.round((value + dir * range.step) / range.step) * range.step;
    onChange(Math.min(range.max, Math.max(range.min, Number(next.toFixed(4)))));
  };
  const btn =
    'px-3 py-1 text-lg font-semibold text-[#1B6B7B] dark:text-[#2D9DB3] disabled:opacity-30 disabled:cursor-not-allowed';
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-gray-700 dark:text-[#B8C7D6]">{label}</span>
      <div className="flex items-center rounded-xl bg-gray-50 dark:bg-[#243040] shrink-0">
        <button className={btn} onClick={() => step(-1)} disabled={value <= range.min} aria-label="−">−</button>
        <span className="text-xs text-gray-700 dark:text-[#B8C7D6] w-12 text-center tabular-nums">
          {format(value)}
        </span>
        <button className={btn} onClick={() => step(1)} disabled={value >= range.max} aria-label="+">+</button>
      </div>
    </div>
  );
}
