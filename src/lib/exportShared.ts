import { HeadingLevel } from 'docx';

export const DOC_PRIMARY = '1B6B7B';
export const DOC_BODY    = '1C2B35';
export const DOC_MUTED   = '6B7280';
export const DOC_FAINT   = '9CA3AF';
export const DOC_DIVIDER = 'D1D5DB';

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function safeFilename(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, '').replace(/\s+/g, ' ').trim() || 'export';
}

export function citationInParens(raw: string): string {
  if (!raw) return '';
  return `(${raw.replace(/^—\s*/, '').replace(/\.$/, '')})`;
}

export function citationBare(raw: string): string {
  if (!raw) return '';
  return raw.replace(/^—\s*/, '').replace(/\.$/, '');
}

export function csvField(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const DEPTH_HEADING = [
  HeadingLevel.HEADING_1,
  HeadingLevel.HEADING_2,
  HeadingLevel.HEADING_3,
  HeadingLevel.HEADING_4,
  HeadingLevel.HEADING_5,
  HeadingLevel.HEADING_6,
] as const;

export function depthHeading(depth: number): (typeof DEPTH_HEADING)[number] {
  return DEPTH_HEADING[Math.min(Math.max(depth, 0), DEPTH_HEADING.length - 1)];
}
