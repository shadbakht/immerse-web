'use client';

import { createClient } from './supabase/client';
import {
  AlignmentType,
  Document,
  Footer,
  Packer,
  Paragraph,
  TextRun,
} from 'docx';

// ─── Shared types (imported by TagsScreen) ────────────────────────────────────

export interface SelRow {
  id: string;
  snapshot_text: string;
  passage_id: string;
  book_id: string;
  citation: string;
}

export interface TagRow {
  id: string;
  name: string;
  created_at: string;
  visibility: string;
  selections: SelRow[];
}

// ─── IMM payload types ────────────────────────────────────────────────────────

interface ImmPayload {
  version: '1';
  exportedAt: string;
  appId: 'com.shadbakht.immerse';
  tags: ImmTagExport[];
}

interface ImmTagExport {
  exportId: string;
  name: string;
  color: string | null;
  parentExportId: string | null;
  depth: number;
  sortOrder: number;
  selections: ImmSelectionExport[];
}

interface ImmSelectionExport {
  snapshotText: string;
  bookId: string;
  bookTitle: string;
  citation: string;
  notes: string[];
  xrefCitations: string[];
  startPid: string;
  startOffset: number;
  endPid: string;
  endOffset: number;
  createdAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function safeFilename(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, '').replace(/\s+/g, ' ').trim() || 'tag';
}

function citationInParens(raw: string): string {
  if (!raw) return '';
  return `(${raw.replace(/^—\s*/, '').replace(/\.$/, '')})`;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Enrich with notes + full selection offsets from Supabase ─────────────────

interface EnrichedData {
  notesBySelId: Record<string, string[]>;
  selFullMap: Record<string, { start_pid: string; end_pid: string; start_offset: number; end_offset: number; created_at: string }>;
}

async function fetchEnrichedData(allSelIds: string[]): Promise<EnrichedData> {
  if (!allSelIds.length) return { notesBySelId: {}, selFullMap: {} };

  const supabase = createClient();
  const [{ data: notesData }, { data: selFullData }] = await Promise.all([
    supabase.from('notes').select('selection_id, content').in('selection_id', allSelIds),
    supabase.from('selections').select('id, start_pid, end_pid, start_offset, end_offset, created_at').in('id', allSelIds),
  ]);

  const notesBySelId: Record<string, string[]> = {};
  for (const n of (notesData ?? []) as any[]) {
    (notesBySelId[n.selection_id] ??= []).push(n.content ?? '');
  }

  const selFullMap: Record<string, any> = {};
  for (const s of (selFullData ?? []) as any[]) selFullMap[s.id] = s;

  return { notesBySelId, selFullMap };
}

// ─── Export: IMM ──────────────────────────────────────────────────────────────

export async function exportAsImm(selectedTags: TagRow[]): Promise<void> {
  const allSelIds = selectedTags.flatMap(t => t.selections.map(s => s.id));
  const { notesBySelId, selFullMap } = await fetchEnrichedData(allSelIds);

  const tagExports: ImmTagExport[] = selectedTags.map((tag, i) => ({
    exportId: `t${i}`,
    name: tag.name,
    color: null,
    parentExportId: null,
    depth: 0,
    sortOrder: i,
    selections: tag.selections.map(sel => {
      const full = selFullMap[sel.id];
      return {
        snapshotText: sel.snapshot_text,
        bookId: sel.book_id,
        bookTitle: sel.citation.replace(/^—\s*/, '').split(',')[0]?.trim() ?? sel.book_id,
        citation: sel.citation,
        notes: notesBySelId[sel.id] ?? [],
        xrefCitations: [],
        startPid: full?.start_pid ?? sel.passage_id,
        startOffset: full?.start_offset ?? 0,
        endPid: full?.end_pid ?? sel.passage_id,
        endOffset: full?.end_offset ?? 0,
        createdAt: full?.created_at ?? new Date().toISOString(),
      };
    }),
  }));

  const payload: ImmPayload = {
    version: '1',
    exportedAt: new Date().toISOString(),
    appId: 'com.shadbakht.immerse',
    tags: tagExports,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  triggerDownload(blob, `${safeFilename(selectedTags[0]?.name ?? 'tags')}.imm`);
}

// ─── Export: DOCX ─────────────────────────────────────────────────────────────

const DOC_PRIMARY = '1B6B7B';
const DOC_BODY    = '1C2B35';
const DOC_MUTED   = '6B7280';
const DOC_FAINT   = '9CA3AF';

export async function exportAsDocx(selectedTags: TagRow[]): Promise<void> {
  const allSelIds = selectedTags.flatMap(t => t.selections.map(s => s.id));
  const { notesBySelId } = await fetchEnrichedData(allSelIds);

  const children: Paragraph[] = [];

  for (const tag of selectedTags) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: tag.name, size: 48, color: DOC_PRIMARY })],
        spacing: { before: 600, after: 160 },
      }),
    );

    if (tag.selections.length === 0) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: '(no passages tagged)', italics: true, size: 20, color: DOC_FAINT })],
          spacing: { after: 200 },
        }),
      );
      continue;
    }

    for (const sel of tag.selections) {
      const notes = notesBySelId[sel.id] ?? [];
      const hasExtra = notes.length > 0;
      const cit = citationInParens(sel.citation);

      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: '“', size: 22, color: DOC_BODY }),
            new TextRun({ text: sel.snapshot_text, size: 22, color: DOC_BODY }),
            new TextRun({ text: '”', size: 22, color: DOC_BODY }),
          ],
          alignment: AlignmentType.BOTH,
          spacing: { before: 160, after: 0 },
        }),
      );

      children.push(
        new Paragraph({
          children: [new TextRun({ text: cit, size: 18, italics: true, color: DOC_MUTED })],
          alignment: AlignmentType.RIGHT,
          spacing: { after: hasExtra ? 80 : 300 },
        }),
      );

      notes.forEach((note, ni) => {
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: '•  ', size: 20, color: DOC_BODY }),
              new TextRun({ text: note, size: 20, color: DOC_BODY }),
            ],
            indent: { left: 432, hanging: 216 },
            spacing: { after: ni === notes.length - 1 ? 300 : 80 },
          }),
        );
      });
    }
  }

  const pageFooter = new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: 'Made with Immerse', size: 20, italics: true, color: DOC_FAINT })],
      }),
    ],
  });

  const doc = new Document({ sections: [{ footers: { default: pageFooter }, children }] });
  const buffer = await Packer.toBuffer(doc);
  const blob = new Blob([new Uint8Array(buffer)], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
  triggerDownload(blob, `${safeFilename(selectedTags[0]?.name ?? 'tags')}.docx`);
}

// ─── Export: PDF (print-to-PDF via browser) ───────────────────────────────────

export async function exportAsPdf(selectedTags: TagRow[]): Promise<void> {
  const allSelIds = selectedTags.flatMap(t => t.selections.map(s => s.id));
  const { notesBySelId } = await fetchEnrichedData(allSelIds);

  let body = '';

  for (const tag of selectedTags) {
    body += `\n  <h2 class="tag-heading">${escapeHtml(tag.name)}</h2>`;

    if (tag.selections.length === 0) {
      body += `\n  <p class="empty">(no passages tagged)</p>`;
      continue;
    }

    for (const sel of tag.selections) {
      const notes = notesBySelId[sel.id] ?? [];
      const cit   = citationInParens(sel.citation);

      body += `\n  <div class="passage-block">`;
      body += `\n    <p class="quote">“${escapeHtml(sel.snapshot_text)}”</p>`;
      body += `\n    <p class="citation">${escapeHtml(cit)}</p>`;
      for (const note of notes) {
        body += `\n    <p class="note">•  ${escapeHtml(note)}</p>`;
      }
      body += `\n  </div>`;
    }
  }

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>${escapeHtml(selectedTags.map(t => t.name).join(', '))}</title>
  <style>
    body { font-family: Georgia, 'Times New Roman', serif; max-width: 640px; margin: 0 auto; padding: 40px 36px; line-height: 1.75; color: #1C2B35; font-size: 14px; }
    .tag-heading { font-size: 22px; color: #1B6B7B; font-weight: 400; margin: 48px 0 10px; padding-bottom: 6px; border-bottom: 1px solid #E5E7EB; }
    .tag-heading:first-child { margin-top: 0; }
    .passage-block { margin-bottom: 24px; }
    .quote { margin: 0; text-align: justify; }
    .citation { margin: 0; text-align: right; font-size: 11px; color: #6B7280; font-style: italic; }
    .note { margin: 6px 0 3px; font-size: 13px; padding-left: 20px; text-indent: -12px; }
    .empty { font-style: italic; color: #9CA3AF; font-size: 13px; }
    .footer { text-align: center; font-size: 10px; color: #9CA3AF; font-style: italic; margin-top: 48px; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>${body}
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
