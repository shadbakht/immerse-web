// Reader typography — the single source of truth for both platforms.
//
// ⚠️ THIS FILE IS A MIRROR of Immerse/src/config/readerTypography.ts. Keep them
// byte-identical below this header: a value that differs between them is a book
// that looks different on the phone and the laptop, which is exactly what this
// work exists to fix. It is duplicated rather than shared because the two apps
// are separate repos with separate deploys — the same reason @immerse/i18n is a
// published package and not a path import.
//
// What lives where:
//   • `fontSize` stays in `profiles.font_size`. It predates this module, it is
//     already synced, and it drives quote text on every OTHER screen too — the
//     reader is not its only consumer.
//   • Everything else lives in `profiles.reader_prefs` (jsonb), mirrored to
//     localStorage here and AsyncStorage on mobile. One column rather than ten,
//     because these are a set: they are read together, written together, and
//     only ever mean anything together.

export type Typeface = 'literata' | 'charis' | 'ebgaramond' | 'system';
export type LineSpacing = 'tight' | 'normal' | 'relaxed' | 'loose';
export type Margins = 'narrow' | 'normal' | 'wide';
export type ParagraphStyle = 'spaced' | 'indented';
export type ReaderThemeKey = 'light' | 'sepia' | 'quiet' | 'dark' | 'night' | 'system';

export interface ReaderPrefs {
  typeface: Typeface;
  lineSpacing: LineSpacing;
  margins: Margins;
  justify: boolean;
  paragraphStyle: ParagraphStyle;
  letterSpacing: number;          // em, applied to body text
  wordSpacing: number;            // em
  weight: number;                 // variable-font weight axis
  theme: ReaderThemeKey;
  showParagraphNumbers: boolean;
}

// ⚠️ NEVER give profiles.reader_prefs a DB default. NULL means "this user has
// never chosen", which is what tells the first device to seed it — the same
// rule that governs ui_language/content_language. A default would make a
// never-touched account indistinguishable from a deliberate reset.
export const DEFAULT_READER_PREFS: ReaderPrefs = {
  typeface: 'literata',
  lineSpacing: 'normal',
  margins: 'normal',
  justify: false,
  paragraphStyle: 'spaced',
  letterSpacing: 0,
  wordSpacing: 0,
  weight: 400,
  theme: 'system',
  showParagraphNumbers: true,
};

// ── Typefaces ────────────────────────────────────────────────────────────────
// `files` are the woff2 basenames in assets/fonts (mobile) / public/fonts (web).
// `stack` is the CSS font-family list. It ALWAYS ends in a generic serif: the
// corpus contains 22 Hebrew letters that no face here covers (see
// assets/fonts/README.md), and a graceful fallback beats tofu.

export interface TypefaceDef {
  key: Typeface;
  /**
   * Shown in the picker. A typeface name is a proper noun, so it is NOT
   * translated — "Literata" is Literata in every language. Empty when the name
   * is an ordinary word instead; see `labelKey`.
   */
  label: string;
  /** Set when the name IS translatable ("System"). Wins over `label`. */
  labelKey?: string;
  /** i18n key for the one-line description under the name. */
  blurbKey: string;
  family: string;
  files: { roman?: string; italic?: string; bold?: string; boldItalic?: string };
  /** Variable weight range, or null for the static 4-cut family. */
  weightAxis: [number, number] | null;
  stack: string;
  /**
   * Applied to the user's chosen px size before it reaches the page. `1` (the
   * default, so most faces omit this) means "this face's x-height at size N
   * reads like the others' at size N" — that's true of Literata and Charis
   * SIL, but NOT of an old-style Garamond. Measured directly from each
   * bundled font's own OS/2 table (fontTools, `sxHeight / unitsPerEm`), not
   * eyeballed: Literata 0.507, Charis SIL 0.482, EB Garamond 0.400 — EB
   * Garamond's lowercase letters are ~21% shorter than Literata's at an
   * identical nominal size, which is what "the largest size still reads like
   * everyone else's medium" actually was.
   *
   * Mirror of src/config/readerTypography.ts on the mobile repo — keep the
   * value in step there too.
   */
  sizeMultiplier?: number;
}

export const TYPEFACES: TypefaceDef[] = [
  {
    key: 'literata',
    label: 'Literata',
    blurbKey: 'appearance.typefaceLiterataBlurb',
    family: 'Literata',
    files: { roman: 'literata-roman.woff2', italic: 'literata-italic.woff2' },
    weightAxis: [200, 900],
    stack: `'Literata', Georgia, serif`,
  },
  {
    key: 'charis',
    label: 'Charis',
    blurbKey: 'appearance.typefaceCharisBlurb',
    family: 'Charis SIL',
    files: {
      roman: 'charis-regular.woff2',
      italic: 'charis-italic.woff2',
      bold: 'charis-bold.woff2',
      boldItalic: 'charis-bolditalic.woff2',
    },
    weightAxis: null,
    stack: `'Charis SIL', Charter, Georgia, serif`,
  },
  {
    key: 'ebgaramond',
    label: 'EB Garamond',
    blurbKey: 'appearance.typefaceGaramondBlurb',
    family: 'EB Garamond',
    files: { roman: 'ebgaramond-roman.woff2', italic: 'ebgaramond-italic.woff2' },
    weightAxis: [400, 800],
    stack: `'EB Garamond', Garamond, Georgia, serif`,
    // 0.507 / 0.400 — see sizeMultiplier's own doc comment for how this was
    // measured. Brings EB Garamond's x-height at any given size step up to
    // what Literata's already looks like at that same step.
    sizeMultiplier: 1.27,
  },
  {
    key: 'system',
    label: '',
    labelKey: 'appearance.typefaceSystem',
    blurbKey: 'appearance.typefaceSystemBlurb',
    family: '',
    files: {},
    weightAxis: null,
    stack: `Georgia, 'Times New Roman', serif`,
  },
];

// Script faces are not chosen by the user — they are selected per book, by the
// book's language, and composed with the Latin face via unicode-range.
export const SCRIPT_FACES = {
  arabic: {
    family: 'Noto Naskh Arabic',
    file: 'noto-naskh-arabic.woff2',
    // Arabic + Supplement + Extended-A + both Presentation Forms blocks. This
    // covers Persian's پ چ ژ گ, farsi yeh U+06CC, keheh U+06A9 and the Persian
    // digits U+06F0-06F9 — all of which are OUTSIDE what "Arabic" colloquially
    // means. See assets/fonts/README.md.
    unicodeRange:
      'U+0600-06FF, U+0750-077F, U+08A0-08FF, U+FB50-FDFF, U+FE70-FEFF',
  },
  cjk: {
    family: 'Noto Serif SC',
    file: 'noto-serif-sc.woff2',
    unicodeRange:
      'U+2E80-2EFF, U+3000-303F, U+3400-4DBF, U+4E00-9FFF, U+F900-FAFF, U+FF00-FFEF',
  },
} as const;

/** Which script face a book needs, from `books.language`. */
export function scriptFaceFor(language: string | null | undefined):
    keyof typeof SCRIPT_FACES | null {
  const l = (language ?? '').toLowerCase();
  if (l.startsWith('fa') || l.startsWith('ar') || l.startsWith('ur')) return 'arabic';
  if (l.startsWith('zh') || l.startsWith('ja') || l.startsWith('ko')) return 'cjk';
  return null;
}

// ── Scales ───────────────────────────────────────────────────────────────────

// Line spacing is now INDEPENDENT of font size. It used to be welded to the
// size bucket (FONT_SIZES.lineHeightRatio), so a reader who wanted big text was
// forced into loose leading and vice versa. 'normal' reproduces the old mid
// value so nobody's current page reflows on upgrade.
export const LINE_SPACING: Record<LineSpacing, number> = {
  tight: 1.30,
  normal: 1.50,
  relaxed: 1.72,
  loose: 1.95,
};

// `pad` is the horizontal padding; `maxWidth` caps the measure on tablets and
// desktop. On a phone only `pad` binds, which is why the wide setting narrows
// the column by ADDING padding rather than by lowering maxWidth alone.
//
// ⚠️ `pad` houses BOTH gutters — paragraph numbers overhang into the inline-end
// side, annotation icons into the inline-start side. That is why `narrow` is 30
// and not 20: an annotation icon is 25px wide, so anything tighter puts it on
// top of the first word. The floors are built into the scale rather than
// applied as a correction afterwards, so what the user picks is what they get.
export const MARGINS: Record<Margins, { pad: number; maxWidth: number }> = {
  narrow: { pad: 30, maxWidth: 780 },
  normal: { pad: 42, maxWidth: 700 },
  wide:   { pad: 58, maxWidth: 620 },
};

/** Number gutter: leaves 6px of air, never wider than 34px. */
export const gutterFor = (pad: number) => Math.min(pad - 6, 34);
/** Annotation-icon gutter: the icon is 25px wide, so 4px of air. */
export const iconGutterFor = (pad: number) => Math.min(pad - 4, 32);

export const LETTER_SPACING_RANGE = { min: -0.02, max: 0.06, step: 0.01 };
export const WORD_SPACING_RANGE   = { min: 0,     max: 0.30, step: 0.05 };
export const WEIGHT_RANGE         = { min: 300,   max: 600,  step: 50   };

// ── Themes ───────────────────────────────────────────────────────────────────
// `bg`/`fg` are the page. `muted` is the paragraph-number gutter and
// attributions. `rule` is hairlines and chapter dividers. `accent` is the
// small-caps chapter label.
//
// 'night' deliberately does NOT pair pure white with pure black: at OLED
// contrast that combination halates and smears serif stems. It dims the text
// instead, which is what every good night mode does.

export interface ReaderPalette {
  bg: string; fg: string; muted: string; rule: string; accent: string;
  /** Chrome (status bar, native WebView backing layer) should match the page. */
  isDarkChrome: boolean;
}

export const READER_THEMES: Record<Exclude<ReaderThemeKey, 'system'>, ReaderPalette> = {
  light: { bg: '#FFFFFF', fg: '#1C2B35', muted: '#8A97A3', rule: '#E5E7EB', accent: '#1B6B7B', isDarkChrome: false },
  sepia: { bg: '#FAF3E4', fg: '#453425', muted: '#9C8B70', rule: '#E3D7BF', accent: '#8A6A3B', isDarkChrome: false },
  quiet: { bg: '#E9E7E1', fg: '#2F312C', muted: '#83857D', rule: '#D2D0C8', accent: '#5B6B58', isDarkChrome: false },
  dark:  { bg: '#0F1923', fg: '#E2EAF2', muted: '#5C7A8E', rule: '#2D4050', accent: '#2D9DB3', isDarkChrome: true },
  night: { bg: '#000000', fg: '#B9C4CF', muted: '#4A5A68', rule: '#1C2730', accent: '#2D9DB3', isDarkChrome: true },
};

/** Resolve 'system' against the app's current dark-mode state. */
export function resolveTheme(key: ReaderThemeKey, isDark: boolean): ReaderPalette {
  if (key === 'system') return isDark ? READER_THEMES.dark : READER_THEMES.light;
  return READER_THEMES[key];
}

// ── Payload ──────────────────────────────────────────────────────────────────
// What the WebView (mobile) or the passage container (web) actually receives.
// Everything is pre-resolved here so neither renderer has to know the scales.

export interface ReaderThemePayload {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  background: string;
  text: string;
  muted: string;
  rule: string;
  accent: string;
  padding: number;
  maxWidth: number;
  gutter: number;
  iconGutter: number;
  justify: boolean;
  indent: boolean;
  paragraphGap: number;      // em
  letterSpacing: number;     // em
  wordSpacing: number;       // em
  weight: number;
  showParagraphNumbers: boolean;
  /** Dark themes get antialiased smoothing; light ones must NOT — it
   *  under-weights serif stems on a light ground. */
  darkSmoothing: boolean;
}

export function buildThemePayload(
  prefs: ReaderPrefs,
  fontSizePx: number,
  isDark: boolean,
): ReaderThemePayload {
  const palette = resolveTheme(prefs.theme, isDark);
  const face = TYPEFACES.find(t => t.key === prefs.typeface) ?? TYPEFACES[0];
  const m = MARGINS[prefs.margins];
  const pad = m.pad;

  return {
    fontFamily: face.stack,
    fontSize: Math.round(fontSizePx * (face.sizeMultiplier ?? 1)),
    lineHeight: LINE_SPACING[prefs.lineSpacing],
    background: palette.bg,
    text: palette.fg,
    muted: palette.muted,
    rule: palette.rule,
    accent: palette.accent,
    padding: pad,
    maxWidth: m.maxWidth,
    gutter: gutterFor(pad),
    iconGutter: iconGutterFor(pad),
    justify: prefs.justify,
    indent: prefs.paragraphStyle === 'indented',
    // Indented paragraphs are the traditional book setting: first-line indent
    // AND no vertical gap. Keeping the gap as well gives you both cues at once,
    // which reads as a mistake.
    paragraphGap: prefs.paragraphStyle === 'indented' ? 0 : 1,
    letterSpacing: prefs.letterSpacing,
    wordSpacing: prefs.wordSpacing,
    weight: face.weightAxis ? prefs.weight : (prefs.weight >= 550 ? 700 : 400),
    showParagraphNumbers: prefs.showParagraphNumbers,
    darkSmoothing: palette.isDarkChrome,
  };
}

/** Tolerant of partial/legacy/garbage stored values — never throws. */
export function normalizePrefs(raw: unknown): ReaderPrefs {
  const p = (raw && typeof raw === 'object' ? raw : {}) as Partial<ReaderPrefs>;
  const oneOf = <T extends string>(v: unknown, allowed: readonly T[], d: T): T =>
    (typeof v === 'string' && (allowed as readonly string[]).includes(v) ? v as T : d);
  const clamp = (v: unknown, lo: number, hi: number, d: number) =>
    typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d;

  return {
    typeface: oneOf(p.typeface, TYPEFACES.map(t => t.key), DEFAULT_READER_PREFS.typeface),
    lineSpacing: oneOf(p.lineSpacing, ['tight', 'normal', 'relaxed', 'loose'] as const, DEFAULT_READER_PREFS.lineSpacing),
    margins: oneOf(p.margins, ['narrow', 'normal', 'wide'] as const, DEFAULT_READER_PREFS.margins),
    justify: typeof p.justify === 'boolean' ? p.justify : DEFAULT_READER_PREFS.justify,
    paragraphStyle: oneOf(p.paragraphStyle, ['spaced', 'indented'] as const, DEFAULT_READER_PREFS.paragraphStyle),
    letterSpacing: clamp(p.letterSpacing, LETTER_SPACING_RANGE.min, LETTER_SPACING_RANGE.max, 0),
    wordSpacing: clamp(p.wordSpacing, WORD_SPACING_RANGE.min, WORD_SPACING_RANGE.max, 0),
    weight: clamp(p.weight, WEIGHT_RANGE.min, WEIGHT_RANGE.max, 400),
    theme: oneOf(p.theme, ['light', 'sepia', 'quiet', 'dark', 'night', 'system'] as const, DEFAULT_READER_PREFS.theme),
    showParagraphNumbers: typeof p.showParagraphNumbers === 'boolean'
      ? p.showParagraphNumbers : DEFAULT_READER_PREFS.showParagraphNumbers,
  };
}
