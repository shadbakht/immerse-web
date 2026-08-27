'use client';

import { translate, type TranslationKey, type TranslateVars } from '@immerse/i18n';
import { createClient } from './supabase/client';
import { getStoredUiLanguage } from './language';
import {
  AlignmentType,
  Document,
  Footer,
  HeadingLevel,
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
  book_title?: string;
  citation: string;
}

export interface TagRow {
  id: string;
  name: string;
  parent_id: string | null;
  depth: number;
  sort_order: number;
  created_at: string;
  visibility: string;
  selections: SelRow[];
}

export interface ExportOptions {
  includeNotes: boolean;
  includeXrefs: boolean;
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

/**
 * Filename stem for an export: the main (top-level) tag heading, which is what
 * the document leads with. Falls back to the first tag when the selection is
 * sub-tags only.
 */
function exportBaseName(selectedTags: TagRow[]): string {
  const root = selectedTags.find(t => (t.depth ?? 0) === 0) ?? selectedTags[0];
  return safeFilename(root?.name ?? 'tags');
}

function citationInParens(raw: string): string {
  if (!raw) return '';
  return `(${raw.replace(/^—\s*/, '').replace(/\.$/, '')})`;
}

function citationBare(raw: string): string {
  if (!raw) return '';
  return raw.replace(/^—\s*/, '').replace(/\.$/, '');
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
  xrefsBySel:   Record<string, string[]>; // selId → display strings for linked passages
  selFullMap:   Record<string, { start_pid: string; end_pid: string; start_offset: number; end_offset: number; created_at: string }>;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function fetchEnrichedData(selIds: string[], opts: ExportOptions): Promise<EnrichedData> {
  // A Discover export carries synthetic selection ids ("<ctId>:<exportId>:<i>"),
  // since nothing has been imported: there are no rows to enrich, and sending
  // those to PostgREST is a guaranteed invalid-uuid error. Quotes and citations
  // come from the payload either way; notes and xrefs are never shared.
  const allSelIds = selIds.filter(id => UUID_RE.test(id));
  if (!allSelIds.length) return { notesBySelId: {}, xrefsBySel: {}, selFullMap: {} };

  const supabase = createClient();
  const [{ data: selFullData }, { data: notesData }, xrefsResult] = await Promise.all([
    supabase.from('selections').select('id, start_pid, end_pid, start_offset, end_offset, created_at').in('id', allSelIds),
    opts.includeNotes
      ? supabase.from('notes').select('selection_id, content').in('selection_id', allSelIds)
      : Promise.resolve({ data: [] }),
    opts.includeXrefs
      ? (async () => {
          const [{ data: ra }, { data: rb }] = await Promise.all([
            supabase.from('xrefs').select('id, selection_a_id, selection_b_id, label').in('selection_a_id', allSelIds),
            supabase.from('xrefs').select('id, selection_a_id, selection_b_id, label').in('selection_b_id', allSelIds),
          ]);
          const seen = new Set<string>();
          const all = [...(ra ?? []), ...(rb ?? [])].filter(x => { if (seen.has(x.id)) return false; seen.add(x.id); return true; });
          // Fetch snapshot texts for the "other" side
          const otherIds = [...new Set(all.map(x => allSelIds.includes(x.selection_a_id) ? x.selection_b_id : x.selection_a_id).filter(id => !allSelIds.includes(id)))];
          const otherSnaps: Record<string, string> = {};
          if (otherIds.length) {
            const { data: others } = await supabase.from('selections').select('id, snapshot_text').in('id', otherIds);
            for (const s of (others ?? []) as any[]) otherSnaps[s.id] = s.snapshot_text ?? '';
          }
          return all.map(x => {
            const myId    = allSelIds.includes(x.selection_a_id) ? x.selection_a_id : x.selection_b_id;
            const otherId = myId === x.selection_a_id ? x.selection_b_id : x.selection_a_id;
            const display = x.label || `"${(otherSnaps[otherId] ?? '').slice(0, 80)}${(otherSnaps[otherId] ?? '').length > 80 ? '…' : ''}"`;
            return { myId, display };
          });
        })()
      : Promise.resolve([]),
  ]);

  const notesBySelId: Record<string, string[]> = {};
  for (const n of (notesData ?? []) as any[]) {
    (notesBySelId[n.selection_id] ??= []).push(n.content ?? '');
  }

  const xrefsBySel: Record<string, string[]> = {};
  for (const { myId, display } of (xrefsResult as any[])) {
    (xrefsBySel[myId] ??= []).push(display);
  }

  const selFullMap: Record<string, any> = {};
  for (const s of (selFullData ?? []) as any[]) selFullMap[s.id] = s;

  return { notesBySelId, xrefsBySel, selFullMap };
}

// ─── Export: DOCX ─────────────────────────────────────────────────────────────

/**
 * Translation for the export document, which is assembled outside React.
 * Both builders run in the browser, so the stored language is readable
 * directly rather than threaded through every call site.
 */
const exportTranslator = () => {
  const lang = getStoredUiLanguage();
  return (key: TranslationKey, vars?: TranslateVars) => translate(lang, key, vars);
};

const DOC_PRIMARY = '1B6B7B';
const DOC_BODY    = '1C2B35';
const DOC_MUTED   = '6B7280';
const DOC_FAINT   = '9CA3AF';

/**
 * Real Word outline levels by nesting depth, so a long Compilation gets a
 * working Navigation Pane / table of contents in Word. Depth 0 → Heading 1,
 * clamped at Heading 6 for trees deeper than the app's own limit. The run's
 * explicit size/color still override the built-in style, so the document's
 * look is unchanged — only the `<w:pStyle>` outline reference is added.
 * Mirrors the mobile repo's `depthHeading`.
 */
const DEPTH_HEADING = [
  HeadingLevel.HEADING_1,
  HeadingLevel.HEADING_2,
  HeadingLevel.HEADING_3,
  HeadingLevel.HEADING_4,
  HeadingLevel.HEADING_5,
  HeadingLevel.HEADING_6,
] as const;

function depthHeading(depth: number): (typeof DEPTH_HEADING)[number] {
  return DEPTH_HEADING[Math.min(Math.max(depth, 0), DEPTH_HEADING.length - 1)];
}

export async function exportAsDocx(selectedTags: TagRow[], opts: ExportOptions = { includeNotes: true, includeXrefs: true }): Promise<void> {
  const t = exportTranslator();
  const allSelIds = selectedTags.flatMap(tag => tag.selections.map(s => s.id));
  const { notesBySelId, xrefsBySel } = await fetchEnrichedData(allSelIds, opts);

  const children: Paragraph[] = [];

  for (const tag of selectedTags) {
    const D   = tag.depth ?? 0;
    const dI  = D * 360;                              // indent in twips (0.25 in per level)
    const hSz = D === 0 ? 48 : D === 1 ? 36 : 28;   // 24 / 18 / 14 pt

    children.push(
      new Paragraph({
        heading: depthHeading(D),
        children: [new TextRun({ text: tag.name, size: hSz, color: DOC_PRIMARY })],
        indent:  D > 0 ? { left: dI } : undefined,
        spacing: { before: D === 0 ? 600 : 400, after: 160 },
      }),
    );

    if (tag.selections.length === 0) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: t('export.noPassagesTagged'), italics: true, size: 20, color: DOC_FAINT })],
          indent:  D > 0 ? { left: dI } : undefined,
          spacing: { after: 200 },
        }),
      );
      continue;
    }

    for (const sel of tag.selections) {
      const notes = opts.includeNotes ? (notesBySelId[sel.id] ?? []) : [];
      const xrefs = opts.includeXrefs ? (xrefsBySel[sel.id] ?? []) : [];
      const hasExtra = notes.length > 0 || xrefs.length > 0;
      const cit = citationInParens(sel.citation);

      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: '”', size: 22, color: DOC_BODY }),
            new TextRun({ text: sel.snapshot_text, size: 22, color: DOC_BODY }),
            new TextRun({ text: '”', size: 22, color: DOC_BODY }),
          ],
          alignment: AlignmentType.BOTH,
          indent:    D > 0 ? { left: dI } : undefined,
          spacing:   { before: 160, after: 0 },
        }),
      );

      children.push(
        new Paragraph({
          children: [new TextRun({ text: cit, size: 18, italics: true, color: DOC_MUTED })],
          alignment: AlignmentType.RIGHT,
          indent:    D > 0 ? { left: dI } : undefined,
          spacing:   { after: hasExtra ? 80 : 300 },
        }),
      );

      notes.forEach((note, ni) => {
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: '•  ', size: 20, color: DOC_BODY }),
              new TextRun({ text: note, size: 20, color: DOC_BODY }),
            ],
            indent:  { left: dI + 432, hanging: 216 },
            spacing: { after: ni === notes.length - 1 && xrefs.length === 0 ? 300 : 80 },
          }),
        );
      });
      xrefs.forEach((xref, xi) => {
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: '↔  ', size: 20, color: DOC_PRIMARY }),
              new TextRun({ text: xref, size: 20, italics: true, color: DOC_MUTED }),
            ],
            indent:  { left: dI + 432, hanging: 216 },
            spacing: { after: xi === xrefs.length - 1 ? 300 : 80 },
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
  triggerDownload(blob, `${exportBaseName(selectedTags)}.docx`);
}

// ─── Export: PDF (print-to-PDF via browser) ───────────────────────────────────

export async function exportAsPdf(selectedTags: TagRow[], opts: ExportOptions = { includeNotes: true, includeXrefs: true }): Promise<void> {
  const t = exportTranslator();
  const allSelIds = selectedTags.flatMap(tag => tag.selections.map(s => s.id));
  const { notesBySelId, xrefsBySel } = await fetchEnrichedData(allSelIds, opts);

  let body = '';

  for (const tag of selectedTags) {
    body += `\n  <h2 class="tag-heading">${escapeHtml(tag.name)}</h2>`;

    if (tag.selections.length === 0) {
      body += `\n  <p class="empty">${escapeHtml(t('export.noPassagesTagged'))}</p>`;
      continue;
    }

    for (const sel of tag.selections) {
      const notes = opts.includeNotes ? (notesBySelId[sel.id] ?? []) : [];
      const xrefs = opts.includeXrefs ? (xrefsBySel[sel.id] ?? []) : [];
      const cit   = citationInParens(sel.citation);

      // NB: straight quotes on the attributes. These were curly, which the HTML
      // parser reads as part of an unquoted value — every class was wrong and
      // none of the stylesheet below applied.
      body += `\n  <div class="passage-block">`;
      body += `\n    <p class="quote">“${escapeHtml(sel.snapshot_text)}”</p>`;
      body += `\n    <p class="citation">${escapeHtml(cit)}</p>`;
      for (const note of notes) {
        body += `\n    <p class="note">•  ${escapeHtml(note)}</p>`;
      }
      for (const xref of xrefs) {
        body += `\n    <p class="xref">↔  ${escapeHtml(xref)}</p>`;
      }
      body += `\n  </div>`;
    }
  }

  // The browser's print-to-PDF names the file after the document title, so the
  // title is the main tag heading rather than a joined list of every tag.
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>${escapeHtml(exportBaseName(selectedTags))}</title>
  <style>
    /* 1in margins on every page. Without this the print dialog's own default
       applies and a line landing on the page break is cut through. */
    @page { size: letter; margin: 1in; }
    body { font-family: Georgia, 'Times New Roman', serif; margin: 0 auto; padding: 40px 36px; line-height: 1.75; color: #1C2B35; font-size: 14px; max-width: 640px; orphans: 2; widows: 2; }
    .tag-heading { font-size: 22px; color: #1B6B7B; font-weight: 400; margin: 48px 0 10px; padding-bottom: 6px; border-bottom: 1px solid #E5E7EB; page-break-after: avoid; break-after: avoid; }
    .tag-heading:first-child { margin-top: 0; }
    /* Keep a quote with its citation, notes and cross-references */
    .passage-block { margin-bottom: 24px; page-break-inside: avoid; break-inside: avoid; }
    .quote { margin: 0; text-align: justify; }
    .citation { margin: 0; text-align: right; font-size: 11px; color: #6B7280; font-style: italic; }
    .note { margin: 6px 0 3px; font-size: 13px; padding-left: 20px; text-indent: -12px; }
    .xref { margin: 4px 0 3px; font-size: 12px; color: #1B6B7B; font-style: italic; padding-left: 20px; text-indent: -14px; }
    .empty { font-style: italic; color: #9CA3AF; font-size: 13px; }
    .footer { text-align: center; font-size: 10px; color: #9CA3AF; font-style: italic; margin-top: 48px; }
    @media print { body { padding: 0; max-width: none; } }
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

// ─── Export: CSV ──────────────────────────────────────────────────────────────

/** Wrap a CSV field value — quotes it if it contains comma, quote, or newline. */
function csvField(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

/** Column-for-column identical to the mobile CSV export. */
export async function exportAsCsv(selectedTags: TagRow[], opts: ExportOptions = { includeNotes: true, includeXrefs: true }): Promise<void> {
  const allSelIds = selectedTags.flatMap(tag => tag.selections.map(s => s.id));
  const { notesBySelId, xrefsBySel } = await fetchEnrichedData(allSelIds, opts);

  const rows: string[] = [
    ['Tag', 'Sub-tag', 'Book', 'Citation', 'Quote', 'Notes', 'See Also']
      .map(csvField).join(','),
  ];

  // Track the root tag name as we walk the tree-ordered list
  let currentRootName = '';

  for (const tag of selectedTags) {
    if ((tag.depth ?? 0) === 0) currentRootName = tag.name;
    const tagCol    = currentRootName;
    const subTagCol = (tag.depth ?? 0) > 0 ? tag.name : '';

    for (const sel of tag.selections) {
      const notes = opts.includeNotes ? (notesBySelId[sel.id] ?? []) : [];
      const xrefs = opts.includeXrefs ? (xrefsBySel[sel.id] ?? []) : [];
      rows.push(
        [
          tagCol,
          subTagCol,
          sel.book_title ?? '',
          citationBare(sel.citation),
          sel.snapshot_text,
          notes.join('; '),
          xrefs.join('; '),
        ].map(csvField).join(','),
      );
    }
  }

  // BOM so Excel opens the accented citations as UTF-8
  const blob = new Blob(['﻿' + rows.join('\n')], { type: 'text/csv;charset=utf-8' });
  triggerDownload(blob, `${exportBaseName(selectedTags)}.csv`);
}

// ─── Export: Markdown ─────────────────────────────────────────────────────────

export async function exportAsMarkdown(selectedTags: TagRow[], opts: ExportOptions = { includeNotes: true, includeXrefs: true }): Promise<void> {
  const t = exportTranslator();
  const allSelIds = selectedTags.flatMap(tag => tag.selections.map(s => s.id));
  const { notesBySelId, xrefsBySel } = await fetchEnrichedData(allSelIds, opts);

  const lines: string[] = [];

  for (const tag of selectedTags) {
    const prefix = '#'.repeat(Math.min((tag.depth ?? 0) + 1, 4));
    if (lines.length > 0) lines.push('');
    lines.push(`${prefix} ${tag.name}`);

    if (tag.selections.length === 0) {
      lines.push('', `*${t('export.noPassagesTagged')}*`);
      continue;
    }

    for (const sel of tag.selections) {
      const notes = opts.includeNotes ? (notesBySelId[sel.id] ?? []) : [];
      const xrefs = opts.includeXrefs ? (xrefsBySel[sel.id] ?? []) : [];

      lines.push('');
      lines.push(`> "${sel.snapshot_text}"`);
      lines.push(`> *${citationInParens(sel.citation)}*`);

      for (const note of notes) {
        lines.push('');
        lines.push(`- ${note}`);
      }

      if (xrefs.length > 0) {
        lines.push('');
        lines.push(`◇ *${t('export.seeAlso')}*`);
        for (const xref of xrefs) lines.push(`  - ${xref}`);
      }
    }
  }

  lines.push('', '---', '*Made with Immerse*');

  const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
  triggerDownload(blob, `${exportBaseName(selectedTags)}.md`);
}
