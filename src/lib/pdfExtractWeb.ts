/**
 * pdfExtractWeb.ts — Extract text from a (text-based) PDF using pdf.js,
 * directly in the browser main thread (no WebView hack needed — unlike
 * mobile's src/utils/pdfExtract.ts, which has to run pdf.js inside a hidden
 * WebView because Expo/Hermes has no native Worker/DOM environment, web
 * already IS one).
 *
 * Paragraph reconstruction mirrors mobile's algorithm exactly (same median-
 * line-gap heuristic) so imported-PDF chunking looks the same on both
 * platforms: group text runs into lines by y-position, order top-to-bottom,
 * then merge consecutive lines into a paragraph unless the vertical gap is
 * unusually large relative to the page's typical line spacing.
 */

import type { TextItem } from 'pdfjs-dist/types/src/display/api';

interface Run { x: number; y: number; s: string; }
interface Line { y: number; text: string; }

function reconstructParagraphs(items: TextItem[]): string[] {
  const runs: Run[] = [];
  for (const it of items) {
    if (!it || typeof it.str !== 'string' || !it.transform) continue;
    runs.push({ x: it.transform[4], y: it.transform[5], s: it.str });
  }
  if (runs.length === 0) return [];

  // Group into lines by y (within a small tolerance), runs ordered left-to-right.
  const lines: { y: number; runs: Run[] }[] = [];
  let cur: { y: number; runs: Run[] } | null = null;
  for (const r of runs) {
    if (cur && Math.abs(cur.y - r.y) <= 3) {
      cur.runs.push(r);
    } else {
      if (cur) lines.push(cur);
      cur = { y: r.y, runs: [r] };
    }
  }
  if (cur) lines.push(cur);

  const lineObjs: Line[] = lines
    .map(l => {
      l.runs.sort((a, b) => a.x - b.x);
      return { y: l.y, text: l.runs.map(r => r.s).join('').replace(/\s+/g, ' ').trim() };
    })
    .filter(l => l.text.length > 0);

  // PDF y grows upward → sort descending for reading order.
  lineObjs.sort((a, b) => b.y - a.y);
  if (lineObjs.length === 0) return [];

  // Median gap between consecutive lines → paragraph break when gap is much larger.
  const gaps: number[] = [];
  for (let k = 1; k < lineObjs.length; k++) gaps.push(Math.abs(lineObjs[k - 1].y - lineObjs[k].y));
  let medianGap = 0;
  if (gaps.length) {
    const sorted = [...gaps].sort((a, b) => a - b);
    medianGap = sorted[Math.floor(sorted.length / 2)] || 0;
  }
  const breakGap = medianGap > 0 ? medianGap * 1.6 : Infinity;

  const paras: string[] = [];
  let buf = lineObjs[0].text;
  for (let m = 1; m < lineObjs.length; m++) {
    const gap = Math.abs(lineObjs[m - 1].y - lineObjs[m].y);
    if (gap > breakGap) {
      paras.push(buf);
      buf = lineObjs[m].text;
    } else {
      // Join wrapped lines; merge hyphenated word breaks.
      if (/[A-Za-z]-$/.test(buf)) buf = buf.replace(/-$/, '') + lineObjs[m].text;
      else buf += ' ' + lineObjs[m].text;
    }
  }
  if (buf.trim()) paras.push(buf);
  return paras;
}

/**
 * Extract reflowed paragraphs from a PDF File. Returns [] on any failure or
 * when the PDF has no extractable text (scanned/image PDFs) — callers treat
 * [] as "not text-based" and fall back to the raw-Blob view-only path.
 */
export async function extractPdfText(file: File): Promise<string[]> {
  try {
    const pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;

    const allParas: string[] = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const tc = await page.getTextContent();
      allParas.push(...reconstructParagraphs(tc.items as TextItem[]));
    }
    return allParas;
  } catch (err) {
    console.error('[pdfExtractWeb] extraction failed:', err);
    return [];
  }
}
