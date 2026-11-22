/**
 * SVG icon components that mirror the shapes in the mobile app's
 * AnnotationIcons.js. Each draws in a square `size` box.
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
 * Unified house (20×20 base). Filled: roof and walls are one silhouette with
 * the doorway cut out. Outline (`filled={false}`): the same two subpaths,
 * stroked — the unselected state, like mobile's HomeGlyph.
 *
 * The filled corner rounding comes from stroking the same path in the fill
 * colour with `strokeLinejoin="round"`: it rounds every join at once and,
 * because the stroke also runs round the doorway, rounds the door too.
 */
const HOUSE_BODY = 'M10 2L18.4 8.9L16.2 8.9L16.2 17.6L3.8 17.6L3.8 8.9L1.6 8.9Z';
const HOUSE_DOOR = roundedRect(8.2, 11.6, 3.6, 6, 0.9);

export function HomeIcon({ color = '#FFFFFF', size = 20, filled = true }: IconProps & { filled?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {filled ? (
        <path d={`${HOUSE_BODY} ${HOUSE_DOOR}`} fill={color} fillRule="evenodd"
          stroke={color} strokeWidth={1.3} strokeLinejoin="round" />
      ) : (
        <path d={`${HOUSE_BODY} ${HOUSE_DOOR}`} fill="none"
          stroke={color} strokeWidth={1.4} strokeLinejoin="round" />
      )}
    </svg>
  );
}

/* ─── Shared 24×24 grid — byte-for-byte the mobile geometry ────────────────
 *
 * Mirrors Immerse/src/components/AnnotationIcons.js. Change both together:
 * the point of this set is that a user learns ONE mark per type on every
 * platform.
 */
const STROKE = 1.6;

/** `filled`: solid + glyph (selected / tiles). `outline`: type-colour outline
 *  on a pale wash, glyph in the outline colour (unselected nav). */
type Variant = 'filled' | 'outline';

interface MarkProps extends IconProps {
  /** Show the glyph inside. Defaults to on above 16px; at or below, the bare
   *  silhouette reads better (reader margin, list rows). */
  glyph?: boolean;
  variant?: Variant;
  /** Outline variant only. */
  strokeColor?: string;
  insideColor?: string;
}

/** #RRGGBB blended toward another #RRGGBB by t. */
function mixHex(a: string, b: string, t: number) {
  const pa = a.replace('#', ''), pb = b.replace('#', '');
  return '#' + [0, 2, 4].map(i => {
    const v = Math.round(parseInt(pa.slice(i, i + 2), 16) * (1 - t) + parseInt(pb.slice(i, i + 2), 16) * t);
    return v.toString(16).padStart(2, '0');
  }).join('');
}

type Kind = 'tag' | 'note' | 'xref';

const MARK_BODY: Record<Kind, string> = {
  // Pennant, pointy side right.
  tag:  'M5.5 4.5H16L22 12L16 19.5H5.5A3.5 3.5 0 0 1 2 16V8A3.5 3.5 0 0 1 5.5 4.5Z',
  // Rounded note with the bottom-right corner turned up (the dog-ear).
  note: 'M5.5 4.5H18.5A3.5 3.5 0 0 1 22 8V14.5L17 19.5H5.5A3.5 3.5 0 0 1 2 16V8A3.5 3.5 0 0 1 5.5 4.5Z',
  // Hexagon.
  xref: 'M6 4.5H18L22 12L18 19.5H6L2 12Z',
};
const NOTE_FOLD = 'M22 14.5H18.5A1.5 1.5 0 0 0 17 16V19.5';

function MarkGlyph({ kind, color }: { kind: Kind; color: string }) {
  if (kind === 'tag') {
    // A quote mark: "quotes filed under a label".
    return (
      <>
        <circle cx="8" cy="10.6" r="1.75" fill={color} />
        <circle cx="12.6" cy="10.6" r="1.75" fill={color} />
        <path d="M9.75 10.9C9.75 12.9 8.8 14.3 7.2 15M14.35 10.9C14.35 12.9 13.4 14.3 11.8 15"
          fill="none" stroke={color} strokeWidth={1.4} strokeLinecap="round" />
      </>
    );
  }
  if (kind === 'note') {
    return <path d="M6.2 9.6H16.4M6.2 13.6H12.4" fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" />;
  }
  // Exchange arrows: "these two refer to each other".
  return (
    <path d="M7.5 10H16M14 8L16 10L14 12M16.5 14H8M10 12L8 14L10 16"
      fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
  );
}

/**
 * One annotation mark. Square box of `size` px. SVG content never mirrors in
 * an RTL page, so the tag's point and the arrows keep their direction.
 *
 * The glyph on a filled Compilation / X-ref is `currentColor`, and the svg
 * carries `text-white dark:text-[#D5DADF]`: white in light mode, light grey in
 * dark mode (pure white was too stark there — owner's call, same as mobile).
 * Pass `glyphClassName` to override, e.g. on the always-dark sidebar.
 */
function AnnotationMark({
  kind, color, size = 20, glyph, variant = 'filled', strokeColor, insideColor, glyphClassName,
}: MarkProps & { kind: Kind; color: string; glyphClassName?: string }) {
  const showGlyph = glyph ?? size > 16;
  const filled = variant === 'filled';
  const edge = filled ? mixHex(color, '#000000', 0.22) : (strokeColor ?? color);
  const glyphColor = !filled ? edge : kind === 'note' ? mixHex(color, '#000000', 0.62) : 'currentColor';
  return (
    <svg
      width={size} height={size} viewBox="1.2 1.2 21.6 21.6"
      xmlns="http://www.w3.org/2000/svg" aria-hidden="true"
      className={glyphClassName ?? 'text-white dark:text-[#D5DADF]'}
    >
      <path d={MARK_BODY[kind]} fill={filled ? color : (insideColor ?? 'none')}
        stroke={edge} strokeWidth={filled ? 1 : STROKE} strokeLinejoin="round" />
      {kind === 'note' && (
        <path d={NOTE_FOLD} fill="none" stroke={edge} strokeWidth={filled ? 1 : STROKE} strokeLinejoin="round" />
      )}
      {showGlyph && <MarkGlyph kind={kind} color={glyphColor} />}
    </svg>
  );
}

type MarkIconProps = MarkProps & { glyphClassName?: string };

/** Compilation: tag + quote mark. */
export function TagIcon({ color = '#5B8EC4', ...rest }: MarkIconProps) {
  return <AnnotationMark kind="tag" color={color} {...rest} />;
}

/** Note: dog-eared note + two written lines. */
export function NoteIcon({ color = '#D4BC6A', ...rest }: MarkIconProps) {
  return <AnnotationMark kind="note" color={color} {...rest} />;
}

/** X-ref: hexagon + exchange arrows. */
export function XRefIcon({ color = '#5A9460', ...rest }: MarkIconProps) {
  return <AnnotationMark kind="xref" color={color} {...rest} />;
}

/**
 * Library: two upright books and a third leaning back against them, on a
 * shelf line (24×24). The lean is what stops three uprights reading as a bar
 * chart. Mirrors mobile's LibraryGlyph.
 */
const SHELF_Y = 20;

export function LibraryIcon({ color = '#C1605A', size = 20, filled = true }: IconProps & { filled?: boolean }) {
  const half = filled ? 0 : STROKE / 2;
  const p = filled
    ? { fill: color }
    : { fill: 'none', stroke: color, strokeWidth: STROKE, strokeLinejoin: 'round' as const };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x={2 + half} y={5 + half} width={4.8 - 2 * half} height={SHELF_Y - 5 - 2 * half} rx={1} {...p} />
      <rect x={7.8 + half} y={3 + half} width={4.8 - 2 * half} height={SHELF_Y - 3 - 2 * half} rx={1} {...p} />
      <rect x={17.7 + half} y={6.2 + half} width={4.8 - 2 * half} height={13.8 - 2 * half} rx={1} {...p}
        transform={`rotate(-18 ${17.7 + half} ${SHELF_Y - half})`} />
      <path d="M1.5 21.4H22.5" stroke={color} strokeWidth={STROKE} strokeLinecap="round" />
    </svg>
  );
}

/**
 * Discover: two people — "other readers' work", which the old globe never
 * said (it read as language / region). The person behind is two open arcs.
 * Mirrors mobile's DiscoverGlyph.
 */
const PERSON_FRONT_BODY = 'M3 20.5V18.9A4.6 4.6 0 0 1 7.6 14.3H10.4A4.6 4.6 0 0 1 15 18.9V20.5';
const PERSON_BACK = 'M15.9 3.9A3.6 3.6 0 0 1 15.9 10.9M21 20.5V18.9A4.6 4.6 0 0 0 17.7 14.5';

export function DiscoverIcon({ color = '#1B6B7B', size = 20, filled = true }: IconProps & { filled?: boolean }) {
  const line = { stroke: color, strokeWidth: filled ? 2 : STROKE, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="9" cy="7.4" r="3.6" fill={filled ? color : 'none'} {...line} />
      <path d={filled ? `${PERSON_FRONT_BODY}Z` : PERSON_FRONT_BODY} fill={filled ? color : 'none'} {...line} />
      <path d={PERSON_BACK} fill="none" {...line} />
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
