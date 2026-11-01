'use client';

// Export selected notes to DOCX, PDF, CSV, or Markdown, and build the snapshot
// a note share link (shared_sets kind='notes') stores. Each note renders as its
// quote with the citation and the user's note underneath, grouped by book.
// The share payload shape (`NoteShareEntry`) is mirrored in the mobile app's
// `src/utils/noteExport.ts` — keep the two in step.

import {
  AlignmentType, BorderStyle, Document, Footer, Packer, Paragraph, TextRun,
} from 'docx';
import { exportTranslator } from './tagExport';
import {
  escapeHtml, citationInParens, citationBare, csvField, triggerDownload, safeFilename, depthHeading,
  DOC_PRIMARY, DOC_BODY, DOC_MUTED, DOC_FAINT, DOC_DIVIDER,
} from './exportShared';
import { groupNotesByBook, type NoteShareEntry } from './noteShare';

export interface NoteExportRow {
  noteId:    string;
  quote:     string;
  note:      string;
  bookTitle: string;
  citation:  string;
  createdAt: string;
}

/** The snapshot a note share link stores, in display order. */
export function buildNoteSharePayload(rows: NoteExportRow[]): NoteShareEntry[] {
  return groupNotesByBook(rows).flatMap(g => g.entries.map(e => ({
    note_id:    e.noteId,
    quote:      e.quote,
    note:       e.note,
    book_title: e.bookTitle,
    citation:   citationBare(e.citation),
    created_at: e.createdAt,
  })));
}

function fileBase(t: (k: any) => string): string {
  return safeFilename(`${t('notes.title')} ${new Date().toISOString().slice(0, 10)}`);
}

export async function exportAsDocx(rows: NoteExportRow[]): Promise<void> {
  const t = exportTranslator();
  const children: Paragraph[] = [
    new Paragraph({
      children: [new TextRun({ text: t('notes.title'), size: 22, color: DOC_FAINT })],
      spacing: { after: 400 },
    }),
  ];
  for (const group of groupNotesByBook(rows)) {
    children.push(new Paragraph({
      heading: depthHeading(0),
      children: [new TextRun({ text: group.bookTitle, size: 40, color: DOC_PRIMARY })],
      spacing: { before: 500, after: 200 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: DOC_DIVIDER, space: 4 } },
    }));
    for (const e of group.entries) {
      children.push(new Paragraph({
        alignment: AlignmentType.BOTH, spacing: { before: 200, after: 60 }, keepNext: true,
        children: [new TextRun({ text: `“${e.quote}”`, size: 22, color: DOC_BODY })],
      }));
      children.push(new Paragraph({
        spacing: { after: 120 }, keepNext: true,
        children: [new TextRun({ text: citationInParens(e.citation), size: 16, italics: true, color: DOC_MUTED })],
      }));
      children.push(new Paragraph({
        spacing: { after: 240 },
        indent: { left: 240 },
        border: { left: { style: BorderStyle.SINGLE, size: 12, color: 'D4BC6A', space: 8 } },
        children: [new TextRun({ text: e.note, size: 20, color: DOC_PRIMARY })],
      }));
    }
  }
  const footer = new Footer({
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: 'Made with Immerse Research', size: 20, italics: true, color: DOC_FAINT })],
    })],
  });
  const doc = new Document({ sections: [{ footers: { default: footer }, children }] });
  const buffer = await Packer.toBuffer(doc);
  triggerDownload(
    new Blob([new Uint8Array(buffer)], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }),
    `${fileBase(t)}.docx`,
  );
}

export async function exportAsPdf(rows: NoteExportRow[]): Promise<void> {
  const t = exportTranslator();
  let body = '';
  for (const group of groupNotesByBook(rows)) {
    body += `\n  <h2 class="book-h">${escapeHtml(group.bookTitle)}</h2>`;
    for (const e of group.entries) {
      body += `\n  <div class="note-block">` +
        `\n    <p class="quote">“${escapeHtml(e.quote)}”</p>` +
        `\n    <p class="citation">${escapeHtml(citationInParens(e.citation))}</p>` +
        `\n    <p class="note">${escapeHtml(e.note)}</p>` +
        `\n  </div>`;
    }
  }
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>${escapeHtml(fileBase(t))}</title>
  <style>
    @page { size: letter; margin: 1in; }
    body { font-family: Georgia, 'Times New Roman', serif; margin: 0 auto; padding: 40px 36px;
           line-height: 1.7; color: #1C2B35; font-size: 14px; max-width: 720px; orphans: 2; widows: 2; }
    .export-title { font-size: 11px; color: #9CA3AF; margin: 0 0 34px; }
    .book-h { font-size: 20px; color: #1B6B7B; font-weight: 400; margin: 34px 0 14px;
              padding-bottom: 6px; border-bottom: 1px solid #E5E7EB; page-break-after: avoid; break-after: avoid; }
    .book-h:first-of-type { margin-top: 0; }
    .note-block { margin-bottom: 24px; page-break-inside: avoid; break-inside: avoid; }
    .quote { margin: 0; text-align: justify; font-size: 13px; }
    .citation { margin: 6px 0 0; font-size: 10px; color: #6B7280; font-style: italic; }
    .note { margin: 10px 0 0; padding-left: 12px; border-left: 3px solid #D4BC6A;
            font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif; font-size: 12.5px;
            color: #1B6B7B; white-space: pre-wrap; }
    .footer { text-align: center; font-size: 10px; color: #9CA3AF; font-style: italic; margin-top: 40px; }
    @media print { body { padding: 0; max-width: none; } }
  </style>
</head>
<body>
  <p class="export-title">${escapeHtml(t('notes.title'))}</p>${body}
  <p class="footer">Made with Immerse Research</p>
</body>
</html>`;
  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  }
}

export async function exportAsCsv(rows: NoteExportRow[]): Promise<void> {
  const t = exportTranslator();
  const out: string[] = [['Book', 'Citation', 'Quote', 'Note'].map(csvField).join(',')];
  for (const group of groupNotesByBook(rows)) {
    for (const e of group.entries) {
      out.push([group.bookTitle, citationBare(e.citation), e.quote, e.note].map(csvField).join(','));
    }
  }
  triggerDownload(new Blob(['﻿' + out.join('\n')], { type: 'text/csv;charset=utf-8' }), `${fileBase(t)}.csv`);
}

export async function exportAsMarkdown(rows: NoteExportRow[]): Promise<void> {
  const t = exportTranslator();
  const lines: string[] = [];
  for (const group of groupNotesByBook(rows)) {
    if (lines.length > 0) lines.push('');
    lines.push(`# ${group.bookTitle}`);
    for (const e of group.entries) {
      lines.push('');
      lines.push(`> "${e.quote}"`);
      lines.push(`> *${citationInParens(e.citation)}*`);
      lines.push('');
      lines.push(e.note);
    }
  }
  lines.push('', '---', '*Made with Immerse Research*');
  triggerDownload(new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' }), `${fileBase(t)}.md`);
}
