/**
 * The frame around a Persian/Arabic tablet — invocation («هواللّه»), addressee
 * line, closing place/date, a compilation's source line — recognised by its
 * wording so the reader can set it apart from body text.
 *
 * ⚠️ A COPY of Immerse/scripts/lib/tabletFrame.mjs, which marks the same lines
 * in the mobile packs (p.l / p.attribution, no paragraph number). Web styles
 * from passage text rather than classes, so it needs the rules themselves; keep
 * the two in step — src/lib/__tests__/tabletFrame.test.ts pins the shared cases.
 */

export type TabletLine = 'invocation' | 'addressee' | 'closing' | 'citation' | 'attribution' | 'number' | null;

const INVOCATION = /^\(?\s*(هو\s*ال|هو\s+اللّ|هواللّ|بسم\s|بسمه|باسمه|بنام\s|هو$|و\s*به\s*نستع)/;
const HONORIFIC = /(علیه|علیها|علیهما|علیهم|علیهنّ)\s*(ال)?(بهآء|بهاء|التّحیّة|الثّنآء|السّلام)/;
const VIA = /^(بواسطۀ|بواسطه|توسّط)/;
const HIJRI_MONTH = /(محرّم|صفر|ربیع|جمادی|رجب|شعبان|رمضان|شوّال|ذی‌القعده|ذی‌الحجّه|ذیقعده|ذیحجّه|ذی القعده|ذی الحجّه)/;
const DIGIT = /[۰-۹٠-٩]/;
const BARE_NUMBER = /^[۰-۹٠-٩]+$/;
const PLACES = new Set([
  'حیفا', 'عکّا', 'طهران', 'اسلامبول', 'ادرنه', 'بغداد', 'پاریس', 'لندن',
  'نیویورک', 'رمله', 'اسکندریّه',
]);

// A compilation's source line under an extract: «(کلمات مکنونۀ عربی، شمارۀ ۶۸) [۱]»
// (UHJ Research Department compilations, 331 in the fa pack). Either the
// extract number follows it, or the parenthesis names a source — which keeps
// the Aqdas's rubrics «(در هر ٢۴ ساعت يک بار ادا شود)» out.
const PARENTHESIZED = /^\((?:[^()]|\([^()]*\))*\)\s*(\[[0-9۰-۹٠-٩]+\])?$/;
const SOURCE_WORD = /(آثار|الواح|لوح|کلمات|مکاتیب|توقیع|خطابات|بیانات|منتخبات|آرشیو|مجموعه|نامه|دست‌خط|ترجمه|شمارۀ|صفحه|ص\s*[۰-۹٠-٩])/;

// The same frame in the Latin- and Cyrillic-script libraries (2026-10-28): a
// prayer's author line «‘Abdu’l-Bahá» / «Bahá’u’lláh» closing it (the German
// and Spanish prayer books), and an invocation «Er ist Gott!» / «Il est Dieu».
const AUTHOR_LINE = /^[—–-]?\s*(Bahá[’']u[’']lláh|[‘']Abdu[’']l-Bahá|(Der|Le|El|The) Báb|Báb|Shoghi Effendi|Бахаулла|Абдул-Баха|Баб|Шоги Эффенди)\.?$/;
const LATIN_INVOCATION = /^(Er ist Gott|Er ist der|Il est Dieu|Il est le|Él es Dios|Él es el|Он Бог)\b/i;

const words = (t: string) => t.split(/\s+/).filter(Boolean).length;

/**
 * 'invocation' | 'addressee' | 'closing' | 'citation' | 'attribution' | 'number' | null for one paragraph's
 * plain text. Word caps keep a long body paragraph that merely opens «هو …» or
 * mentions «علیه بهآء اللّه» out of the frame.
 */
export function classifyTabletLine(text: string): TabletLine {
  // Harakat and tatweel are typography, not wording: «هُو الابهی» and
  // «بسـم اللّه» are the same invocations as «هو الابهی» / «بسم اللّه». The
  // shadda (U+0651) stays — the patterns spell «اللّه» with it.
  const t = text.trim().replace(/[\u064B-\u0650\u0652\u0640]/g, '');
  if (BARE_NUMBER.test(t)) return 'number';
  const w = words(t);
  // A trailing extract number is decisive on its own — in any language (the
  // French compilations' «(D’une lettre datée du … p. 53) [3]» run long).
  const paren = w <= 45 && t.match(PARENTHESIZED);
  if (paren && (paren[1] || (w <= 25 && SOURCE_WORD.test(t)))) return 'citation';
  if (w <= 6 && INVOCATION.test(t)) return 'invocation';
  if (w <= 8 && LATIN_INVOCATION.test(t)) return 'invocation';
  if (AUTHOR_LINE.test(t)) return 'attribution';
  if (w <= 25 && VIA.test(t)) return 'addressee';
  if (w <= 18 && HONORIFIC.test(t) && !t.endsWith('.')) return 'addressee';
  if (w <= 8 && HIJRI_MONTH.test(t) && DIGIT.test(t)) return 'closing';
  if (w === 1 && PLACES.has(t)) return 'closing';
  return null;
}

/** «۳۹» / «٣٩» → 39. */
export function numeralValue(text: string): number {
  return Number(text.trim().replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 0x06f0)).replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 0x0660)));
}
