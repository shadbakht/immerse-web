import { readFileSync } from 'fs';
import { join } from 'path';

// Owner's rule: every overlay, sheet and panel in the reader draws ABOVE
// Whalie, so a click meant for one (e.g. the TOC backdrop that closes the TOC,
// or a TOC row) is never swallowed by his hit box. ReaderPanel is too heavy to
// mount here, so this pins the stacking order from the source: Whalie's
// z-index must be lower than every other z-index the reader declares.
// Comments are stripped first — they mention z-indexes in prose.
const src = readFileSync(join(__dirname, '..', 'ReaderPanel.tsx'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

const zOf = (cls: string) => Number(cls.replace(/^z-\[?/, '').replace(/\]$/, ''));

describe('ReaderPanel — Whalie stacking', () => {
  const layer = src.match(/<WhalieLayer[\s\S]*?\/>/);
  const whalieZ = layer?.[0].match(/\bz-(?:\[\d+\]|\d+)/)?.[0];

  it('renders WhalieLayer with an explicit z-index', () => {
    expect(whalieZ).toBeDefined();
  });

  it('puts Whalie below every other z-index in the reader (TOC backdrop z-10 included)', () => {
    const rest = src.replace(layer![0], '');
    const others = Array.from(rest.matchAll(/(?<![\w-])z-(?:\[\d+\]|\d+)\b/g), m => zOf(m[0]));
    expect(others).toContain(10); // the TOC backdrop — sanity check that the scan sees overlays
    expect(zOf(whalieZ!)).toBeGreaterThan(0);
    expect(zOf(whalieZ!)).toBeLessThan(Math.min(...others));
  });
});
