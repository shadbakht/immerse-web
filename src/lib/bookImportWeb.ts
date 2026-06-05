/**
 * bookImportWeb.ts — Client-side file parsing + local IndexedDB persistence.
 *
 * Imported books are local-only, exactly like the mobile app's SQLite "My Books".
 * They are never uploaded to Supabase; annotations on them stay local too.
 *
 * Supported formats: TXT, EPUB, DOCX, RTF (parsed to paragraphs) and PDF
 * (stored as a Blob, displayed in an embedded PDF viewer).
 */

import JSZip from 'jszip';
import { saveLocalBook, deleteLocalBook } from './importedBooksDb';
import type { LocalBook } from './importedBooksDb';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ImportBookResult {
  success: boolean;
  title?:  string;
  bookId?: string;   // 'imported:{uuid}'
  error?:  string;
}

interface ParsedBook {
  title:      string;
  paragraphs: string[];
  format:     string;
  pdfBlob:    Blob | null;
}

// ─── Parsers ──────────────────────────────────────────────────────────────────

async function parseTxt(file: File): Promise<ParsedBook> {
  const text       = await file.text();
  const paragraphs = text.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  if (paragraphs.length === 0) throw new Error('No readable text found.');
  return { title: file.name.replace(/\.txt$/i, ''), paragraphs, format: 'txt', pdfBlob: null };
}

async function parseDocx(file: File): Promise<ParsedBook> {
  const ab  = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(ab);

  const docXml  = (await zip.file('word/document.xml')?.async('string')) ?? '';
  const coreXml = (await zip.file('docProps/core.xml')?.async('string')) ?? '';

  const titleMatch = coreXml.match(/<dc:title[^>]*>([^<]+)<\/dc:title>/);
  const title      = titleMatch?.[1]?.trim() ?? file.name.replace(/\.docx$/i, '');

  const paragraphs: string[] = [];
  for (const seg of docXml.split('</w:p>')) {
    const parts: string[] = [];
    for (const m of seg.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)) parts.push(m[1]);
    const text = parts.join('').trim();
    if (text.length > 0) paragraphs.push(text);
  }

  if (paragraphs.length === 0) throw new Error('No readable text found in this DOCX.');
  return { title, paragraphs, format: 'docx', pdfBlob: null };
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
  for (const m of opfXml.matchAll(/<item\s[^>]+>/g)) {
    const tag   = m[0];
    const id    = tag.match(/\bid="([^"]+)"/)?.[1];
    const href  = tag.match(/\bhref="([^"]+)"/)?.[1];
    const props = tag.match(/\bproperties="([^"]+)"/)?.[1] ?? '';
    const mt    = tag.match(/\bmedia-type="([^"]+)"/)?.[1] ?? '';
    if (id && href) {
      manifest[id] = href;
      if (props.split(/\s+/).includes('nav') || mt === 'application/x-dtbncx+xml') skipIds.add(id);
    }
  }

  const spineRefs: string[] = [];
  for (const m of opfXml.matchAll(/<itemref\b[^>]+>/g)) {
    const tag    = m[0];
    const idref  = tag.match(/\bidref="([^"]+)"/)?.[1];
    const linear = tag.match(/\blinear="([^"]+)"/)?.[1];
    if (idref && linear !== 'no' && !skipIds.has(idref)) spineRefs.push(idref);
  }

  const paragraphs: string[] = [];
  const parser = new DOMParser();

  for (const idref of spineRefs) {
    const href = manifest[idref];
    if (!href) continue;
    const decodedHref = decodeURIComponent(href);
    const raw =
      (await zip.file(opfDir + decodedHref)?.async('string')) ??
      (await zip.file(decodedHref)?.async('string')) ??
      (await zip.file(opfDir + href)?.async('string')) ??
      (await zip.file(href)?.async('string'));
    if (!raw) continue;

    const doc = parser.parseFromString(raw, 'text/html');
    doc.querySelectorAll('nav').forEach(el => el.remove());
    for (const el of doc.querySelectorAll('p, h1, h2, h3, h4, li')) {
      const text = el.textContent?.trim() ?? '';
      if (text.length > 0) paragraphs.push(text);
    }
  }

  if (paragraphs.length === 0) throw new Error('No readable text found in this EPUB.');
  return { title, paragraphs, format: 'epub', pdfBlob: null };
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
  return { title: file.name.replace(/\.rtf$/i, ''), paragraphs, format: 'rtf', pdfBlob: null };
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
      case 'pdf':
        parsed = { title: file.name.replace(/\.pdf$/i, ''), paragraphs: [], format: 'pdf', pdfBlob: file };
        break;
      default:
        return { success: false, error: `Unsupported format .${ext}. Use TXT, EPUB, DOCX, RTF, or PDF.` };
    }
  } catch (err: any) {
    return { success: false, error: err.message ?? 'Could not parse the file.' };
  }

  const id: string = crypto.randomUUID();
  const book: LocalBook = {
    id,
    title:      parsed.title,
    format:     parsed.format,
    paragraphs: parsed.paragraphs,
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
