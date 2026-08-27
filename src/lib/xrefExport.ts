'use client';

import {
  AlignmentType, BorderStyle, Document, Footer, Packer, Paragraph, TextRun,
  Table, TableCell, TableRow, WidthType,
} from 'docx';
import { groupXrefsByPair } from './xrefGrouping';
import { exportTranslator } from './tagExport';
import {
  escapeHtml, citationInParens, citationBare, csvField, triggerDownload, safeFilename, depthHeading,
  DOC_PRIMARY, DOC_BODY, DOC_MUTED, DOC_FAINT, DOC_DIVIDER,
} from './exportShared';

export interface XRefExportSide {
  snapshotText: string;
  bookTitle:    string;
  citation:     string;
}
export interface XRefExportRow {
  id:        string;
  label:     string | null;
  createdAt: string;
  pairKey:   string;
  pairName:  string;
  a: XRefExportSide;
  b: XRefExportSide;
}

function fileBase(t: (k: any) => string): string {
  return safeFilename(`${t('xrefs.title')} ${new Date().toISOString().slice(0, 10)}`);
}

function grouped(rows: XRefExportRow[]) {
  return groupXrefsByPair(rows, {
    getLabel:     r => r.label,
    getCreatedAt: r => r.createdAt,
    getPairKey:   r => r.pairKey,
    getPairName:  r => r.pairName,
  });
}

const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: 'auto' } as const;

function entryTable(row: XRefExportRow): Table {
  const cell = (side: XRefExportSide, isRight: boolean) =>
    new TableCell({
      width: { size: 50, type: WidthType.PERCENTAGE },
      margins: { top: 60, bottom: 60, left: isRight ? 180 : 0, right: isRight ? 0 : 180 },
      borders: {
        top: NO_BORDER, bottom: NO_BORDER, right: NO_BORDER,
        left: isRight ? { style: BorderStyle.SINGLE, size: 4, color: DOC_DIVIDER } : NO_BORDER,
      },
      children: [
        new Paragraph({
          alignment: AlignmentType.BOTH, spacing: { after: 60 },
          children: [new TextRun({ text: `“${side.snapshotText}”`, size: 22, color: DOC_BODY })],
        }),
        new Paragraph({
          children: [new TextRun({ text: citationInParens(side.citation), size: 16, italics: true, color: DOC_MUTED })],
        }),
      ],
    });
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER,
      insideHorizontal: NO_BORDER, insideVertical: NO_BORDER,
    },
    rows: [new TableRow({ cantSplit: true, children: [cell(row.a, false), cell(row.b, true)] })],
  });
}

export async function exportAsDocx(rows: XRefExportRow[]): Promise<void> {
  const t = exportTranslator();
  const children: (Paragraph | Table)[] = [
    new Paragraph({
      children: [new TextRun({ text: t('xrefs.title'), size: 22, color: DOC_FAINT })],
      spacing: { after: 400 },
    }),
  ];
  for (const pair of grouped(rows)) {
    children.push(new Paragraph({
      heading: depthHeading(0),
      children: [new TextRun({ text: pair.pairName, size: 40, color: DOC_PRIMARY })],
      spacing: { before: 500, after: 200 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: DOC_DIVIDER, space: 4 } },
    }));
    for (const row of pair.items) {
      if (row.label) children.push(new Paragraph({
        children: [new TextRun({ text: row.label, size: 20, bold: true, color: DOC_PRIMARY })],
        spacing: { before: 200, after: 80 },
      }));
      children.push(entryTable(row));
      children.push(new Paragraph({ text: '', spacing: { after: 200 } }));
    }
  }
  const footer = new Footer({
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: 'Made with Immerse', size: 20, italics: true, color: DOC_FAINT })],
    })],
  });
  const doc = new Document({ sections: [{ footers: { default: footer }, children }] });
  const buffer = await Packer.toBuffer(doc);
  triggerDownload(
    new Blob([new Uint8Array(buffer)], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }),
    `${fileBase(t)}.docx`,
  );
}

export async function exportAsPdf(rows: XRefExportRow[]): Promise<void> {
  const t = exportTranslator();
  let body = '';
  for (const pair of grouped(rows)) {
    body += `\n  <h2 class="pair-h">${escapeHtml(pair.pairName)}</h2>`;
    for (const row of pair.items) {
      body += `\n  <div class="xref-block">`;
      if (row.label) body += `\n    <p class="xref-label">${escapeHtml(row.label)}</p>`;
      body += `\n    <div class="xref-row">` +
        `\n      <div class="xref-side"><p class="quote">“${escapeHtml(row.a.snapshotText)}”</p>` +
        `<p class="citation">${escapeHtml(citationInParens(row.a.citation))}</p></div>` +
        `\n      <div class="xref-rule"></div>` +
        `\n      <div class="xref-side"><p class="quote">“${escapeHtml(row.b.snapshotText)}”</p>` +
        `<p class="citation">${escapeHtml(citationInParens(row.b.citation))}</p></div>` +
        `\n    </div>\n  </div>`;
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
    .pair-h { font-size: 20px; color: #1B6B7B; font-weight: 400; margin: 34px 0 14px;
              padding-bottom: 6px; border-bottom: 1px solid #E5E7EB; page-break-after: avoid; break-after: avoid; }
    .pair-h:first-of-type { margin-top: 0; }
    .xref-block { margin-bottom: 22px; page-break-inside: avoid; break-inside: avoid; }
    .xref-label { font-size: 12px; font-weight: 700; color: #1B6B7B; margin: 0 0 8px; }
    .xref-row { display: flex; page-break-inside: avoid; break-inside: avoid; }
    .xref-rule { width: 1px; background: #D1D5DB; flex: 0 0 1px; }
    .xref-side { flex: 1; padding: 0 18px; }
    .xref-side:first-child { padding-left: 0; }
    .xref-side:last-child { padding-right: 0; }
    .quote { margin: 0; text-align: justify; font-size: 13px; }
    .citation { margin: 6px 0 0; font-size: 10px; color: #6B7280; font-style: italic; }
    .footer { text-align: center; font-size: 10px; color: #9CA3AF; font-style: italic; margin-top: 40px; }
    @media print { body { padding: 0; max-width: none; } }
  </style>
</head>
<body>
  <p class="export-title">${escapeHtml(t('xrefs.title'))}</p>${body}
  <p class="footer">Made with Immerse</p>
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

export async function exportAsCsv(rows: XRefExportRow[]): Promise<void> {
  const t = exportTranslator();
  const out: string[] = [
    ['Pair', 'Label', 'Book A', 'Citation A', 'Quote A', 'Book B', 'Citation B', 'Quote B'].map(csvField).join(','),
  ];
  for (const pair of grouped(rows)) {
    for (const row of pair.items) {
      out.push([
        pair.pairName, row.label ?? '',
        row.a.bookTitle, citationBare(row.a.citation), row.a.snapshotText,
        row.b.bookTitle, citationBare(row.b.citation), row.b.snapshotText,
      ].map(csvField).join(','));
    }
  }
  triggerDownload(new Blob(['﻿' + out.join('\n')], { type: 'text/csv;charset=utf-8' }), `${fileBase(t)}.csv`);
}

export async function exportAsMarkdown(rows: XRefExportRow[]): Promise<void> {
  const t = exportTranslator();
  const lines: string[] = [];
  for (const pair of grouped(rows)) {
    if (lines.length > 0) lines.push('');
    lines.push(`# ${pair.pairName}`);
    for (const row of pair.items) {
      lines.push('');
      if (row.label) { lines.push(`**${row.label}**`); lines.push(''); }
      lines.push(`> "${row.a.snapshotText}"`);
      lines.push(`> *${citationInParens(row.a.citation)}*`);
      lines.push('', '↔', '');
      lines.push(`> "${row.b.snapshotText}"`);
      lines.push(`> *${citationInParens(row.b.citation)}*`);
    }
  }
  lines.push('', '---', '*Made with Immerse*');
  triggerDownload(new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' }), `${fileBase(t)}.md`);
}
