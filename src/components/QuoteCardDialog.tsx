'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from '@/contexts/LanguageProvider';
import { quoteCardBackgroundUrl } from '@/lib/quoteCardBackground';
import { layoutQuoteCard, CARD_W, CARD_H, CARD_SCALE } from '@/lib/quoteCardLayout';

/**
 * Share a passage as a quote card — the web twin of the mobile Daily Reading
 * card's share mode (DailyReadingCardScreen `share`): the selection and its
 * citation on the parchment over the day's photo, drawn to a 1080×1350 canvas.
 * The corner icon shares the PNG through the browser's share sheet where it
 * can (navigator.share with files), and downloads it everywhere else.
 */
export default function QuoteCardDialog({
  text, citation, bookTitle, language, onClose,
}: {
  text: string;
  citation: string;
  bookTitle: string;
  language: string | null | undefined;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const canvas = document.createElement('canvas');
      canvas.width = CARD_W;
      canvas.height = CARD_H;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      await loadCardFonts();
      const bg = await loadImage(quoteCardBackgroundUrl(new Date())).catch(() => null);
      drawCard(ctx, bg, `“${text.trim()}”`, citation, language);
      if (cancelled) return;
      canvasRef.current = canvas;
      setPreview(canvas.toDataURL('image/png'));
    })();
    return () => { cancelled = true; };
  }, [text, citation, language]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function handleShare() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) return;
    const name = `${(bookTitle || 'Immerse').replace(/[\\/:*?"<>|]/g, ' ').trim()}.png`;
    const file = new File([blob], name, { type: 'image/png' });
    if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file] }); } catch { /* dismissed */ }
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="flex items-center justify-between px-4 py-3" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onClose}
          aria-label={t('common.cancel')}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path d="M3 3 L15 15 M15 3 L3 15" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        </button>
        <button
          onClick={handleShare}
          disabled={!preview}
          aria-label={t('reminders.shareCard')}
          title={t('reminders.shareCard')}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25 disabled:opacity-50"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
            <path d="M10 12 V2.5 M6.5 6 L10 2.5 L13.5 6 M4.5 9 V16 H15.5 V9" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
        </button>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center px-4 pb-6">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element -- a canvas data URL, not a static asset
          <img
            src={preview}
            alt={`“${text.trim()}” ${citation}`}
            onClick={(e) => e.stopPropagation()}
            className="max-h-full max-w-full object-contain shadow-2xl"
            style={{ aspectRatio: `${CARD_W} / ${CARD_H}` }}
          />
        ) : (
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white" />
        )}
      </div>
    </div>
  );
}

const FONT_FAMILY = 'EB Garamond Card';
// A canvas font-style keyword, not interface text.
const ITALIC = 'italic';

async function loadCardFonts(): Promise<void> {
  if (typeof FontFace === 'undefined') return;
  const faces = [
    new FontFace(FONT_FAMILY, 'url(/fonts/ebgaramond-roman.woff2)', { style: 'normal' }),
    new FontFace(FONT_FAMILY, 'url(/fonts/ebgaramond-italic.woff2)', { style: 'italic' }),
  ];
  await Promise.all(faces.map(async (f) => {
    try { document.fonts.add(await f.load()); } catch { /* fall back to the serif default */ }
  }));
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function drawCard(
  ctx: CanvasRenderingContext2D,
  bg: HTMLImageElement | null,
  quote: string,
  citation: string,
  language: string | null | undefined,
) {
  const S = CARD_SCALE;
  // Photo, cover-fit.
  if (bg) {
    const k = Math.max(CARD_W / bg.width, CARD_H / bg.height);
    const w = bg.width * k, h = bg.height * k;
    ctx.drawImage(bg, (CARD_W - w) / 2, (CARD_H - h) / 2, w, h);
  } else {
    ctx.fillStyle = '#C9A46A';
    ctx.fillRect(0, 0, CARD_W, CARD_H);
  }
  // Parchment and its double rule.
  const pad = CARD_W * 0.08;
  const px = pad, py = pad, pw = CARD_W - pad * 2, ph = CARD_H - pad * 2;
  ctx.fillStyle = 'rgba(250, 248, 242, 0.96)';
  ctx.fillRect(px, py, pw, ph);
  ctx.lineWidth = S;
  ctx.strokeStyle = 'rgba(120, 100, 60, 0.55)';
  ctx.strokeRect(px + 8 * S, py + 8 * S, pw - 16 * S, ph - 16 * S);
  ctx.strokeStyle = 'rgba(120, 100, 60, 0.35)';
  ctx.strokeRect(px + 11 * S, py + 11 * S, pw - 22 * S, ph - 22 * S);

  // Text, sized to fit like mobile's useFitFontSize.
  const box = { x: px + 24 * S, y: py + 24 * S, w: pw - 48 * S, h: ph - 48 * S };
  const measure = (s: string, font: string) => { ctx.font = font; return ctx.measureText(s).width; };
  const layout = layoutQuoteCard(quote, citation, box.w, box.h, language, (s, px2, italic) =>
    measure(s, `${italic ? ITALIC : ''} ${px2}px "${FONT_FAMILY}", Georgia, serif`));

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  let y = box.y + (box.h - layout.height) / 2;
  ctx.fillStyle = '#2b2620';
  ctx.font = `${layout.quotePx}px "${FONT_FAMILY}", Georgia, serif`;
  for (const line of layout.quoteLines) {
    y += layout.quoteLineH;
    ctx.fillText(line, CARD_W / 2, y - layout.quoteLineH * 0.28);
  }
  if (layout.citationLines.length) {
    y += layout.citationGap;
    ctx.fillStyle = '#4a4438';
    ctx.font = `italic ${layout.citationPx}px "${FONT_FAMILY}", Georgia, serif`;
    for (const line of layout.citationLines) {
      y += layout.citationLineH;
      ctx.fillText(line, CARD_W / 2, y - layout.citationLineH * 0.28);
    }
  }

  // Watermark — English in every locale, like mobile's card (allow-listed).
  ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
  ctx.font = `italic ${10 * S}px "${FONT_FAMILY}", Georgia, serif`;
  ctx.fillText('Made with Immerse Research', CARD_W / 2, CARD_H - 7 * S);
}
