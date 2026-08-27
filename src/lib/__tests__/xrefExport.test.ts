import { TextEncoder, TextDecoder } from 'util';
import { Blob as NodeBlob } from 'buffer';
Object.assign(globalThis, { TextEncoder, TextDecoder, Blob: NodeBlob });

import JSZip from 'jszip';
import { exportAsDocx, exportAsCsv, exportAsMarkdown, type XRefExportRow } from '../xrefExport';

let capturedBlob: Blob | null = null;
let capturedName = '';
beforeAll(() => {
  (URL as any).createObjectURL = (b: Blob) => { capturedBlob = b; return 'blob:mock'; };
  (URL as any).revokeObjectURL = () => {};
});
beforeEach(() => { capturedBlob = null; capturedName = ''; });

const realCreate = document.createElement.bind(document);
jest.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
  const el = realCreate(tag);
  if (tag === 'a') {
    Object.defineProperty(el, 'click', { value: () => { capturedName = (el as HTMLAnchorElement).download; } });
  }
  return el;
}) as any);

function rows(): XRefExportRow[] {
  return [
    {
      id: 'x1', label: 'Love', createdAt: '2023-01-01T00:00:00Z',
      pairKey: 'a↔b', pairName: "Bahá'í ↔ Christianity",
      a: { snapshotText: 'unity quote', bookTitle: 'Gleanings', citation: '— Gleanings, 1:1.' },
      b: { snapshotText: 'love quote',  bookTitle: 'John',      citation: '— John, 13:34.' },
    },
    {
      id: 'x2', label: null, createdAt: '2023-03-01T00:00:00Z',
      pairKey: 'a↔b', pairName: "Bahá'í ↔ Christianity",
      a: { snapshotText: 'country quote', bookTitle: 'Gleanings', citation: '— Gleanings, 2:2.' },
      b: { snapshotText: 'father quote',  bookTitle: 'Malachi',   citation: '— Malachi, 2:10.' },
    },
  ];
}

describe('web xrefExport', () => {
  it('DOCX: Heading 1 per pair, one table per xref, quotes present', async () => {
    await exportAsDocx(rows());
    const buf = Buffer.from(await (capturedBlob as any).arrayBuffer());
    const xml = await (await JSZip.loadAsync(buf)).file('word/document.xml')!.async('string');
    expect([...xml.matchAll(/<w:pStyle w:val="(Heading\d)"\/>/g)].map(m => m[1])).toEqual(['Heading1']);
    expect((xml.match(/<w:tbl>/g) ?? []).length).toBe(2);
    expect(xml).toContain('unity quote');
    expect(xml).toContain('love quote');
  });

  it('DOCX: no bold run for the unlabelled xref alone, bold run when labelled', async () => {
    await exportAsDocx([rows()[1]]);
    let buf = Buffer.from(await (capturedBlob as any).arrayBuffer());
    let xml = await (await JSZip.loadAsync(buf)).file('word/document.xml')!.async('string');
    expect(xml).not.toContain('<w:b/>');
    await exportAsDocx([rows()[0]]);
    buf = Buffer.from(await (capturedBlob as any).arrayBuffer());
    xml = await (await JSZip.loadAsync(buf)).file('word/document.xml')!.async('string');
    expect(xml).toContain('<w:b/>');
  });

  it('CSV: 8-column header + one row per xref', async () => {
    await exportAsCsv(rows());
    const text = await (capturedBlob as any).text();
    const [header, ...body] = text.replace(/^﻿/, '').split('\n');
    expect(header).toBe('Pair,Label,Book A,Citation A,Quote A,Book B,Citation B,Quote B');
    expect(body).toHaveLength(2);
    expect(body[0]).toContain('Gleanings');
  });

  it('Markdown: heading per pair + arrow between quotes', async () => {
    await exportAsMarkdown(rows());
    const md = await (capturedBlob as any).text();
    expect(md).toContain("# Bahá'í ↔ Christianity");
    expect(md).toContain('**Love**');
    expect(md).toContain('\n↔\n');
    expect(md).toContain('> "unity quote"');
  });

  it('filename is "<title> <date>.<ext>"', async () => {
    await exportAsCsv(rows());
    expect(capturedName).toMatch(/ \d{4}-\d{2}-\d{2}\.csv$/);
  });
});
