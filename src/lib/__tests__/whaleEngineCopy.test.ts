import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';

// src/lib/whalie/whaleEngine.js is a BYTE-IDENTICAL copy of the mobile app's
// src/reader/whaleEngine.js (Immerse repo, the source of truth). When mobile
// changes it, re-copy that file verbatim and update this hash — never edit
// the web copy by hand.
const MOBILE_WHALE_ENGINE_SHA256 =
  'a276c558571f7c9dfd16fbed4c8dc39b76e4af0e519653a35876965c56f5a253';

describe('whaleEngine.js copy', () => {
  it('is byte-identical to mobile src/reader/whaleEngine.js', () => {
    const bytes = readFileSync(join(__dirname, '..', 'whalie', 'whaleEngine.js'));
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(MOBILE_WHALE_ENGINE_SHA256);
  });

  it('exports the engine API', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const engine = require('../whalie/whaleEngine');
    expect(typeof engine.createWhalie).toBe('function');
    expect(typeof engine.stepWhalie).toBe('function');
    expect(Object.keys(engine.WHALE_PALETTES).sort()).toEqual(['night', 'paper', 'sepia']);
  });
});
