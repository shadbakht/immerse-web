/**
 * SVG icon components that mirror the shapes from the mobile AnnotationIcons.js.
 * Each uses a fixed intrinsic viewBox; the `size` prop scales width/height.
 */

interface IconProps {
  color?: string;
  size?: number;
}

/**
 * Rounded-rectangle path data, for icons built from a single <path>.
 *
 * ⭐ Nav icons that need a cut-out MUST punch it with `fillRule="evenodd"` on
 * one path, never by painting a second shape in the background colour — the
 * sidebar's navy would then show through as a solid patch anywhere the icon is
 * reused on a different surface.
 */
function roundedRect(x: number, y: number, w: number, h: number, r: number) {
  const rx = Math.min(r, w / 2);
  const ry = Math.min(r, h / 2);
  return (
    `M${x + rx},${y}` +
    `H${x + w - rx}A${rx},${ry} 0 0 1 ${x + w},${y + ry}` +
    `V${y + h - ry}A${rx},${ry} 0 0 1 ${x + w - rx},${y + h}` +
    `H${x + rx}A${rx},${ry} 0 0 1 ${x},${y + h - ry}` +
    `V${y + ry}A${rx},${ry} 0 0 1 ${x + rx},${y}Z`
  );
}

/**
 * Unified filled house — roof and walls are one silhouette, with the doorway
 * cut out of it (20×20 base). Mirrors the HomeIcon in AnnotationIcons.js.
 *
 * The corner rounding comes from stroking the same path in the fill colour
 * with `strokeLinejoin="round"`: it rounds every join at once (apex, eaves,
 * base) and, because the stroke also runs round the doorway subpath, it
 * rounds the door and leaves a hairline threshold at its foot.
 */
const HOUSE_BODY = 'M10 2L18.4 8.9L16.2 8.9L16.2 17.6L3.8 17.6L3.8 8.9L1.6 8.9Z';
const HOUSE_DOOR = roundedRect(8.2, 11.6, 3.6, 6, 0.9);

export function HomeIcon({ color = '#FFFFFF', size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
      <path
        d={`${HOUSE_BODY} ${HOUSE_DOOR}`}
        fill={color}
        fillRule="evenodd"
        stroke={color}
        strokeWidth={1.3}
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Three solid book spines on a shared baseline, each with a cover band cut out
 * near its top (24×20 base). Mirrors the LibraryIcon in AnnotationIcons.js.
 *
 * `size` is the height, and the caller is expected to pass a slightly larger
 * size than the other nav icons — three narrow uprights read lighter than one
 * solid mass at the same nominal size, which is what made the old four-bar
 * version disappear next to the tag, note and xref shapes.
 */
const LIBRARY_VB = { w: 24, h: 20 };
const LIBRARY_SPINES = [
  { x: 0.7,  top: 4.6 },
  { x: 8.9,  top: 1.6 },
  { x: 17.1, top: 6.4 },
];
const LIBRARY_PATH = [
  // Spines first, then the cover bands — one path, so evenodd punches them out.
  ...LIBRARY_SPINES.map(s => roundedRect(s.x, s.top, 6.2, 19 - s.top, 1.4)),
  ...LIBRARY_SPINES.map(s => roundedRect(s.x + 1.3, s.top + 2.6, 3.6, 1.4, 0.7)),
].join(' ');

export function LibraryIcon({ color = '#C1605A', size = 20 }: IconProps) {
  return (
    <svg width={(size * LIBRARY_VB.w) / LIBRARY_VB.h} height={size} viewBox="0 0 24 20" xmlns="http://www.w3.org/2000/svg">
      <path d={LIBRARY_PATH} fill={color} fillRule="evenodd" />
    </svg>
  );
}

/**
 * Discover: a semi-solid globe (20×20 base) — a filled disc with one meridian
 * and the equator carved out of it, at a single line weight. Mirrors
 * DiscoverIcon in AnnotationIcons.js, and replaces the 🌐 emoji that used to
 * sit in this row, whose shading and detail made it the loudest thing in the
 * sidebar.
 *
 * ⚠️ The graticule is a MASK, not `fillRule="evenodd"` like the house door and
 * the book bands. Evenodd counts crossings, so wherever the meridian and the
 * equator overlap the count returns to odd and the cut fills back in — the
 * lines grow a solid blob at each intersection. A mask has no such arithmetic.
 * The disc is what gets painted, so nothing can spill outside radius 9.
 *
 * The mask id is fixed rather than generated: every instance defines the same
 * geometry in the same viewBox units, so two of them resolving to one id is
 * harmless, and a stable id survives SSR/hydration without a mismatch.
 */
const GLOBE_MASK_ID = 'immerseDiscoverGlobe';

export function DiscoverIcon({ color = '#3FB6CE', size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <mask id={GLOBE_MASK_ID}>
          <circle cx="10" cy="10" r="9" fill="#fff" />
          {/* Meridian — an ellipse, so the disc reads as a sphere, not a wheel */}
          <ellipse cx="10" cy="10" rx="3.6" ry="9" fill="none" stroke="#000" strokeWidth={1.5} />
          {/* Equator — stops just inside the rim so it can't notch the edge */}
          <path d="M1.03 10H18.97" stroke="#000" strokeWidth={1.5} />
        </mask>
      </defs>
      <circle cx="10" cy="10" r="9" fill={color} mask={`url(#${GLOBE_MASK_ID})`} />
    </svg>
  );
}

/**
 * Price-tag shape: rectangle body + right-pointing triangular tip (28×20 base).
 * Mirrors the TagIcon in AnnotationIcons.js.
 */
export function TagIcon({ color = '#5B8EC4', size = 20 }: IconProps) {
  // body=21, tip=7 → total width=28
  return (
    <svg width={size} height={size} viewBox="0 0 28 20" fill={color} xmlns="http://www.w3.org/2000/svg">
      <polygon points="0,0 21,0 28,10 21,20 0,20" />
    </svg>
  );
}

/**
 * Filled rectangle — same proportions as TagIcon (28×20 base).
 * Mirrors the NoteIcon in AnnotationIcons.js.
 */
export function NoteIcon({ color = '#D4BC6A', size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 20" fill={color} xmlns="http://www.w3.org/2000/svg">
      <rect width="28" height="20" rx="3" />
    </svg>
  );
}

/**
 * Hexagon: left triangle + rectangle + right triangle (28×20 base).
 * Mirrors the XRefIcon in AnnotationIcons.js.
 */
export function XRefIcon({ color = '#5A9460', size = 20 }: IconProps) {
  // tip=6, body=16 → total width=28
  return (
    <svg width={size} height={size} viewBox="0 0 28 20" fill={color} xmlns="http://www.w3.org/2000/svg">
      <polygon points="0,10 6,0 22,0 28,10 22,20 6,20" />
    </svg>
  );
}

/**
 * Two concentric rings + centre dot (20×20 base).
 * Mirrors the CommunityIcon in AnnotationIcons.js.
 */
export function CommunityIcon({ color = '#FFFFFF', size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Outer ring */}
      <circle cx="10" cy="10" r="9"   stroke={color} strokeWidth="2" />
      {/* Inner ring */}
      <circle cx="10" cy="10" r="4.5" stroke={color} strokeWidth="2" />
      {/* Centre dot */}
      <circle cx="10" cy="10" r="2"   fill={color} />
    </svg>
  );
}

/**
 * Gear: ring body + 6 rectangular teeth radiating outward (20×20 base).
 * Mirrors the SettingsIcon in AnnotationIcons.js.
 */
export function SettingsIcon({ color = '#FFFFFF', size = 20 }: IconProps) {
  const angles = [0, 60, 120, 180, 240, 300];
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* 6 teeth: each 4×4 rect centred at (10, 3.2), rotated around (10,10) */}
      {angles.map((a) => (
        <rect
          key={a}
          x="8" y="1.2" width="4" height="4"
          rx="1.5"
          fill={color}
          transform={`rotate(${a} 10 10)`}
        />
      ))}
      {/* Ring — drawn on top to cover tooth roots */}
      <circle cx="10" cy="10" r="4.2" stroke={color} strokeWidth="2.2" />
    </svg>
  );
}
