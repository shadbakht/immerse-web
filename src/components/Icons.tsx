/**
 * SVG icon components that mirror the shapes from the mobile AnnotationIcons.js.
 * Each uses a fixed intrinsic viewBox; the `size` prop scales width/height.
 */

interface IconProps {
  color?: string;
  size?: number;
}

/** House silhouette: triangle roof + rectangle body (20×20 base) */
export function HomeIcon({ color = '#FFFFFF', size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill={color} xmlns="http://www.w3.org/2000/svg">
      {/* Roof triangle */}
      <polygon points="10,0 0,8 20,8" />
      {/* Body rectangle */}
      <rect x="3" y="9" width="14" height="10" />
    </svg>
  );
}

/** Four book spines at staggered heights (22×20 base) */
export function LibraryIcon({ color = '#FFFFFF', size = 20 }: IconProps) {
  // bw=4, gap=2, heights=[14,20,11,16]
  return (
    <svg width={size} height={size} viewBox="0 0 22 20" fill={color} xmlns="http://www.w3.org/2000/svg">
      <rect x="0"  y="6" width="4" height="14" rx="1" />
      <rect x="6"  y="0" width="4" height="20" rx="1" />
      <rect x="12" y="9" width="4" height="11" rx="1" />
      <rect x="18" y="4" width="4" height="16" rx="1" />
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
