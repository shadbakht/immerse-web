'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from '@/contexts/LanguageProvider';
import { baseScale, clampOffset, clampZoom, cropRectFor, maxOffset, MAX_ZOOM } from '@/lib/avatarCrop';

/**
 * Circular cropper for the profile photo — web twin of mobile's
 * AvatarCropModal (same geometry, src/lib/avatarCrop.ts). Drag to move;
 * wheel, pinch-trackpad or the slider to zoom; arrow keys nudge. "Use Photo"
 * returns the square (source pixels) under the circle.
 */

type Rect = { originX: number; originY: number; width: number; height: number };

interface Props {
  file: File;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: (rect: Rect) => void;
}

const DIAMETER = 280;
const STAGE = 340;

export default function AvatarCropDialog({ file, busy, onCancel, onConfirm }: Props) {
  const { t } = useTranslation();
  const url = useMemo(() => URL.createObjectURL(file), [file]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);

  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [off, setOff] = useState({ x: 0, y: 0 });
  const drag = useRef<{ px: number; py: number; x: number; y: number } | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  const w = size?.w ?? 1;
  const h = size?.h ?? 1;
  const s0 = baseScale(w, h, DIAMETER);

  function apply(nextZoom: number, x: number, y: number) {
    const k = clampZoom(nextZoom);
    const lim = maxOffset(w, h, DIAMETER, k);
    setZoom(k);
    setOff({ x: clampOffset(x, lim.x), y: clampOffset(y, lim.y) });
  }

  // Zoom about the circle centre, so the framed point stays put.
  function zoomTo(next: number) {
    const k = clampZoom(next);
    const r = k / zoom;
    apply(k, off.x * r, off.y * r);
  }

  // React's onWheel is passive, so preventDefault (to stop the page scrolling) needs a native listener.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomTo(zoom * Math.exp(-e.deltaY * 0.002));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onCancel]);

  function onStageKey(e: React.KeyboardEvent) {
    const step = 10;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step],
    };
    if (moves[e.key]) { e.preventDefault(); apply(zoom, off.x + moves[e.key][0], off.y + moves[e.key][1]); }
    else if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomTo(zoom * 1.1); }
    else if (e.key === '-') { e.preventDefault(); zoomTo(zoom / 1.1); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-labelledby="avatar-crop-title">
      <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#16222E] shadow-xl overflow-hidden">
        <div className="px-5 pt-5 pb-3 text-center">
          <h2 id="avatar-crop-title" className="text-base font-semibold text-gray-900 dark:text-[#E2EAF2]">{t('settings.cropPhotoTitle')}</h2>
          <p className="mt-1 text-xs text-gray-500 dark:text-[#8FA4B8]">{t('settings.cropPhotoHintPointer')}</p>
        </div>

        <div
          ref={stageRef}
          tabIndex={0}
          onKeyDown={onStageKey}
          aria-label={t('settings.cropPhotoTitle')}
          className="relative mx-auto overflow-hidden bg-black touch-none select-none cursor-grab active:cursor-grabbing outline-none focus-visible:ring-2 focus-visible:ring-[#2D9DB3]"
          style={{ width: STAGE, height: STAGE, maxWidth: '100%' }}
          onPointerDown={e => {
            (e.target as Element).setPointerCapture?.(e.pointerId);
            drag.current = { px: e.clientX, py: e.clientY, x: off.x, y: off.y };
          }}
          onPointerMove={e => {
            const d = drag.current;
            if (d) apply(zoom, d.x + e.clientX - d.px, d.y + e.clientY - d.py);
          }}
          onPointerUp={() => { drag.current = null; }}
          onPointerCancel={() => { drag.current = null; }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt=""
            draggable={false}
            onLoad={e => setSize({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
            className="absolute left-1/2 top-1/2 max-w-none pointer-events-none"
            style={{
              width: w * s0,
              height: h * s0,
              transform: `translate(-50%, -50%) translate(${off.x}px, ${off.y}px) scale(${zoom})`,
              visibility: size ? 'visible' : 'hidden',
            }}
          />
          {/* Dim everything outside the circle; the huge shadow paints the surround. */}
          <div
            className="absolute left-1/2 top-1/2 rounded-full pointer-events-none border border-white/85"
            style={{ width: DIAMETER, height: DIAMETER, transform: 'translate(-50%, -50%)', boxShadow: '0 0 0 9999px rgba(0,0,0,0.6)' }}
          />
        </div>

        <div className="px-5 pt-4">
          <label className="flex items-center gap-3 text-xs text-gray-500 dark:text-[#8FA4B8]">
            <span>{t('settings.cropZoom')}</span>
            <input
              type="range"
              min={1}
              max={MAX_ZOOM}
              step={0.01}
              value={zoom}
              onChange={e => zoomTo(Number(e.target.value))}
              className="flex-1 accent-[#1B6B7B] dark:accent-[#2D9DB3]"
            />
          </label>
        </div>

        <div className="flex justify-end gap-3 px-5 py-4">
          <button onClick={onCancel} disabled={busy} className="text-sm px-3 py-1.5 rounded-lg text-gray-600 dark:text-[#8FA4B8] hover:bg-gray-100 dark:hover:bg-[#1E2D3A] disabled:opacity-50">
            {t('common.cancel')}
          </button>
          <button
            onClick={() => onConfirm(cropRectFor({ width: w, height: h, diameter: DIAMETER, zoom, tx: off.x, ty: off.y }))}
            disabled={busy || !size}
            className="text-sm px-3 py-1.5 rounded-lg font-semibold text-white bg-[#1B6B7B] dark:bg-[#2D9DB3] hover:opacity-90 disabled:opacity-50"
          >
            {busy ? t('common.saving') : t('settings.usePhoto')}
          </button>
        </div>
      </div>
    </div>
  );
}
