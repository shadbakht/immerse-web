/**
 * Builds a human-readable citation string for a passage.
 * Bible:  "The Bible, John 3:16"
 * Qur'an: "The Qur'an 3:16"
 * Other:  "Author, Book Title, Chapter Label, p.N"
 */
export function buildCitation(
  passage: { chapter_label?: string | null; section_title?: string | null; paragraph_number?: number | null } | null | undefined,
  book: { title?: string | null; citation_format?: string | null } | null | undefined,
  authorName?: string | null,
): string {
  const fmt = book?.citation_format ?? 'author_book_paragraph';

  if (fmt === 'bible') {
    const chapterNum = passage?.chapter_label?.match(/\d+/)?.[0] ?? '';
    const verse = passage?.paragraph_number ? String(passage.paragraph_number) : '';
    const loc = chapterNum && verse ? `${chapterNum}:${verse}` : chapterNum || verse;
    const bookPart = book?.title ? `${book.title}${loc ? ` ${loc}` : ''}` : loc;
    return bookPart ? `The Bible, ${bookPart}` : 'The Bible';
  }

  if (fmt === 'scripture_sura_verse') {
    const chapterNum = passage?.chapter_label?.match(/\d+/)?.[0] ?? '';
    const verse = passage?.paragraph_number ? String(passage.paragraph_number) : '';
    const loc = chapterNum && verse ? `${chapterNum}:${verse}` : chapterNum || verse;
    return `${book?.title ?? "The Qur'an"}${loc ? ` ${loc}` : ''}`;
  }

  return [
    authorName,
    book?.title,
    passage?.chapter_label || passage?.section_title,
    passage?.paragraph_number ? `p.${passage.paragraph_number}` : null,
  ].filter(Boolean).join(', ');
}
