/**
 * Geometry for the circular avatar cropper (mobile `AvatarCropModal`, web
 * `AvatarCropDialog`). Same code in the mobile repo, src/utils/avatarCrop.ts — change both.
 *
 * The photo is drawn centred behind a circle of diameter `D`. At zoom 1 it
 * just covers the circle (its short side = D); the user zooms (k ≥ 1) and
 * drags (tx, ty in screen points, measured from centred). The saved image is
 * the square that circumscribes the circle, so it shows as exactly what the
 * user framed once drawn round.
 */

export const MAX_ZOOM = 4;

export interface CropView {
  /** Source image size in pixels. */
  width: number;
  height: number;
  /** Circle diameter on screen. */
  diameter: number;
  /** User zoom, 1 … MAX_ZOOM. */
  zoom: number;
  /** Offset of the image centre from the circle centre, screen points. */
  tx: number;
  ty: number;
}

/** Screen points per source pixel at zoom 1 (short side fills the circle). */
export function baseScale(width: number, height: number, diameter: number): number {
  return diameter / Math.max(1, Math.min(width, height));
}

/** Largest |tx| / |ty| that still keeps the circle covered by the photo. */
export function maxOffset(width: number, height: number, diameter: number, zoom: number) {
  const s = baseScale(width, height, diameter) * zoom;
  return {
    x: Math.max(0, (width * s - diameter) / 2),
    y: Math.max(0, (height * s - diameter) / 2),
  };
}

export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(1, zoom));
}

export function clampOffset(v: number, max: number): number {
  return Math.min(max, Math.max(-max, v));
}

/** The square, in source pixels, that sits under the circle. */
export function cropRectFor(view: CropView) {
  const { width, height, diameter } = view;
  const zoom = clampZoom(view.zoom);
  const lim = maxOffset(width, height, diameter, zoom);
  const tx = clampOffset(view.tx, lim.x);
  const ty = clampOffset(view.ty, lim.y);
  const s = baseScale(width, height, diameter) * zoom;
  const side = Math.min(width, height, Math.round(diameter / s));
  // Circle centre in source pixels: image centre moved opposite to the drag.
  const cx = width / 2 - tx / s;
  const cy = height / 2 - ty / s;
  const originX = Math.round(Math.min(width - side, Math.max(0, cx - side / 2)));
  const originY = Math.round(Math.min(height - side, Math.max(0, cy - side / 2)));
  return { originX, originY, width: side, height: side };
}
