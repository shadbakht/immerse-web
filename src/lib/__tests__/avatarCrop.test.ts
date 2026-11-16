import { baseScale, cropRectFor, maxOffset, MAX_ZOOM } from '../avatarCrop';

describe('avatarCrop', () => {
  const D = 300;

  it('at zoom 1, centred, a landscape photo crops its centred square', () => {
    expect(cropRectFor({ width: 4000, height: 3000, diameter: D, zoom: 1, tx: 0, ty: 0 }))
      .toEqual({ originX: 500, originY: 0, width: 3000, height: 3000 });
  });

  it('zoom 2 halves the square around the centre', () => {
    expect(cropRectFor({ width: 3000, height: 3000, diameter: D, zoom: 2, tx: 0, ty: 0 }))
      .toEqual({ originX: 750, originY: 750, width: 1500, height: 1500 });
  });

  it('dragging the photo right shows more of its left side', () => {
    // 4000×3000 at zoom 1 is 0.1 pt/px, so the 500 px of spare width each side is 50 pt.
    const r = cropRectFor({ width: 4000, height: 3000, diameter: D, zoom: 1, tx: 50, ty: 0 });
    expect(r.originX).toBe(0);
  });

  it('clamps a drag past the edge so the circle stays covered', () => {
    const r = cropRectFor({ width: 4000, height: 3000, diameter: D, zoom: 1, tx: 9999, ty: -9999 });
    expect(r).toEqual({ originX: 0, originY: 0, width: 3000, height: 3000 });
  });

  it('clamps zoom to the maximum', () => {
    const a = cropRectFor({ width: 2000, height: 2000, diameter: D, zoom: 99, tx: 0, ty: 0 });
    const b = cropRectFor({ width: 2000, height: 2000, diameter: D, zoom: MAX_ZOOM, tx: 0, ty: 0 });
    expect(a).toEqual(b);
  });

  it('maxOffset is zero on the short axis at zoom 1', () => {
    expect(maxOffset(4000, 3000, D, 1)).toEqual({ x: 50, y: 0 });
    expect(baseScale(4000, 3000, D)).toBeCloseTo(0.1);
  });
});
