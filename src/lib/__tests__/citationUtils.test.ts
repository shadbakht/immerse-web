/**
 * Citation rendering, pinned against REAL corpus rows.
 *
 * Every `passage`/`book` fixture below was read out of the live Supabase corpus
 * (project tgvhgaaaaeleemrzrftx) rather than invented, because the bug this
 * suite exists to prevent was caused entirely by assuming what the data looked
 * like. In particular: chapter_label's shape is decided per language, and two
 * of the seven put the book's own ordinal in front of the chapter number.
 *
 * See docs/architecture-audit-2026-08-23.md, Finding 1, in the mobile repo.
 */

import { buildCitation } from '../citationUtils';

// Locale is always passed explicitly: these assertions are about the FORMAT
// branch, and letting them read the browser's stored language would make them
// depend on test-runner environment.
const en = { locale: 'en' };

describe('buildCitation — Bible, both spellings', () => {
  // The whole point of the fix: 'bible' (en+es, 160 books) and
  // 'book_chapter_verse' (fa/fr/ru/tr/zh, 376 books) mean the same thing.
  // Web used to handle only the first, so 379 books cited as
  // "Author, Title, Chapter N, p.V".

  it('renders the en spelling', () => {
    expect(buildCitation(
      { chapter_label: 'Chapter 1', paragraph_number: 16 },
      { title: 'Deuteronomy', citation_format: 'bible' },
      'The Bible (KJV)', en,
    )).toBe('The Bible, Deuteronomy 1:16');
  });

  it('renders the fr spelling — was the 379-book bug', () => {
    expect(buildCitation(
      { chapter_label: 'Chapitre 1', paragraph_number: 1 },
      { title: 'Genèse', citation_format: 'book_chapter_verse' },
      'La Bible du Rabbinat (1899-1906)', en,
    )).toBe('The Bible, Genèse 1:1');
  });

  it('ignores the author even when one is supplied', () => {
    // A Bible's "author" is its edition ("La Bible Crampon (1923)"). It is not
    // part of the citation under the short-prefix style.
    expect(buildCitation(
      { chapter_label: 'Chapitre 3', paragraph_number: 16 },
      { title: 'Jean', citation_format: 'book_chapter_verse' },
      'La Bible Crampon (1923)', en,
    )).toBe('The Bible, Jean 3:16');
  });

  it('degrades to book + verse when chapter_label is null (en Apocrypha)', () => {
    // Ecclesiasticus, 1/2 Maccabees, Judith, Tobit … carry no chapter_label at
    // all: 6,176 rows across 15 books. Not made worse here, but pinned so a
    // future change notices them.
    expect(buildCitation(
      { chapter_label: null, paragraph_number: 12 },
      { title: 'Ecclesiasticus', citation_format: 'bible' },
      'The Bible (KJV)', en,
    )).toBe('The Bible, Ecclesiasticus 12');
  });
});

describe('buildCitation — chapter number extraction', () => {
  // The trap. fa and tr put the BOOK ordinal first; taking the first number
  // made every chapter of 1/2/3-numbered books cite as chapter 1, 2 or 3.

  it('fa: "1 تیموتاوس 6" is 1 Timothy chapter SIX, not chapter one', () => {
    expect(buildCitation(
      { chapter_label: '1 تیموتاوس 6', paragraph_number: 5 },
      { title: '1 تیموتاوس', citation_format: 'book_chapter_verse' },
      null, en,
    )).toBe('The Bible, 1 تیموتاوس 6:5');
  });

  it('tr: "1. KORİNTLİLER 3" is 1 Corinthians chapter THREE', () => {
    expect(buildCitation(
      { chapter_label: '1. KORİNTLİLER 3', paragraph_number: 9 },
      { title: '1. KORİNTLİLER', citation_format: 'book_chapter_verse' },
      null, en,
    )).toBe('The Bible, 1. KORİNTLİLER 3:9');
  });

  it('ru: "Бытие 1" — book name then chapter', () => {
    expect(buildCitation(
      { chapter_label: 'Бытие 1', paragraph_number: 1 },
      { title: 'Бытие', citation_format: 'book_chapter_verse' },
      null, en,
    )).toBe('The Bible, Бытие 1:1');
  });

  it('zh: "以弗所书 1" — book name then chapter', () => {
    expect(buildCitation(
      { chapter_label: '以弗所书 1', paragraph_number: 1 },
      { title: '以弗所书', citation_format: 'book_chapter_verse' },
      null, en,
    )).toBe('The Bible, 以弗所书 1:1');
  });

  it('falls back to the FIRST number when the label ends in prose', () => {
    // "Chapitre 18 — Yoga du renoncement et de la délivrance". A trailing-number
    // rule alone would find nothing here; a last-number-anywhere rule would
    // break on a section name that happens to contain a digit.
    expect(buildCitation(
      { chapter_label: 'Chapitre 18 — Yoga du renoncement et de la délivrance', paragraph_number: 83 },
      { title: 'Un livre', citation_format: 'book_chapter_verse' },
      null, en,
    )).toBe('The Bible, Un livre 18:83');
  });

  it('prefers the trailing number over a digit inside the section name', () => {
    expect(buildCitation(
      { chapter_label: 'Chapter 3 — The 12 Tribes', paragraph_number: 4 },
      { title: 'Numbers', citation_format: 'bible' },
      null, en,
    )).toBe('The Bible, Numbers 3:4');
  });
});

describe('buildCitation — translated collection labels', () => {
  // Branching stays on the format identifier; only the LABEL is translated.
  const passage = { chapter_label: 'Chapter 1', paragraph_number: 1 };
  const book = { title: 'Genesis', citation_format: 'bible' };

  it('fa renders the Persian name, not Latin-script "The Bible"', () => {
    expect(buildCitation(passage, book, null, { locale: 'fa' }))
      .toBe('کتاب مقدس, Genesis 1:1');
  });

  it('zh renders 圣经', () => {
    expect(buildCitation(passage, book, null, { locale: 'zh' }))
      .toBe('圣经, Genesis 1:1');
  });

  it('falls back to English for an unknown locale', () => {
    expect(buildCitation(passage, book, null, { locale: 'zz' }))
      .toBe('The Bible, Genesis 1:1');
  });
});

describe('buildCitation — other formats', () => {
  it('tanakh cites by the English name inside the parens', () => {
    expect(buildCitation(
      { chapter_label: 'Chapter 2', paragraph_number: 9 },
      { title: 'Yisheya (Isaiah)', citation_format: 'tanakh' },
      'Neviim (Prophets)', en,
    )).toBe('Tanakh, Isaiah 2:9');
  });

  it("qur'an cites by collection, not by the edition title", () => {
    // ru's book.title is "Коран (Саблуков)" — the edition, not a sura.
    expect(buildCitation(
      { chapter_label: 'Сура 2 — Корова', paragraph_number: 33 },
      { title: 'Коран (Саблуков)', citation_format: 'scripture_sura_verse' },
      'Коран (Саблуков)', en,
    )).toBe('The Qur’an 2:33');
  });

  it('guru granth sahib cites by Ang', () => {
    expect(buildCitation(
      { chapter_label: null, paragraph_number: 1118 },
      { title: 'Section 27 - Raag Kaydaaraa', citation_format: 'numbered_sections' },
      'Sikh', en,
    )).toBe('Guru Granth Sahib, Ang 1118');
  });

  it('hidden words cites section + native number', () => {
    expect(buildCitation(
      { chapter_label: 'Persian', paragraph_number: 44 },
      { title: 'The Hidden Words', citation_format: 'author_book_section_native_number' },
      "Bahá'u'lláh", en,
    )).toBe("Bahá'u'lláh, The Hidden Words, Persian 44");
  });

  it('nahj al-balagha cites by item label', () => {
    expect(buildCitation(
      { chapter_label: 'خطبه 1', paragraph_number: 10 },
      { title: 'نهج البلاغه (ترجمهٔ فیض الاسلام)', citation_format: 'nahj_albalagha_fa' },
      'امام علی (ع)', en,
    )).toBe('نهج البلاغه، خطبه 1، p.10');
  });

  it('imported books cite title only', () => {
    // Previously fell through to the default and printed the author + "p.1".
    expect(buildCitation(
      { chapter_label: null, paragraph_number: 1 },
      { title: 'My Notes.pdf', citation_format: 'book_only' },
      null, en,
    )).toBe('My Notes.pdf');
  });

  it('default branch: author, title, chapter, subchapter, paragraph', () => {
    expect(buildCitation(
      { chapter_label: 'UMUMİ ADALET EVİ', section_title: null, paragraph_number: 1 },
      { title: 'Birey Ve Duyuru', citation_format: 'author_book_chapter_section_paragraph' },
      'Derlemeler', en,
    )).toBe('Derlemeler, Birey Ve Duyuru, UMUMİ ADALET EVİ, p.1');
  });

  it('default branch does not double-print a redundant section_title', () => {
    expect(buildCitation(
      { chapter_label: 'General Prayers, Teaching', section_title: 'Teaching', paragraph_number: 3 },
      { title: "Bahá'í Prayers", citation_format: 'author_book_chapter_section_paragraph' },
      "Bahá'u'lláh", en,
    )).toBe("Bahá'u'lláh, Bahá'í Prayers, General Prayers, Teaching, p.3");
  });
});

describe('buildCitation — degenerate input', () => {
  it('survives a null passage and null book', () => {
    expect(buildCitation(null, null, null, en)).toBe('');
  });

  it('survives an unknown citation_format', () => {
    expect(buildCitation(
      { chapter_label: 'Tablet I', paragraph_number: 12 },
      { title: 'The Enuma Elish', citation_format: 'some_future_format' },
      'Ancient', en,
    )).toBe('Ancient, The Enuma Elish, Tablet I, p.12');
  });
});
