/**
 * bookImportWeb.ts — Client-side file parsing + local IndexedDB persistence.
 *
 * Imported books are local-only, exactly like the mobile app's SQLite "My Books".
 * They are never uploaded to Supabase; annotations on them stay local too.
 *
 * Supported formats: TXT, EPUB, DOCX, RTF (parsed to paragraphs, chapter
 * boundaries detected where possible — see `detectTxtChapters` /
 * DOCX heading styles / EPUB spine+nav, mirroring mobile's
 * src/utils/bookImport.ts) and PDF — pdf.js text extraction first
 * (see pdfExtractWeb.ts), reflowed into paragraphs like DOCX/EPUB for a
 * text-based PDF; a scanned/image PDF with no extractable text falls back to
 * the raw Blob in an embedded, view-only PDF viewer.
 */

import JSZip from 'jszip';
import { saveLocalBook, deleteLocalBook } from './importedBooksDb';
import type { LocalBook } from './importedBooksDb';
import { extractPdfText } from './pdfExtractWeb';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ImportBookResult {
  success: boolean;
  title?:  string;
  bookId?: string;   // 'imported:{uuid}'
  error?:  string;
}

interface ParsedChapter {
  label:      string | null;
  paragraphs: string[];
}

interface ParsedBook {
  title:    string;
  chapters: ParsedChapter[];   // empty only for PDFs (stored as a Blob instead)
  format:   string;
  pdfBlob:  Blob | null;
}

// ─── Chapter detection (mirrors mobile's src/utils/bookImport.ts) ────────────

const NUMBER_WORDS = [
  'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen',
  'eighteen', 'nineteen', 'twenty',
];
const CHAPTER_MARKER_RX = new RegExp(
  `^(?:chapter|part|book|section|volume)\\s+(?:\\d+|[ivxlcdm]+|${NUMBER_WORDS.join('|')})\\b`,
  'i',
);

/**
 * Best-effort chapter-boundary detection for unstructured plain text (TXT and
 * RTF, which reduce to the same paragraph-array shape). Conservative on
 * purpose: a paragraph counts as a chapter marker only when it's short,
 * single-line, and matches an explicit "Chapter N" / "Part N" / "Book N"
 * opener. Zero matches → the whole text stays one unlabeled chapter, same as
 * before chapter detection existed.
 */
function detectTxtChapters(paragraphs: string[]): ParsedChapter[] {
  const isMarker = (p: string) => !p.includes('\n') && p.length <= 80 && CHAPTER_MARKER_RX.test(p);
  if (!paragraphs.some(isMarker)) {
    return [{ label: null, paragraphs }];
  }
  const chapters: ParsedChapter[] = [];
  let current: string[] = [];
  let currentLabel: string | null = null;
  let started = false;
  for (const p of paragraphs) {
    if (isMarker(p)) {
      if (started || current.length > 0) chapters.push({ label: currentLabel, paragraphs: current });
      current = [];
      currentLabel = p;
      started = true;
    } else {
      current.push(p);
    }
  }
  chapters.push({ label: currentLabel, paragraphs: current });
  return chapters.filter(c => c.paragraphs.length > 0 || c.label);
}

/** Flatten chapters into IndexedDB's storage shape: a flat paragraph array
 * plus the index each labeled chapter starts at. Keeps the existing
 * `local-{id}-{i}` passage-id scheme (search + scroll-to both key on flat
 * index) untouched — only the reader needs to know where chapters begin. */
function flattenChapters(chapters: ParsedChapter[]): {
  paragraphs: string[];
  chapterStarts: { index: number; label: string }[];
} {
  const paragraphs: string[] = [];
  const chapterStarts: { index: number; label: string }[] = [];
  for (const ch of chapters) {
    if (ch.label) chapterStarts.push({ index: paragraphs.length, label: ch.label });
    paragraphs.push(...ch.paragraphs);
  }
  return { paragraphs, chapterStarts };
}

// ─── Parsers ──────────────────────────────────────────────────────────────────

async function parseTxt(file: File): Promise<ParsedBook> {
  const text       = await file.text();
  const paragraphs = text.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  if (paragraphs.length === 0) throw new Error('No readable text found.');
  return { title: file.name.replace(/\.txt$/i, ''), chapters: detectTxtChapters(paragraphs), format: 'txt', pdfBlob: null };
}

const DOCX_HEADING_STYLE_RX = /<w:pStyle\s+w:val="(Heading[1-9]\d*|Title)"/i;

async function parseDocx(file: File): Promise<ParsedBook> {
  const ab  = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(ab);

  const docXml  = (await zip.file('word/document.xml')?.async('string')) ?? '';
  const coreXml = (await zip.file('docProps/core.xml')?.async('string')) ?? '';

  const titleMatch = coreXml.match(/<dc:title[^>]*>([^<]+)<\/dc:title>/);
  const title      = titleMatch?.[1]?.trim() ?? file.name.replace(/\.docx$/i, '');

  // A segment whose <w:pPr> declares a "HeadingN"/"Title" style starts a new
  // chapter — the standard signal Word applies when a user picks a heading
  // style from the styles panel.
  const chapters: ParsedChapter[] = [];
  let current: string[] = [];
  let currentLabel: string | null = null;
  let sawHeading = false;
  for (const seg of docXml.split('</w:p>')) {
    const parts: string[] = [];
    for (const m of seg.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)) parts.push(m[1]);
    const text = parts.join('').trim();
    if (text.length === 0) continue;
    if (DOCX_HEADING_STYLE_RX.test(seg)) {
      if (sawHeading || current.length > 0) chapters.push({ label: currentLabel, paragraphs: current });
      current = [];
      currentLabel = text;
      sawHeading = true;
    } else {
      current.push(text);
    }
  }
  if (sawHeading || current.length > 0) chapters.push({ label: currentLabel, paragraphs: current });

  if (chapters.length === 0) throw new Error('No readable text found in this DOCX.');
  return { title, chapters, format: 'docx', pdfBlob: null };
}

async function parseEpub(file: File): Promise<ParsedBook> {
  const ab  = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(ab);

  const containerXml = (await zip.file('META-INF/container.xml')?.async('string')) ?? '';
  const opfPathMatch = containerXml.match(/full-path="([^"]+\.opf)"/);
  if (!opfPathMatch) throw new Error('Invalid EPUB: no OPF found');
  const opfPath = opfPathMatch[1];
  const opfDir  = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1) : '';
  const opfXml  = (await zip.file(opfPath)?.async('string')) ?? '';

  const titleMatch = opfXml.match(/<dc:title[^>]*>([^<]+)<\/dc:title>/);
  const title = titleMatch?.[1]?.trim() ?? file.name.replace(/\.epub$/i, '');

  const manifest: Record<string, string> = {};
  const skipIds = new Set<string>();
  let navHref: string | null = null;
  let ncxHref: string | null = null;
  for (const m of opfXml.matchAll(/<item\s[^>]+>/g)) {
    const tag   = m[0];
    const id    = tag.match(/\bid="([^"]+)"/)?.[1];
    const href  = tag.match(/\bhref="([^"]+)"/)?.[1];
    const props = tag.match(/\bproperties="([^"]+)"/)?.[1] ?? '';
    const mt    = tag.match(/\bmedia-type="([^"]+)"/)?.[1] ?? '';
    if (id && href) {
      manifest[id] = href;
      if (props.split(/\s+/).includes('nav')) { skipIds.add(id); navHref = href; }
      if (mt === 'application/x-dtbncx+xml') { skipIds.add(id); ncxHref = href; }
    }
  }

  const spineRefs: string[] = [];
  for (const m of opfXml.matchAll(/<itemref\b[^>]+>/g)) {
    const tag    = m[0];
    const idref  = tag.match(/\bidref="([^"]+)"/)?.[1];
    const linear = tag.match(/\blinear="([^"]+)"/)?.[1];
    if (idref && linear !== 'no' && !skipIds.has(idref)) spineRefs.push(idref);
  }

  // Best-effort href → chapter-title map from the book's own nav/NCX, so
  // chapter labels match its real table of contents when it has one.
  async function readZipEntry(dir: string, href: string): Promise<string | null> {
    const decoded = decodeURIComponent(href);
    return (
      (await zip.file(dir + decoded)?.async('string')) ??
      (await zip.file(decoded)?.async('string')) ??
      (await zip.file(dir + href)?.async('string')) ??
      (await zip.file(href)?.async('string')) ??
      null
    );
  }
  const navTitleMap: Record<string, string> = {};
  if (navHref) {
    const raw = await readZipEntry(opfDir, navHref);
    if (raw) {
      for (const m of raw.matchAll(/<a\s[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)) {
        const href = decodeURIComponent(m[1].split('#')[0]);
        const text = m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        if (href && text && !navTitleMap[href]) navTitleMap[href] = text;
      }
    }
  }
  if (Object.keys(navTitleMap).length === 0 && ncxHref) {
    const raw = await readZipEntry(opfDir, ncxHref);
    if (raw) {
      for (const m of raw.matchAll(/<navPoint\b[\s\S]*?<\/navPoint>/g)) {
        const block = m[0];
        const text  = block.match(/<text>([^<]*)<\/text>/)?.[1]?.trim();
        const src   = block.match(/<content\s[^>]*src="([^"]+)"/)?.[1];
        if (text && src) {
          const href = decodeURIComponent(src.split('#')[0]);
          if (!navTitleMap[href]) navTitleMap[href] = text;
        }
      }
    }
  }

  const chapters: ParsedChapter[] = [];
  const parser = new DOMParser();
  let chapterIndex = 0;

  for (const idref of spineRefs) {
    const href = manifest[idref];
    if (!href) continue;
    const decodedHref = decodeURIComponent(href);
    const raw = await readZipEntry(opfDir, href);
    if (!raw) continue;

    const doc = parser.parseFromString(raw, 'text/html');
    doc.querySelectorAll('nav').forEach(el => el.remove());

    const fileParas: string[] = [];
    let firstHeadingText: string | null = null;
    let seenHeading = false;
    for (const el of doc.querySelectorAll('p, h1, h2, h3, h4, li')) {
      const text = el.textContent?.trim() ?? '';
      if (text.length === 0) continue;
      if (!seenHeading && /^h[1-4]$/i.test(el.tagName)) {
        // The file's own first heading becomes the chapter label, not a body
        // paragraph — avoids showing the title twice (as heading + as text).
        firstHeadingText = text;
        seenHeading = true;
        continue;
      }
      fileParas.push(text);
    }
    if (fileParas.length === 0 && !firstHeadingText) continue;

    chapterIndex++;
    const navTitle = navTitleMap[decodedHref] ?? navTitleMap[href];
    const label = navTitle ?? firstHeadingText ?? (spineRefs.length > 1 ? `Chapter ${chapterIndex}` : null);
    chapters.push({ label, paragraphs: fileParas });
  }

  if (chapters.length === 0) throw new Error('No readable text found in this EPUB.');
  return { title, chapters, format: 'epub', pdfBlob: null };
}

function stripRtf(rtf: string): string {
  // Discard ignorable destinations: {\*\...}
  let s = '';
  let i = 0;
  while (i < rtf.length) {
    if (rtf[i] === '{' && rtf.slice(i, i + 3) === '{\\*') {
      let depth = 1;
      i += 3;
      while (i < rtf.length && depth > 0) {
        if (rtf[i] === '{') depth++;
        else if (rtf[i] === '}') depth--;
        i++;
      }
    } else {
      s += rtf[i++];
    }
  }
  s = s
    .replace(/\\pard?\b\*?\s*/g, '\n\n')
    .replace(/\\line\b\s*/g,      '\n');
  s = s.replace(/\\u(-?\d+)\??[ ]?/g, (_, n) => {
    const code = parseInt(n, 10);
    try { return code > 0 ? String.fromCodePoint(code) : ''; } catch { return ''; }
  });
  s = s.replace(/\\'([0-9a-fA-F]{2})/g, (_, hex) => {
    try { return String.fromCharCode(parseInt(hex, 16)); } catch { return ''; }
  });
  s = s
    .replace(/\\[a-z]+(-?\d+)? ?/gi, '')
    .replace(/\\./g, '');
  s = s
    .replace(/[{}]/g, '')
    .replace(/\r\n|\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return s;
}

async function parseRtf(file: File): Promise<ParsedBook> {
  const text       = await file.text();
  const plain      = stripRtf(text);
  const paragraphs = plain.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  if (paragraphs.length === 0) throw new Error('No readable text found in this RTF.');
  return { title: file.name.replace(/\.rtf$/i, ''), chapters: detectTxtChapters(paragraphs), format: 'rtf', pdfBlob: null };
}

/**
 * Try pdf.js text extraction first (text-based PDFs become reflowed
 * paragraphs, annotatable like DOCX/EPUB — matches mobile's parsePdf in
 * src/utils/bookImport.ts). Falls back to the raw file as a view-only Blob
 * for scanned/image PDFs (no extractable text) or on any extraction error.
 * The threshold guards against scans that yield only a few stray glyphs.
 */
async function parsePdf(file: File): Promise<ParsedBook> {
  const title = file.name.replace(/\.pdf$/i, '');
  const paragraphs = await extractPdfText(file);
  const cleaned = paragraphs.map(p => p.trim()).filter(Boolean);
  const textChars = cleaned.join('').replace(/\s/g, '').length;
  if (cleaned.length > 0 && textChars >= 200) {
    // PDFs carry no reliable chapter markup (no headings, no styles) — one
    // chapter for now, same as TXT/DOCX/EPUB before chapter detection existed.
    return { title, chapters: [{ label: null, paragraphs: cleaned }], format: 'pdf-text', pdfBlob: null };
  }
  return { title, chapters: [], format: 'pdf', pdfBlob: file };
}

// ─── Main import ──────────────────────────────────────────────────────────────

/**
 * Parse the file client-side and store it in IndexedDB.
 * Returns a bookId in the form 'imported:{uuid}' that the reader understands.
 */
export async function importBook(file: File): Promise<ImportBookResult> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';

  let parsed: ParsedBook;
  try {
    switch (ext) {
      case 'txt':  parsed = await parseTxt(file);  break;
      case 'docx': parsed = await parseDocx(file); break;
      case 'epub': parsed = await parseEpub(file); break;
      case 'rtf':  parsed = await parseRtf(file);  break;
      case 'pdf':  parsed = await parsePdf(file);  break;
      default:
        return { success: false, error: `Unsupported format .${ext}. Use TXT, EPUB, DOCX, RTF, or PDF.` };
    }
  } catch (err: any) {
    return { success: false, error: err.message ?? 'Could not parse the file.' };
  }

  const { paragraphs, chapterStarts } = flattenChapters(parsed.chapters);

  const id: string = crypto.randomUUID();
  const book: LocalBook = {
    id,
    title:      parsed.title,
    format:     parsed.format,
    paragraphs,
    chapterStarts,
    pdfBlob:    parsed.pdfBlob,
    createdAt:  Date.now(),
  };

  try {
    await saveLocalBook(book);
  } catch (err: any) {
    console.error('[importBook] IndexedDB save error:', err);
    return { success: false, error: 'Failed to save the book locally.' };
  }

  return { success: true, title: parsed.title, bookId: `imported:${id}` };
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export async function removeImportedBook(bookId: string): Promise<void> {
  const id = bookId.startsWith('imported:') ? bookId.slice('imported:'.length) : bookId;
  await deleteLocalBook(id);
}
