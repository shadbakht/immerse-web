import { translate, type TranslationKey } from '@immerse/i18n';
import { getStoredUiLanguage } from './language';

/**
 * Builds a human-readable citation string for a passage.
 * Bible:  "The Bible, John 3:16"
 * Qur'an: "The Qur'an 3:16"
 * Other:  "Author, Book Title, Chapter Label, p.N"
 *
 * ⚠️ `citation_format` is free text with no CHECK constraint, and the corpus
 * currently holds FOURTEEN distinct values. This file and mobile's
 * src/utils/citation.ts were each written against the subset visible from their
 * own side of the wall, which is how 379 books ended up citing wrong here — see
 * docs/architecture-audit-2026-08-23.md, Finding 1, in the mobile repo.
 *
 * Two spellings mean the same thing and BOTH must be handled:
 *   'bible'              — en (87) + es (73), written by the old per-shelf sync scripts
 *   'book_chapter_verse' — fa/fr/ru/tr/zh (376), written by the shared webSync engine
 * The split is historical, not semantic (scripts/lib/webSync.mjs:158-166 in the
 * mobile repo documents where it came from). Do not "tidy" one away without
 * migrating the rows; ensureBook leaves an existing row's format alone.
 */

// ─── Collection labels ────────────────────────────────────────────────────────

/**
 * The short name a scripture is cited under ("The Bible, Genesis 3:16").
 *
 * Translated, so a Persian reader gets کتاب مقدس inside an RTL citation rather
 * than Latin-script "The Bible". The BRANCH is always on the format identifier
 * below — never on the translated string, which would break the moment the UI
 * language changed.
 */
// Callers pass the i18n key directly rather than a short alias: the repo's
// hardcoded-string check is line-based and reads a bare 'bible' as untranslated
// UI text, where a dotted key is recognised for what it is.
type CollectionKey =
  | 'citation.bible' | 'citation.tanakh' | 'citation.quran' | 'citation.guruGranthSahib';

// ─── Chapter-number extraction ────────────────────────────────────────────────

/**
 * The chapter number inside a chapter_label.
 *
 * The label's shape is decided per LANGUAGE by whichever ingester wrote it, and
 * the two conventions in the corpus disagree about where the number lives:
 *
 *   "Chapter 1" / "Chapitre 12" / "Capítulo 3" / "Psalm 99"   en, es, fr
 *   "Бытие 1" / "以弗所书 1" / "1 تیموتاوس 6" / "1. KORİNTLİLER 3"   ru, zh, fa, tr
 *
 * The second form puts the BOOK's own ordinal first, so taking the first number
 * — which both platforms used to do — reads "1 تیموتاوس 6" (1 Timothy ch. 6) as
 * chapter 1, and every chapter of every numbered Persian and Turkish book cites
 * as 1, 2 or 3. Measured: 66 fa books and 66 tr books are affected.
 *
 * Taking the LAST number fixes those, but breaks a label whose section name
 * happens to end in a digit. So: prefer a number the label ENDS on (that is
 * always the chapter in both conventions), and otherwise fall back to the first
 * — which is correct for the "Chapitre 18 — Yoga du renoncement" shape, where
 * the chapter leads and prose follows.
 */
function chapterNumberFrom(label: string | null | undefined): string {
  if (!label) return '';
  const trailing = label.match(/(\d+)\s*$/);
  if (trailing) return trailing[1];
  return label.match(/\d+/)?.[0] ?? '';
}

/** "3" + "16" → "3:16"; either alone → that one; neither → "". */
function chapterVerseRef(
  chapterLabel: string | null | undefined,
  paragraphNumber: number | null | undefined,
): string {
  const chapter = chapterNumberFrom(chapterLabel);
  const verse = paragraphNumber ? String(paragraphNumber) : '';
  if (chapter && verse) return `${chapter}:${verse}`;
  return chapter || verse;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface CitationPassage {
  chapter_label?: string | null;
  section_title?: string | null;
  paragraph_number?: number | null;
}

export interface CitationBook {
  title?: string | null;
  citation_format?: string | null;
}

export interface CitationOptions {
  /**
   * UI language for the collection label. Defaults to the browser's stored
   * choice. Passed explicitly by tests, and by any caller that runs before
   * localStorage is readable.
   */
  locale?: string;
}

export function buildCitation(
  passage: CitationPassage | null | undefined,
  book: CitationBook | null | undefined,
  authorName?: string | null,
  opts?: CitationOptions,
): string {
  const fmt = book?.citation_format ?? 'author_book_paragraph';
  const locale = opts?.locale ?? getStoredUiLanguage();
  const label = (key: CollectionKey) => translate(locale, key as TranslationKey);

  // ── Bible ──────────────────────────────────────────────────────────────────
  // Both spellings, deliberately. See the file header.
  if (fmt === 'bible' || fmt === 'book_chapter_verse') {
    const loc = chapterVerseRef(passage?.chapter_label, passage?.paragraph_number);
    const bookPart = book?.title ? `${book.title}${loc ? ` ${loc}` : ''}` : loc;
    return bookPart ? `${label('citation.bible')}, ${bookPart}` : label('citation.bible');
  }

  // ── Tanakh ─────────────────────────────────────────────────────────────────
  if (fmt === 'tanakh') {
    const loc = chapterVerseRef(passage?.chapter_label, passage?.paragraph_number);
    // Book titles are "Hebrew (English)" (e.g. "Bereishit (Genesis)"); cite by
    // the English name to match the mobile app: "Tanakh, Genesis 3:16".
    const title = book?.title ? (book.title.match(/\(([^)]+)\)\s*$/)?.[1] ?? book.title) : '';
    const bookPart = title ? `${title}${loc ? ` ${loc}` : ''}` : loc;
    return bookPart ? `${label('citation.tanakh')}, ${bookPart}` : label('citation.tanakh');
  }

  // ── Qur'an ─────────────────────────────────────────────────────────────────
  // Cited by the collection name, not by book.title: the whole Qur'an is one
  // book per language, so the title is the edition ("Коран (Саблуков)") rather
  // than a sura name, and printing it would read "Коран (Саблуков) 2:33".
  if (fmt === 'scripture_sura_verse') {
    const loc = chapterVerseRef(passage?.chapter_label, passage?.paragraph_number);
    return `${label('citation.quran')}${loc ? ` ${loc}` : ''}`;
  }

  // ── Guru Granth Sahib ──────────────────────────────────────────────────────
  // paragraph_number == Ang (SGGS page). Cite by Ang, the canonical reference.
  if (fmt === 'numbered_sections') {
    return passage?.paragraph_number
      ? `${label('citation.guruGranthSahib')}, Ang ${passage.paragraph_number}`
      : label('citation.guruGranthSahib');
  }

  // ── The Hidden Words ───────────────────────────────────────────────────────
  // section (Arabic/Persian) in chapter_label, native number in
  // paragraph_number. e.g. "Bahá'u'lláh, The Hidden Words, Persian 44".
  if (fmt === 'author_book_section_native_number') {
    const loc = [passage?.chapter_label, passage?.paragraph_number]
      .filter(v => v != null && v !== '').join(' ');
    return [authorName, book?.title, loc].filter(Boolean).join(', ');
  }

  // ── Nahj al-Balagha (fa) ───────────────────────────────────────────────────
  // Cite by item label (خطبه/نامه/حکمت N), not by a category-name author — the
  // same reason the Qur'an skips it. Mirrors mobile's citation.ts.
  if (fmt === 'nahj_albalagha_fa') {
    const parts = ['نهج البلاغه', passage?.chapter_label,
      passage?.paragraph_number ? `p.${passage.paragraph_number}` : null];
    return parts.filter(Boolean).join('، ');
  }

  // ── Imported books ─────────────────────────────────────────────────────────
  // Just the title: a user's own upload has no author or paragraph numbering
  // worth citing. Mobile has always done this; web used to fall through to the
  // default and print "undefined, My Notes.pdf, p.1".
  if (fmt === 'book_only') {
    return book?.title ?? '';
  }

  // ── Default ────────────────────────────────────────────────────────────────
  // chapter_label and section_title are independent fields (chapter vs.
  // subchapter, e.g. "Part Two: Letters from Shoghi Effendi" + "January 29th,
  // 1925") — include both when present rather than picking one. Bahá'í
  // Prayers is the one book whose chapter_label already bakes in the
  // subchapter as a comma-joined string ("General Prayers, Teaching") — for
  // the handful of its rows that also carry a redundant section_title, skip
  // it rather than double-print the same subchapter.
  //
  // ⚠️ This branch still differs from mobile's for the formats that reach it:
  // mobile gates the chapter label on `citationFormat.includes('chapter')`, so
  // it drops the chapter for book_paragraph (173 books), author_book_paragraph
  // (118), gathas, scripture_ha_verse and book_section_verse, where this keeps
  // it. Deliberately left alone here — reconciling the default branch belongs
  // with the shared renderer (audit Finding 2), not with the Bible fix.
  const subLabel = passage?.section_title && !passage?.chapter_label?.includes(passage.section_title)
    ? passage.section_title
    : null;
  return [
    authorName,
    book?.title,
    passage?.chapter_label,
    subLabel,
    passage?.paragraph_number ? `p.${passage.paragraph_number}` : null,
  ].filter(Boolean).join(', ');
}
