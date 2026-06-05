/**
 * bookImportWeb.ts — Client-side file parsing + Supabase persistence for
 * user-imported books on the web.
 *
 * Supported formats: TXT, DOCX, EPUB, RTF → parsed to paragraphs, stored as
 * passages in Supabase (books + passages tables, is_user_imported=true).
 * PDF → uploaded to the 'user-imports' storage bucket, no passages.
 */

import JSZip from 'jszip';
import type { SupabaseClient } from '@supabase/supabase-js';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ParsedBook {
  title: string;
  paragraphs: string[];
  sourceFormat: string;
  isPdf: boolean;
}

export interface ImportBookResult {
  success: boolean;
  title?: string;
  bookId?: string;
  error?: string;
}

// ─── Parsers ──────────────────────────────────────────────────────────────────

async function parseTxt(file: File): Promise<ParsedBook> {
  const text = await file.text();
  const paragraphs = text.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  if (paragraphs.length === 0) throw new Error('No readable text found.');
  return { title: file.name.replace(/\.txt$/i, ''), paragraphs, sourceFormat: 'txt', isPdf: false };
}

async function parseDocx(file: File): Promise<ParsedBook> {
  const ab = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(ab);

  const docXml  = (await zip.file('word/document.xml')?.async('string')) ?? '';
  const coreXml = (await zip.file('docProps/core.xml')?.async('string')) ?? '';

  const titleMatch = coreXml.match(/<dc:title[^>]*>([^<]+)<\/dc:title>/);
  const title = titleMatch?.[1]?.trim() ?? file.name.replace(/\.docx$/i, '');

  const paragraphs: string[] = [];
  for (const seg of docXml.split('</w:p>')) {
    const parts: string[] = [];
    for (const m of seg.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)) parts.push(m[1]);
    const text = parts.join('').trim();
    if (text.length > 0) paragraphs.push(text);
  }

  if (paragraphs.length === 0) throw new Error('No readable text found in this DOCX.');
  return { title, paragraphs, sourceFormat: 'docx', isPdf: false };
}

async function parseEpub(file: File): Promise<ParsedBook> {
  const ab = await file.arrayBuffer();
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
  return { title, paragraphs, sourceFormat: 'epub', isPdf: false };
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
  const text = await file.text();
  const plain = stripRtf(text);
  const paragraphs = plain.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  if (paragraphs.length === 0) throw new Error('No readable text found in this RTF.');
  return { title: file.name.replace(/\.rtf$/i, ''), paragraphs, sourceFormat: 'rtf', isPdf: false };
}

// ─── Main import ──────────────────────────────────────────────────────────────

const PASSAGE_BATCH = 200;

/**
 * Parse the file client-side and persist it to Supabase as a user-owned book.
 * Text formats → stored as passages. PDF → uploaded to storage bucket.
 */
export async function importBook(
  file: File,
  userId: string,
  supabase: SupabaseClient,
): Promise<ImportBookResult> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';

  let parsed: ParsedBook;
  try {
    switch (ext) {
      case 'txt':  parsed = await parseTxt(file);  break;
      case 'docx': parsed = await parseDocx(file); break;
      case 'epub': parsed = await parseEpub(file); break;
      case 'rtf':  parsed = await parseRtf(file);  break;
      case 'pdf':
        parsed = { title: file.name.replace(/\.pdf$/i, ''), paragraphs: [], sourceFormat: 'pdf', isPdf: true };
        break;
      default:
        return { success: false, error: `Unsupported format .${ext}. Use TXT, EPUB, DOCX, RTF, or PDF.` };
    }
  } catch (err: any) {
    return { success: false, error: err.message ?? 'Could not parse the file.' };
  }

  const bookId = crypto.randomUUID();

  // Insert book record (author_id left null — allowed after migration)
  const { error: bookErr } = await supabase.from('books').insert({
    id:               bookId,
    title:            parsed.title,
    is_user_imported: true,
    user_id:          userId,
    is_active:        true,
    citation_format:  'book_only',
    language:         'English',
    sort_order:       9999,
  });
  if (bookErr) {
    console.error('[importBook] book insert:', bookErr);
    return { success: false, error: 'Failed to save book.' };
  }

  // Insert passages in batches (text formats only)
  for (let i = 0; i < parsed.paragraphs.length; i += PASSAGE_BATCH) {
    const batch = parsed.paragraphs.slice(i, i + PASSAGE_BATCH).map((content, j) => ({
      book_id:   bookId,
      reference: '',
      content,
      sort_order: i + j,
    }));
    const { error: passErr } = await supabase.from('passages').insert(batch);
    if (passErr) {
      console.error('[importBook] passages insert:', passErr);
      await supabase.from('books').delete().eq('id', bookId).eq('user_id', userId);
      return { success: false, error: 'Failed to save passages.' };
    }
  }

  // Upload PDF to storage bucket
  let storagePath: string | null = null;
  if (parsed.isPdf) {
    const path = `${userId}/${bookId}.pdf`;
    const { error: uploadErr } = await supabase.storage
      .from('user-imports')
      .upload(path, file, { contentType: 'application/pdf' });
    if (uploadErr) {
      console.error('[importBook] PDF upload:', uploadErr);
      await supabase.from('books').delete().eq('id', bookId).eq('user_id', userId);
      return { success: false, error: 'Failed to upload PDF.' };
    }
    storagePath = path;
  }

  // Track in user_imported_books (non-fatal if this fails)
  await supabase.from('user_imported_books').insert({
    user_id:           userId,
    book_id:           bookId,
    original_filename: file.name,
    storage_path:      storagePath,
    status:            'complete',
  });

  return { success: true, title: parsed.title, bookId };
}

// ─── Delete ───────────────────────────────────────────────────────────────────

/**
 * Delete a user-imported book and all its dependent data in the correct order
 * to satisfy FK constraints without requiring CASCADE in the schema.
 */
export async function deleteImportedBook(
  bookId: string,
  userId: string,
  supabase: SupabaseClient,
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Get PDF storage path if present
    const { data: trackRow } = await supabase
      .from('user_imported_books')
      .select('storage_path')
      .eq('book_id', bookId)
      .eq('user_id', userId)
      .maybeSingle();

    // 2. Remove PDF from storage
    if (trackRow?.storage_path) {
      await supabase.storage.from('user-imports').remove([trackRow.storage_path]);
    }

    // 3. Collect passage IDs to unblock downstream FKs
    const { data: passageRows } = await supabase
      .from('passages')
      .select('id')
      .eq('book_id', bookId);
    const passageIds = (passageRows ?? []).map(p => p.id as string);

    // 4. Clean up selections and their dependents
    if (passageIds.length > 0) {
      const { data: selRows } = await supabase
        .from('selections')
        .select('id')
        .in('passage_id', passageIds);
      const selIds = (selRows ?? []).map(s => s.id as string);

      if (selIds.length > 0) {
        await supabase.from('xrefs').delete().in('selection_a_id', selIds);
        await supabase.from('xrefs').delete().in('selection_b_id', selIds);
        await supabase.from('notes').delete().in('selection_id', selIds);
        await supabase.from('selection_tags').delete().in('selection_id', selIds);
        await supabase.from('selections').delete().in('id', selIds);
      }

      await supabase.from('passages').delete().eq('book_id', bookId);
    }

    // 5. Delete reading progress
    await supabase.from('reading_progress').delete().eq('book_id', bookId);

    // 6. Delete tracking row
    await supabase.from('user_imported_books').delete().eq('book_id', bookId).eq('user_id', userId);

    // 7. Delete book
    const { error } = await supabase.from('books').delete().eq('id', bookId).eq('user_id', userId);
    if (error) return { success: false, error: 'Failed to delete book.' };

    return { success: true };
  } catch (err: any) {
    console.error('[deleteImportedBook]', err);
    return { success: false, error: err.message ?? 'Delete failed.' };
  }
}
