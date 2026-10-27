/**
 * Whalie — the opt-in pixel-art whale that swims along the bottom of the reader.
 *
 * ⚠️ PLAIN JAVASCRIPT ON PURPOSE, AND NOT BUNDLED — the same rules as
 * src/reader/readerEngine.js. Read that file's header before editing.
 *
 * HOW IT REACHES THE WEBVIEW
 * --------------------------
 * `scripts/buildReaderEngine.mjs` reads this file VERBATIM and writes its text
 * into src/reader/whaleEngineSource.ts (`WHALE_SOURCE`), which the reader and
 * Appearance-preview WebViews splice into their <script>. Run
 * `npm run build:reader-engine` after every edit; a test fails if the
 * generated file is stale. Never serialise functions with
 * Function.prototype.toString — Hermes discards function source.
 * The web app keeps a byte-identical copy of this file.
 *
 * CONSTRAINTS (enforced by src/reader/__tests__/whaleEngine.test.ts)
 *   1. Plain ES5: `var`, `function`. No arrows, let/const, spread, optional
 *      chaining, template literals, import/export.
 *   2. Self-contained. Every helper lives inside one IIFE so names such as
 *      `T`, `rot` or `hermite` cannot collide with readerHtml.ts's globals;
 *      only the public names below are declared at top level.
 *   3. The trailing guarded `module.exports` is for tests and the web copy;
 *      `module` is undefined in the WebView, so splicing it is harmless.
 *
 * SOURCE OF TRUTH FOR LOOK AND MOTION
 * -----------------------------------
 * docs/superpowers/specs/2026-10-26-whale-companion-prototype.html (approved).
 * RAW, the eye overlay, T, SP, JOINTS, hermite, the breach and turnAround
 * keyframes, blink, the underlay pass, the spout and the water line are copied
 * from it value-for-value. Do not retune. What differs, deliberately:
 *   - the prototype's fixed 390 pt stage width is the live canvas width;
 *   - its tween/setTimeout chains are mode timers inside stepWhalie (pure, so
 *     motion is testable without requestAnimationFrame);
 *   - drawing is crisp: the canvas is cssWidth*dpr × 128*dpr, image smoothing
 *     off, and every block is an axis-aligned rectangle snapped to whole
 *     device pixels (the prototype drew soft, rotated, non-DPR blocks);
 *   - the background is left transparent — he swims over the text;
 *   - `floor` (height of the bottom chrome, eased over 0.4 s) moves the canvas
 *     itself (CSS bottom); inside it he is drawn as if the floor were 0.
 *
 * Public API
 *   WHALE_SPRITE        string[29] of 60 chars, final grid incl. eye overlay
 *   WHALE_PALETTES      { paper, sepia, night }
 *   whalePaletteFor(themeKey)  'light'|'quiet' → paper, 'sepia' → sepia,
 *                              'dark'|'night' → night ('system' is resolved by
 *                              the caller first)
 *   newWhalieState(width, opts?)  opts: { x, facing: 'left'|'right', reduceMotion,
 *                              palette, floor }; x/facing random when omitted
 *   stepWhalie(state, dtSeconds, width) → state   (dt clamped to 0.05 s)
 *   createWhalie(host, { palette, floor, reduceMotion, onLog })
 *     → { setPalette, setFloor, setReduceMotion, setPaused, breach, destroy, _state }
 */

/* eslint-disable no-var -- `var` is deliberate: this file is spliced RAW into a
   WebView <script> and never transpiled. See constraint 1 above. */

var whalieEngine = (function () {
  // ─── Sprite (prototype RAW + EYE, verbatim) ─────────────────────────────────

  var RAW = ['............................................ooo.............', '...........................................oodoo............', '...........................................odddo............', '...........................................oddoo............', '..........................................ooddoo............', '...............ooooooo....................oddddo............', '........oooooooodddddooooooo..............oodddooooooooooo..', '......oooddddddddddddddddddoooo............oddddddddddddddo.', '....ooodddddddddddddddddddddddoooo.........oddddddddddddoo..', '..oooddddddddddddddddddddddddddddoooo....ooodddddddddddoo...', '.oodddddddddddddddddddddddddddddddddoooooodddddddddddooo....', 'oodddddddddddeedddddddddddddddddddddddddddddddddoooooo......', 'odddddddddddexeeddddddddddddddddddddddddddddbbooo...........', 'odddddddddddeeeedddddddddddddddddddddddddddbboo.............', 'oddddddddddddeeddddddddddddddddddddddddddbbboo..............', 'oooddddddddddddddddddddddddddddddddddddbbbboo...............', 'oobggggggggggddddddddddddddddddddddddbbbbbdo................', '.oobbbbbbbbbbbbddooodddddddddddddddbbbbbbooo................', '..oobgggggggggggofffoodddddddddddbbbbbbboo..................', '...oobbbbbbbbbbbboffffodddddddbbbbbbbbooo...................', '....ooobgggggggggofffffogbbbbbbbbbbbboo.....................', '......ooobbbbbbbbbofffffoobbbbbbbboooo......................', '........ooooobgggggoffffffobbbbbooo.........................', '............oooooobboofffffoooooo...........................', '.............ollllooooofffffo...............................', '.............oolllllo..oofffo...............................', '..............ooolllo....ooo................................', '................oollo.......................................', '.................oooo.......................................'];
  var EYE = ['.eeee.', 'exxeee', 'exxeee', 'eeeeee', 'eeeexe', '.eeee.'];
  var ER = 10, EC = 11;

  var G = RAW.map(function (r) {
    return r.split('').map(function (ch) { return (ch == 'e' || ch == 'x') ? 'd' : ch; });
  });
  EYE.forEach(function (row, a) {
    row.split('').forEach(function (ch, b) { if (ch != '.') G[ER + a][EC + b] = ch; });
  });
  var SPRITE = G.map(function (row) { return row.join(''); });

  // ─── Palettes (prototype T, verbatim) ───────────────────────────────────────

  var T = {
    paper: { bg: '#fbfaf7', o: '#16222a', d: '#2f8b9a', f: '#2b7e8c', b: '#f3f6f7', g: '#cfd8dc', l: '#b6c3c9', e: '#0a0f14', x: '#ffffff', wave: '#7fb6c4' },
    sepia: { bg: '#f3e9d2', o: '#2a2a28', d: '#2f8b9a', f: '#2b7e8c', b: '#fbf6ea', g: '#ddd5c3', l: '#c4bfb2', e: '#0e0e0e', x: '#ffffff', wave: '#8fa9a2' },
    night: { bg: '#18191c', o: '#6c8590', d: '#2f8b9a', f: '#2b7e8c', b: '#e6eef0', g: '#b8c6cb', l: '#8a9aa0', e: '#06090c', x: '#ffffff', wave: '#4f8d9b' }
  };

  function paletteFor(themeKey) {
    if (themeKey == 'sepia') return 'sepia';
    if (themeKey == 'dark' || themeKey == 'night') return 'night';
    return 'paper';
  }

  // ─── Spine rig (prototype SP / JOINTS / tOf, verbatim) ──────────────────────

  function hyp(x, y) { return Math.sqrt(x * x + y * y); }

  var SP = [[0, 13], [8, 13], [16, 14], [24, 15], [32, 14], [38, 13], [42, 11], [44, 8], [45, 5], [45.5, 2]];
  var seg = [], tot = 0, i;
  for (i = 0; i < SP.length - 1; i++) {
    var len = hyp(SP[i + 1][0] - SP[i][0], SP[i + 1][1] - SP[i][1]);
    seg.push({ a: SP[i], b: SP[i + 1], s0: tot, l: len });
    tot += len;
  }
  function tOf(x, y) {
    var best = 1e9, bt = 0;
    for (var k = 0; k < seg.length; k++) {
      var g = seg[k];
      var dx = g.b[0] - g.a[0], dy = g.b[1] - g.a[1];
      var u = ((x - g.a[0]) * dx + (y - g.a[1]) * dy) / (g.l * g.l);
      u = Math.max(0, Math.min(1, u));
      var px = g.a[0] + dx * u, py = g.a[1] + dy * u, d = hyp(x - px, y - py);
      if (d < best) { best = d; bt = (g.s0 + u * g.l) / tot; }
    }
    return bt;
  }
  function tAt(n) { return seg[n].s0 / tot; }
  var JOINTS = [{ p: SP[3], t: tAt(3), k: 0.35, lag: 0 }, { p: SP[5], t: tAt(5), k: 0.6, lag: 0.5 }, { p: SP[7], t: tAt(7), k: 0.5, lag: 1.1 }];
  var T_FIN = tOf(18, 17);

  // Each sprite pixel is sampled SUB×SUB times; every sample bends with the spine.
  var SUB = 2, subs = [];
  G.forEach(function (row, r) {
    row.forEach(function (ch, c) {
      if (ch == '.') return;
      for (var a = 0; a < SUB; a++) {
        for (var b = 0; b < SUB; b++) {
          var x = c + (a + 0.5) / SUB, y = r + (b + 0.5) / SUB;
          var t = tOf(x, y);
          // Flippers stay rigid to the front of the body (only flipper pixels).
          if (r >= 18 && c < 30 && 'flo'.indexOf(ch) >= 0 && !(r <= 21 && ch == 'o' && c > 26)) t = Math.min(t, T_FIN);
          var bc = ch;
          if (ch == 'e' || ch == 'x') bc = (r == ER + 3) ? 'e' : 'd';
          subs.push({ x: x, y: y, ch: ch, t: t, blinkCh: bc });
        }
      }
    });
  });
  subs.sort(function (p, q) { return p.t - q.t; });

  // Per-sample screen positions, allocated once and reused every frame.
  // Float64Array keeps full double precision, so the output is unchanged.
  function buffer(len) { return typeof Float64Array != 'undefined' ? new Float64Array(len) : new Array(len); }
  var SX = buffer(subs.length), SY = buffer(subs.length);

  // ─── Per-frame cost (pixel output unchanged — pinned by the pixel golden) ───
  // Each sample's joint weights never change, so they are computed once here
  // with the very expression draw() used to evaluate every frame. A weight of
  // exactly 1 rotates by the joint's full angle, whose sin/cos draw() takes
  // once per frame; only samples inside a blend band need their own trig.
  var NJ = JOINTS.length, BEND_W = 0.14, NS = subs.length;
  var WGT = buffer(NS * NJ), PX = buffer(NS), PY = buffer(NS);
  for (i = 0; i < NS; i++) {
    PX[i] = subs[i].x; PY[i] = subs[i].y;
    for (var jk = 0; jk < NJ; jk++) WGT[i * NJ + jk] = sst((subs[i].t - JOINTS[jk].t) / BEND_W + 0.5);
  }
  // Joints k in [KLO[i], KHI[i]) are the only ones that move sample i
  // (weight > 0); a rotation by weight 0 is skipped today anyway.
  var KLO = [], KHI = [];
  for (i = 0; i < NS; i++) {
    var lo = NJ, hi = 0;
    for (jk = 0; jk < NJ; jk++) if (WGT[i * NJ + jk] > 0) { if (jk < lo) lo = jk; hi = jk + 1; }
    KLO.push(lo < hi ? lo : 0); KHI.push(lo < hi ? hi : 0);
  }
  var ANG = [], PIV = [], JS = [], JC = [];

  // Outline "bridges": every pair of outline samples that sit side by side
  // (across or down) in the sprite. On the outer curve of a strong bend (the
  // top of a breach) the two spread apart until the page shows between them —
  // the notch in his back. raster() paints a block at each pair's midpoint
  // BEFORE everything else, so a bridge shows only where nothing else drew:
  // in such a gap. Unbent, the two blocks overlap and the bridge stays hidden.
  var BRA = [], BRB = [];
  (function () {
    var at = {};
    for (var n = 0; n < NS; n++) if (subs[n].ch == 'o') at[subs[n].x * 2 + ',' + subs[n].y * 2] = n;
    for (n = 0; n < NS; n++) {
      if (subs[n].ch != 'o') continue;
      var kx = subs[n].x * 2, ky = subs[n].y * 2, m;
      m = at[(kx + 1) + ',' + ky]; if (m != null) { BRA.push(n); BRB.push(m); }
      m = at[kx + ',' + (ky + 1)]; if (m != null) { BRA.push(n); BRB.push(m); }
    }
  })();

  // Blocks are opaque, integer-aligned rectangles, so instead of thousands of
  // fillRect calls they are written, in the same order, into one reused RGBA
  // buffer over the whale's bounding box and put with one putImageData: later
  // writes overwrite earlier ones exactly as opaque fillRect does.
  var CODES = 'odfbglex';
  var UCH = [], MCH = [], BCH = [];
  for (i = 0; i < NS; i++) {
    var sc = subs[i].ch;
    UCH.push(sc == 'o' ? -1 : CODES.indexOf((sc == 'e' || sc == 'x') ? 'd' : sc));
    MCH.push(CODES.indexOf(sc));
    BCH.push(CODES.indexOf(subs[i].blinkCh));
  }
  var HAS_U32 = typeof Uint32Array != 'undefined' && typeof Int32Array != 'undefined';
  var LITTLE = HAS_U32 && new Uint8Array(new Uint32Array([1]).buffer)[0] == 1;
  var PAL32 = {};
  function pal32(name, p) {
    if (PAL32[name]) return PAL32[name];
    var out = [];
    for (var q = 0; q < CODES.length; q++) {
      var hex = p[CODES.charAt(q)];
      var r = parseInt(hex.substr(1, 2), 16), g = parseInt(hex.substr(3, 2), 16), b = parseInt(hex.substr(5, 2), 16);
      // >>> 0: unsigned, as a Uint32Array reads it back, so seal() can compare.
      out.push((LITTLE ? ((255 << 24) | (b << 16) | (g << 8) | r) : ((r << 24) | (g << 16) | (b << 8) | 255)) >>> 0);
    }
    return (PAL32[name] = out);
  }

  // ─── Constants (prototype defaults, verbatim) ───────────────────────────────

  var AMP = 0.15, PERIOD = 4, TILT = -0.2, FROWN = 1.6, SPEED = 2;
  var LH = 128, HY = 62, LINE = 59, APEX = 17, CX = 30, CY = 14, MARGIN = 34;
  var STRAIGHT = 0.65, SMILE = -0.5, UP = 1.25, DOWN = -1.3;
  var MAX_DT = 0.05, BLINK_EVERY = 5, BLINK_FOR = 0.16, BREACH_EVERY = 120;
  var FLOOR_EASE = 0.4, HIT_MIN = 44;
  // A touch on him counts as a tap only if it moved less than TAP_SLOP px and
  // lasted less than TAP_MS. Anything else (a scroll, a long-press) is the page's.
  var TAP_SLOP = 10, TAP_MS = 350;

  function sst(x) { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); }
  function rot(p, c, a) {
    var s = Math.sin(a), co = Math.cos(a), dx = p[0] - c[0], dy = p[1] - c[1];
    return [c[0] + dx * co - dy * s, c[1] + dx * s + dy * co];
  }
  function hermite(keys, t) {
    var n = keys.length;
    if (t <= keys[0][0]) return keys[0][1];
    if (t >= keys[n - 1][0]) return keys[n - 1][1];
    var q = 0;
    while (keys[q + 1][0] < t) q++;
    var t0 = keys[q][0], p0 = keys[q][1], t1 = keys[q + 1][0], p1 = keys[q + 1][1];
    function m(k) { return (k <= 0 || k >= n - 1) ? 0 : (keys[k + 1][1] - keys[k - 1][1]) / (keys[k + 1][0] - keys[k - 1][0]); }
    var h = t1 - t0, u = (t - t0) / h, u2 = u * u, u3 = u2 * u;
    return (2 * u3 - 3 * u2 + 1) * p0 + (u3 - 2 * u2 + u) * h * m(q) + (-2 * u3 + 3 * u2) * p1 + (u3 - u2) * h * m(q + 1);
  }
  function keyed(times, values) { return times.map(function (t, n) { return [t, values[n]]; }); }

  // turnAround() keyframes (prototype, verbatim): down 2.6 s, hidden 0.6 s, up 2.8 s.
  var DOWN_T = [0, 1.2, 2.6], UP_T = [0, 1.4, 2.8];
  var TURN_DOWN = { F: keyed(DOWN_T, [0, 5, 9]), Y: keyed(DOWN_T, [0, 10, LH - HY + 8]), A: keyed(DOWN_T, [TILT, -0.45, -0.8]), B: keyed(DOWN_T, [0, 0.25, 0.4]) };
  var TURN_UP = { F: keyed(UP_T, [-9, -4, 0]), Y: keyed(UP_T, [LH - HY + 8, 8, 0]), A: keyed(UP_T, [0.75, 0.35, TILT]), B: keyed(UP_T, [-0.4, -0.25, 0]) };
  var DOWN_DUR = 2.6, HIDDEN = 0.6, UP_DUR = 2.8;

  // breach() keyframes (prototype, verbatim): 0.35 s lead-in, then 5.8 s path.
  var BT = [0, 0.7, 1.35, 1.9, 2.4, 2.95, 3.6, 4.25, 4.95, 5.8];
  var BREACH = {
    F: keyed(BT, [0, 2, 4, 7, 10, 13, 16, 14, 6, 0]),
    Y: keyed(BT, [0, -4, LINE - 24 - HY, APEX - HY, APEX + 3 - HY, LINE - 10 - HY, 16, 12, 3, 0]),
    A: keyed(BT, [TILT, 0.85, UP, 0.25, -0.7, DOWN, -0.75, 0.4, 0.25, TILT]),
    B: keyed(BT, [0, STRAIGHT, STRAIGHT, FROWN * 0.8, FROWN, STRAIGHT, 0.2, SMILE, SMILE * 0.5, 0])
  };
  var BREACH_LEAD = 0.35, BREACH_DUR = BT[BT.length - 1];
  var SPOUT_DUR = 1.4;

  // ─── State machine ──────────────────────────────────────────────────────────
  // facing 'left' is the sprite's drawn direction (prototype facing = 1).

  function dirOf(s) { return s.facing == 'left' ? 1 : -1; }
  function fwdOf(s) { return s.facing == 'left' ? -1 : 1; }

  function newState(width, opts) {
    opts = opts || {};
    var w = Math.max(width || 0, 2 * MARGIN);
    var x = typeof opts.x == 'number' ? opts.x : MARGIN + Math.random() * (w - 2 * MARGIN);
    var facing = opts.facing == 'left' || opts.facing == 'right' ? opts.facing : (Math.random() < 0.5 ? 'left' : 'right');
    var floor = opts.floor || 0;
    return {
      x: x, facing: facing, mode: 'swim', t: 0, flipped: false, turnFwd: 0, breachFwd: 0, pending: false,
      offX: 0, offY: 0, offA: 0, bw: 0, bKey: 0,
      phase: 0, time: 0, blinkClock: 0, blinkLeft: 0, breachClock: 0,
      lineVisible: false, lineCx: 0, rising: false, spoutFired: false, spoutT: -1, spout: 0,
      reduceMotion: !!opts.reduceMotion, palette: opts.palette || 'paper',
      floor: floor, floorFrom: floor, floorTo: floor, floorT: FLOOR_EASE
    };
  }

  function startTurn(s) {
    if (s.mode != 'swim') return;
    s.mode = 'turn'; s.t = 0; s.flipped = false; s.turnFwd = fwdOf(s);
  }

  /** Prototype breach(): waits for a turn to finish, ignored while busy. */
  function requestBreach(s, width) {
    if (s.mode == 'turn') { s.pending = true; return; }
    if (s.mode != 'swim') return;
    var w = Math.max(width, 2 * MARGIN);
    s.mode = 'breach'; s.t = 0; s.spoutFired = false; s.rising = false;
    var fwd = fwdOf(s);
    var room = fwd < 0 ? s.x - MARGIN : w - MARGIN - s.x;
    var back = room < 16 ? 16 - room : 0;
    if (back) s.x -= fwd * back;
    s.lineCx = s.x + fwd * 8;
    s.lineVisible = true;
    s.breachFwd = fwd;
  }

  function finishMove(s) { s.offX = 0; s.offY = 0; s.offA = 0; s.bw = 0; }

  function stepTurn(s, width) {
    var fwd = s.turnFwd, t = s.t, k;
    if (!s.flipped) {
      k = Math.min(t, DOWN_DUR);
      s.offX = fwd * hermite(TURN_DOWN.F, k);
      s.offY = hermite(TURN_DOWN.Y, k);
      s.offA = hermite(TURN_DOWN.A, k) - TILT * (1 - s.bw);
      s.bKey = hermite(TURN_DOWN.B, k);
      s.bw = sst(k / 0.5);
      if (t >= DOWN_DUR) {
        s.x += fwd * 9;
        s.facing = s.facing == 'left' ? 'right' : 'left';
        s.flipped = true;
      }
      return;
    }
    if (t < DOWN_DUR + HIDDEN) return; // hidden below the bottom edge
    var f2 = -fwd;
    k = Math.min(t - DOWN_DUR - HIDDEN, UP_DUR);
    s.offX = f2 * hermite(TURN_UP.F, k);
    s.offY = hermite(TURN_UP.Y, k);
    s.offA = hermite(TURN_UP.A, k) - TILT * (1 - s.bw);
    s.bKey = hermite(TURN_UP.B, k);
    s.bw = 1 - sst((k - 2.0) / 0.8);
    if (k >= UP_DUR) {
      finishMove(s);
      s.mode = 'swim';
      if (s.pending) { s.pending = false; requestBreach(s, width); }
    }
  }

  function stepBreach(s) {
    if (s.t < BREACH_LEAD) return;
    var t = Math.min(s.t - BREACH_LEAD, BREACH_DUR);
    s.rising = !s.spoutFired && t <= 2.4;
    s.offX = s.breachFwd * hermite(BREACH.F, t);
    s.offY = hermite(BREACH.Y, t);
    s.offA = hermite(BREACH.A, t) - TILT * (1 - s.bw);
    s.bKey = hermite(BREACH.B, t);
    s.bw = sst(t / 0.5) * (1 - sst((t - (BREACH_DUR - 0.7)) / 0.7));
    if (t > 3.4) s.lineVisible = false;
    if (t >= BREACH_DUR) {
      finishMove(s);
      s.rising = false;
      s.lineVisible = false;
      s.mode = 'swim';
    }
  }

  /** Body pose from state (prototype render(), minus the per-pixel bend). */
  function pose(s) {
    var dir = dirOf(s), bw = s.bw;
    var pitch = -0.06 * AMP * Math.sin(s.phase - 0.2) * (1 - bw), heave = 1.2 * Math.sin(s.phase + 1.6) * (1 - bw);
    var A = s.offA + TILT * (1 - bw) + pitch;
    var cx = s.x + s.offX, cy = HY + CY + s.offY + heave;
    var bl = rot([10, 6.5], [CX, CY], A);
    return {
      A: A, cx: cx, cy: cy, dir: dir,
      bx: cx + (bl[0] - CX) * dir, by: cy + (bl[1] - CY),
      up: [Math.sin(A) * dir, -Math.cos(A)], side: [Math.cos(A) * dir, Math.sin(A)]
    };
  }

  function step(s, dt, width) {
    dt = Math.max(0, Math.min(MAX_DT, dt || 0));
    var w = Math.max(width || 0, 2 * MARGIN);
    s.time += dt;
    s.phase += dt * (2 * Math.PI / PERIOD);

    // A narrowed window must never strand him: snap back inside within a frame.
    // (A turn legitimately parks him up to 9 pt past the margin.)
    var lo = MARGIN, hi = w - MARGIN, shift = 0;
    if (s.x > hi + 9) shift = hi - s.x;
    else if (s.x < lo - 9) shift = lo - s.x;
    if (shift) { s.x += shift; s.lineCx += shift; }

    // Floor glide (~0.4 s ease) above the bottom chrome.
    if (s.floorT < FLOOR_EASE) {
      s.floorT = Math.min(FLOOR_EASE, s.floorT + dt);
      s.floor = s.floorFrom + (s.floorTo - s.floorFrom) * sst(s.floorT / FLOOR_EASE);
    }

    // Blink every 5 s for 160 ms.
    s.blinkLeft = Math.max(0, s.blinkLeft - dt);
    s.blinkClock += dt;
    if (s.blinkClock >= BLINK_EVERY) { s.blinkClock -= BLINK_EVERY; s.blinkLeft = BLINK_FOR; }

    // Automatic breach every 120 s — never under Reduce Motion.
    s.breachClock += dt;
    if (s.breachClock >= BREACH_EVERY) {
      s.breachClock -= BREACH_EVERY;
      if (!s.reduceMotion) requestBreach(s, w);
    }

    if (s.mode == 'swim') {
      s.x += fwdOf(s) * SPEED * dt;
      if (s.x <= lo && s.facing == 'left') { s.x = lo; startTurn(s); }
      else if (s.x >= hi && s.facing == 'right') { s.x = hi; startTurn(s); }
    } else if (s.mode == 'turn') {
      s.t += dt; stepTurn(s, w);
    } else if (s.mode == 'breach') {
      s.t += dt; stepBreach(s);
    }

    // Spout: fires once, the instant the blowhole clears the water line.
    if (s.spoutT >= 0) {
      s.spoutT += dt;
      if (s.spoutT >= SPOUT_DUR) { s.spoutT = -1; s.spout = 0; }
      else s.spout = 5 * Math.sin(Math.PI * s.spoutT / SPOUT_DUR);
    }
    if (s.rising && !s.spoutFired && pose(s).by < LINE - 1) {
      s.spoutFired = true; s.rising = false; s.spoutT = 0; s.spout = 0;
    }
    return s;
  }

  // ─── Drawing ────────────────────────────────────────────────────────────────

  var lastStyle = null;
  function fill(ctx, style) { if (style !== lastStyle) { ctx.fillStyle = style; lastStyle = style; } }

  // Spray dots at the top of the spout (prototype, verbatim): [side, height].
  var SPRAY = [[-4, 2], [4, 2], [-6, -2], [6, -2]];

  /** Grow the per-canvas dirty rectangle (device px) by one drawn rectangle. */
  function mark(cache, x0, y0, x1, y1) {
    if (x0 < cache.dx0) cache.dx0 = x0;
    if (y0 < cache.dy0) cache.dy0 = y0;
    if (x1 > cache.dx1) cache.dx1 = x1;
    if (y1 > cache.dy1) cache.dy1 = y1;
  }

  /** Spine bend + sprite → screen for every sample, into SX/SY (CSS px). */
  function bend(s, ps) {
    var bw = s.bw, k, n;
    for (k = 0; k < NJ; k++) {
      var jt = JOINTS[k];
      ANG[k] = jt.k * (AMP * Math.sin(s.phase - jt.lag) * (1 - bw) + s.bKey * bw);
      JS[k] = Math.sin(ANG[k]); JC[k] = Math.cos(ANG[k]);
      var pp = jt.p;
      for (var z = 0; z < k; z++) pp = rot(pp, PIV[z], ANG[z]);
      PIV[k] = pp;
    }
    // Sprite → screen: translate(cx,cy) · scale(dir,1) · rotate(A) · translate(-CX,-CY).
    // Hot path (~3.3k samples × 3 joints a frame): rot() is inlined here with
    // the same arithmetic, in the same order, so no array is allocated per call.
    // A weight of exactly 1 rotates by ANG[k] * 1 === ANG[k], whose sin/cos are
    // JS[k]/JC[k] — the same doubles Math.sin/cos would return here.
    var sA = Math.sin(ps.A), cA = Math.cos(ps.A), pcx = ps.cx, pcy = ps.cy, pdir = ps.dir;
    var minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
    for (n = 0; n < NS; n++) {
      var qx = PX[n], qy = PY[n], base = n * NJ, kEnd = KHI[n];
      for (k = KLO[n]; k < kEnd; k++) {
        var wgt = WGT[base + k];
        if (wgt > 0) {
          var rs, rc;
          if (wgt === 1) { rs = JS[k]; rc = JC[k]; }
          else { var ra = ANG[k] * wgt; rs = Math.sin(ra); rc = Math.cos(ra); }
          var pv = PIV[k];
          var rx = qx - pv[0], ry = qy - pv[1];
          qx = pv[0] + rx * rc - ry * rs;
          qy = pv[1] + rx * rs + ry * rc;
        }
      }
      var dx = qx - CX, dy = qy - CY;
      var X = pcx + pdir * (dx * cA - dy * sA), Y = pcy + (dx * sA + dy * cA);
      SX[n] = X; SY[n] = Y;
      if (X < minX) minX = X;
      if (X > maxX) maxX = X;
      if (Y < minY) minY = Y;
      if (Y > maxY) maxY = Y;
    }
    EXT[0] = minX; EXT[1] = minY; EXT[2] = maxX; EXT[3] = maxY;
  }

  // Extent of the last bend(), in CSS px: [minX, minY, maxX, maxY].
  var EXT = [0, 0, 0, 0];

  /**
   * Write one pass of blocks, in sample order, into `px` (row stride `stride`,
   * origin at device px (bx0, by0)), clipped to [bx0, bx1) × [by0, by1). Each
   * block is centred on its sample and snapped to device pixels, and a later
   * block overwrites an earlier one exactly as an opaque fillRect does.
   */
  function paintPass(px, stride, bx0, by0, bx1, by1, dpr, half, codes, pal) {
    for (var n = 0; n < NS; n++) {
      var code = codes[n];
      if (code < 0) continue;
      var X = SX[n], Y = SY[n];
      var x0 = Math.round((X - half) * dpr), x1 = Math.round((X + half) * dpr);
      var y0 = Math.round((Y - half) * dpr), y1 = Math.round((Y + half) * dpr);
      if (x1 <= x0) x1 = x0 + 1;
      if (y1 <= y0) y1 = y0 + 1;
      if (x0 < bx0) x0 = bx0;
      if (x1 > bx1) x1 = bx1;
      if (y0 < by0) y0 = by0;
      if (y1 > by1) y1 = by1;
      if (x1 <= x0) continue;
      var col = pal[code];
      for (var yy = y0; yy < y1; yy++) {
        var o = (yy - by0) * stride - bx0;
        for (var xx = x0; xx < x1; xx++) px[o + xx] = col;
      }
    }
  }

  // A bridge is drawn only once its pair has spread past 2.2× the samples'
  // resting spacing (1 / SUB) — just short of where a gap can open (2.3×,
  // the main block's width). The swim stroke never gets there, so his look
  // while swimming is pixel-for-pixel what it was; at 1.6× it did, and a
  // bridge flickered a stray pixel onto his edge every few frames.
  var BRIDGE_MIN2 = (2.2 / SUB) * (2.2 / SUB);

  /** The outline bridges (see BRA/BRB), in the outline colour `col`. */
  function paintBridges(px, stride, bx0, by0, bx1, by1, dpr, half, col) {
    for (var q = 0; q < BRA.length; q++) {
      var a = BRA[q], b = BRB[q], gx = SX[b] - SX[a], gy = SY[b] - SY[a];
      if (gx * gx + gy * gy <= BRIDGE_MIN2) continue;   // not spread apart: no gap to bridge
      var X = (SX[a] + SX[b]) / 2, Y = (SY[a] + SY[b]) / 2;
      var x0 = Math.round((X - half) * dpr), x1 = Math.round((X + half) * dpr);
      var y0 = Math.round((Y - half) * dpr), y1 = Math.round((Y + half) * dpr);
      if (x1 <= x0) x1 = x0 + 1;
      if (y1 <= y0) y1 = y0 + 1;
      if (x0 < bx0) x0 = bx0;
      if (x1 > bx1) x1 = bx1;
      if (y0 < by0) y0 = by0;
      if (y1 > by1) y1 = by1;
      for (var yy = y0; yy < y1; yy++) {
        var o = (yy - by0) * stride - bx0;
        for (var xx = x0; xx < x1; xx++) px[o + xx] = col;
      }
    }
  }

  /**
   * Close the outline wherever bending split it. On the outer curve of a bend
   * the one-pixel outline spreads apart and the next segment's body colour can
   * reach the bare page (the "crack on his back" mid-breach). Every body pixel
   * that touches a bare pixel becomes outline, `rounds` pixels deep, so the
   * outline stays closed. At rest no body pixel touches the page, so nothing
   * changes there. Run only mid-breach (see draw()). `hit` is a reused
   * scratch list.
   */
  function seal(px, stride, w, h, oc, rounds, hit) {
    hit.length = 0;
    var x, y, i, v, k, start = 0;
    for (y = 0; y < h; y++) {
      for (x = 0; x < w; x++) {
        i = y * stride + x; v = px[i];
        if (v === 0 || v === oc) continue;
        if ((x > 0 && px[i - 1] === 0) || (x < w - 1 && px[i + 1] === 0) ||
            (y > 0 && px[i - stride] === 0) || (y < h - 1 && px[i + stride] === 0)) hit.push(i);
      }
    }
    for (var round = 0; round < rounds; round++) {
      var end = hit.length;
      for (k = start; k < end; k++) px[hit[k]] = oc;
      if (round == rounds - 1) break;
      for (k = start; k < end; k++) {
        i = hit[k]; x = i % stride; y = (i - x) / stride;
        if (x > 0 && px[i - 1] !== 0 && px[i - 1] !== oc) hit.push(i - 1);
        if (x < w - 1 && px[i + 1] !== 0 && px[i + 1] !== oc) hit.push(i + 1);
        if (y > 0 && px[i - stride] !== 0 && px[i - stride] !== oc) hit.push(i - stride);
        if (y < h - 1 && px[i + stride] !== 0 && px[i + stride] !== oc) hit.push(i + stride);
      }
      start = end;
    }
  }

  // Palette "codes" for the fallback buffer: code n is CODES.charAt(n - 1),
  // so 0 stays transparent and 1 is the outline.
  var CODE1 = [];
  for (i = 0; i < CODES.length; i++) CODE1.push(i + 1);

  /**
   * The outline bridges, then the underlay (every non-outline pixel larger,
   * in its own colour, so no hairline gaps open on the back when the body
   * bends), then the main pass, then seal(), into one buffer over a box
   * holding every block, clipped to the canvas as fillRect clips. Rounding is monotonic, so no block can start
   * left of round((minX - hu) * dpr) or end right of round((maxX + hu) * dpr)
   * + 1 (the +1 covers the one-pixel minimum block); likewise vertically. Box
   * pixels no block covers stay transparent — what the canvas held there
   * before. With ImageData the buffer holds RGBA and goes out as one
   * putImageData; without it (never in a real WebView or browser) it holds
   * palette codes and goes out as one fillRect per run of a colour.
   */
  function raster(ctx, cache, dpr, cw, chh, p, palName, blink, fast, sealIt) {
    var hu = 3.2 / SUB / 2, hm = 2.3 / SUB / 2;
    var bx0 = Math.round((EXT[0] - hu) * dpr), by0 = Math.round((EXT[1] - hu) * dpr);
    var bx1 = Math.round((EXT[2] + hu) * dpr) + 1, by1 = Math.round((EXT[3] + hu) * dpr) + 1;
    if (bx0 < 0) bx0 = 0;
    if (by0 < 0) by0 = 0;
    if (bx1 > cw) bx1 = cw;
    if (by1 > chh) by1 = chh;
    if (bx1 <= bx0 || by1 <= by0) return; // wholly off the canvas (mid-turn)
    var bbw = bx1 - bx0, bbh = by1 - by0, px, stride, pal, img, n;
    if (fast) {
      img = cache.img;
      if (!img || img.width < bbw || img.height < bbh) {
        img = cache.img = ctx.createImageData(Math.max(bbw, img ? img.width : 0), Math.max(bbh, img ? img.height : 0));
        cache.px = new Uint32Array(img.data.buffer, img.data.byteOffset, img.width * img.height);
      }
      px = cache.px; stride = img.width; pal = pal32(palName, p);
    } else {
      if (!cache.codes || cache.codes.length < bbw * bbh) cache.codes = new Array(bbw * bbh);
      px = cache.codes; stride = bbw; pal = CODE1;
    }
    var end = bbh * stride;
    if (px.fill) px.fill(0, 0, end);
    else for (n = 0; n < end; n++) px[n] = 0;
    paintBridges(px, stride, bx0, by0, bx1, by1, dpr, hm, pal[0]);
    paintPass(px, stride, bx0, by0, bx1, by1, dpr, hu, UCH, pal);
    paintPass(px, stride, bx0, by0, bx1, by1, dpr, hm, blink ? BCH : MCH, pal);
    if (sealIt) seal(px, stride, bbw, bbh, pal[0], Math.max(1, Math.round(dpr / 2)), cache.hit || (cache.hit = []));
    if (fast) {
      ctx.putImageData(img, bx0, by0, 0, 0, bbw, bbh);
    } else {
      for (var yy = 0; yy < bbh; yy++) {
        for (var xx = 0; xx < bbw;) {
          var v = px[yy * stride + xx], run = 1;
          while (xx + run < bbw && px[yy * stride + xx + run] === v) run++;
          if (v) { fill(ctx, p[CODES.charAt(v - 1)]); ctx.fillRect(bx0 + xx, by0 + yy, run, 1); }
          xx += run;
        }
      }
    }
    mark(cache, bx0, by0, bx1, by1);
  }

  /** One spout dot, `d` along the body's up axis and `sd` along its side. */
  function spoutDot(ctx, cache, ps, dpr, dot, d, sd) {
    var ax = Math.round((ps.bx + ps.up[0] * d + ps.side[0] * sd - 1) * dpr);
    var ay = Math.round((ps.by + ps.up[1] * d + ps.side[1] * sd - 1) * dpr);
    ctx.fillRect(ax, ay, dot, dot);
    mark(cache, ax, ay, ax + dot, ay + dot);
  }

  /**
   * Draw one frame. `cache` is per canvas (see create()): it remembers what the
   * last frame drew, so only that is cleared, and holds the reused pixel buffer.
   */
  function draw(ctx, s, dpr, cssW, cache) {
    var p = T[s.palette] || T.paper, n, k;
    var ps = pose(s), blink = s.blinkLeft > 0;
    var cw = Math.round(cssW * dpr), chh = Math.round(LH * dpr);
    cache = cache || {};
    var fast = HAS_U32 && typeof ctx.putImageData == 'function' && typeof ctx.createImageData == 'function';
    lastStyle = null;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    // Everything is redrawn every frame, so clearing what the last frame drew
    // leaves the same canvas as clearing all of it. A new context or a resized
    // canvas (which the browser has cleared) starts with a full clear.
    if (!fast || cache.ctx !== ctx || cache.cw !== cw || cache.ch !== chh) {
      ctx.clearRect(0, 0, cw, chh);
    } else if (cache.dx1 > cache.dx0 && cache.dy1 > cache.dy0) {
      var c0 = Math.max(0, cache.dx0), r0 = Math.max(0, cache.dy0);
      var c1 = Math.min(cw, cache.dx1), r1 = Math.min(chh, cache.dy1);
      if (c1 > c0 && r1 > r0) ctx.clearRect(c0, r0, c1 - c0, r1 - r0);
    }
    cache.ctx = ctx; cache.cw = cw; cache.ch = chh;
    cache.dx0 = 1e9; cache.dy0 = 1e9; cache.dx1 = -1e9; cache.dy1 = -1e9;

    bend(s, ps);

    // seal() only mid-breach: that is the only bend strong enough to need it,
    // and swimming it re-coloured a different stray edge pixel or two every
    // frame — a visible shimmer along his head (TestFlight 1.7.9 build 146).
    raster(ctx, cache, dpr, cw, chh, p, T[s.palette] ? s.palette : 'paper', blink, fast, s.mode == 'breach');

    // Spout, perpendicular to the body.
    if (s.spout > 0) {
      fill(ctx, p.wave);
      var dot = Math.max(1, Math.round(2 * dpr)), hh = s.spout;
      for (k = 1; k <= Math.floor(hh); k++) spoutDot(ctx, cache, ps, dpr, dot, k * 3, 0);
      if (hh >= 2.5) {
        var spread = (hh - 2.5) / 2.5 * 2, top = hh * 3;
        for (k = 0; k < SPRAY.length; k++) {
          var pr = SPRAY[k];
          spoutDot(ctx, cache, ps, dpr, dot, top + pr[1], pr[0] + (pr[0] < 0 ? -1 : 1) * spread);
        }
      }
    }

    // Stepped water line (one row, whale-wide, appears instantly).
    if (s.lineVisible) {
      fill(ctx, p.wave);
      var ph = Math.floor(s.time * 1000 / 220) % 4, d2 = Math.max(1, Math.round(2 * dpr));
      for (var lx = Math.round(s.lineCx - 33); lx < s.lineCx + 33; lx += 2) {
        var ly = ((((lx / 2) + ph) % 4 < 2) ? LINE : LINE - 2);
        var wx = Math.round(lx * dpr), wy = Math.round(ly * dpr);
        ctx.fillRect(wx, wy, d2, d2);
        mark(cache, wx, wy, wx + d2, wy + d2);
      }
    }
    return ps;
  }

  /** Sprite bounds in CSS px, in canvas (stage) coordinates. */
  function bounds(s, ps) {
    var sA = Math.sin(ps.A), cA = Math.cos(ps.A), minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
    [[0, 0], [60, 0], [0, 29], [60, 29]].forEach(function (c) {
      var dx = c[0] - CX, dy = c[1] - CY;
      var x = ps.cx + ps.dir * (dx * cA - dy * sA), y = ps.cy + (dx * sA + dy * cA);
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    });
    var w = Math.max(maxX - minX, HIT_MIN), h = Math.max(maxY - minY, HIT_MIN);
    return { left: (minX + maxX) / 2 - w / 2, top: (minY + maxY) / 2 - h / 2, width: w, height: h };
  }

  // ─── DOM layer ──────────────────────────────────────────────────────────────

  function create(host, opts) {
    opts = opts || {};
    var onLog = typeof opts.onLog == 'function' ? opts.onLog : null;
    var canvas = document.createElement('canvas');
    var cs = canvas.style;
    cs.position = 'fixed'; cs.left = '0px'; cs.right = '0px'; cs.bottom = '0px';
    cs.width = '100%'; cs.height = LH + 'px'; cs.pointerEvents = 'none'; cs.zIndex = '5';
    cs.display = 'block';

    var hit = document.createElement('div');
    var hs = hit.style;
    hs.position = 'fixed'; hs.pointerEvents = 'auto'; hs.zIndex = '6';
    hs.userSelect = 'none'; hs.webkitUserSelect = 'none'; hs.webkitTouchCallout = 'none';
    hs.webkitTapHighlightColor = 'transparent';
    hs.display = 'none';

    function cssWidth() { return canvas.clientWidth || host.clientWidth || window.innerWidth || 0; }

    var state = newState(cssWidth(), { palette: opts.palette, floor: opts.floor, reduceMotion: opts.reduceMotion });
    var ctx = null, raf = 0, last = null, paused = false, dead = false;
    var drawCache = {}; // this canvas's dirty rectangle + reused pixel buffer (see draw())

    // Last value written to each per-frame style property; a property is only
    // written when its value changes (style writes can invalidate layout).
    var written = {};
    function setStyle(st, key, prop, val) {
      if (written[key] === val) return;
      written[key] = val;
      st[prop] = val;
    }

    // Touch handling (reader ruling, Task 3). touchstart is NEVER cancelled, so a
    // scroll that begins on him still scrolls. Only a still, short touch is a tap:
    // its touchend and the click that follows are cancelled and stopped, so no
    // TAP reaches the shell. Every other touch propagates untouched. A click
    // with no touch before it (mouse, web) is a tap too.
    var touchFrom = null;  // { x, y, t } of the open touch on him
    var lastTouch = null;  // 'tap' | 'other' — how the last touch ended, until its click
    function firstTouch(e) {
      var l = e.changedTouches || e.touches;
      return l && l.length ? l[0] : null;
    }
    function swallow(e) {
      e.stopPropagation();
      if (e.cancelable) e.preventDefault();
    }
    function tapped() {
      // A tap during a breach or a turn is ignored.
      if (state.mode == 'swim') requestBreach(state, cssWidth());
    }
    function onTouchStart(e) {
      var p = firstTouch(e);
      touchFrom = p ? { x: p.clientX, y: p.clientY, t: Date.now() } : null;
      lastTouch = null;
    }
    function onTouchEnd(e) {
      var from = touchFrom, p = firstTouch(e);
      touchFrom = null;
      if (!from || !p) { lastTouch = 'other'; return; }
      var dx = p.clientX - from.x, dy = p.clientY - from.y;
      if (dx * dx + dy * dy >= TAP_SLOP * TAP_SLOP || Date.now() - from.t >= TAP_MS) {
        lastTouch = 'other';
        return;
      }
      lastTouch = 'tap';
      swallow(e);
      tapped();
    }
    function onTouchCancel() { touchFrom = null; lastTouch = 'other'; }
    function onClick(e) {
      var kind = lastTouch;
      lastTouch = null;
      if (kind == 'other') return;   // the click of a non-tap touch is the page's
      swallow(e);
      if (kind != 'tap') tapped();   // a touch tap already breached on touchend
    }
    hit.addEventListener('touchstart', onTouchStart);
    hit.addEventListener('touchend', onTouchEnd);
    hit.addEventListener('touchcancel', onTouchCancel);
    hit.addEventListener('click', onClick);

    host.appendChild(canvas);
    host.appendChild(hit);

    function schedule() {
      if (!dead && !paused && !raf) raf = window.requestAnimationFrame(frame);
    }

    function frame(now) {
      raf = 0;
      if (dead || paused) return;
      try {
        var dt = last == null ? 0 : (now - last) / 1000;
        last = now;
        var cssW = cssWidth(), dpr = window.devicePixelRatio || 1;
        step(state, dt, cssW);
        var bw = Math.round(cssW * dpr), bh = Math.round(LH * dpr);
        if (canvas.width != bw || canvas.height != bh) { canvas.width = bw; canvas.height = bh; ctx = null; }
        if (!ctx) {
          ctx = canvas.getContext ? canvas.getContext('2d') : null;
          if (ctx) ctx.imageSmoothingEnabled = false;
        }
        var ps = ctx ? draw(ctx, state, dpr, cssW, drawCache) : pose(state);
        // The floor moves the whole canvas, never the drawing inside it: a breach
        // never clips, and a turn dips out of sight at the top of whatever bar shows.
        setStyle(cs, 'cb', 'bottom', state.floor + 'px');
        if (state.mode == 'swim') {
          var b = bounds(state, ps);
          setStyle(hs, 'hd', 'display', 'block');
          setStyle(hs, 'hl', 'left', b.left + 'px');
          setStyle(hs, 'hb', 'bottom', (state.floor + LH - (b.top + b.height)) + 'px');
          setStyle(hs, 'hw', 'width', b.width + 'px');
          setStyle(hs, 'hh', 'height', b.height + 'px');
        } else {
          setStyle(hs, 'hd', 'display', 'none');
        }
      } catch (err) {
        if (onLog) onLog('whalie frame error: ' + (err && err.message ? err.message : String(err)));
        // A stopped whale must not leave a live tap target behind.
        try { setStyle(hs, 'hd', 'display', 'none'); } catch (e2) { /* nothing more to do */ }
        return; // stop animating rather than throw every frame
      }
      schedule();
    }

    schedule();

    return {
      setPalette: function (k) { if (T[k]) state.palette = k; },
      setFloor: function (px) {
        px = Math.max(0, +px || 0);
        if (px == state.floorTo) return;
        state.floorFrom = state.floor; state.floorTo = px; state.floorT = 0;
      },
      setReduceMotion: function (b) { state.reduceMotion = !!b; },
      setPaused: function (b) {
        b = !!b;
        if (b == paused) return;
        paused = b;
        if (paused) { if (raf) window.cancelAnimationFrame(raf); raf = 0; }
        else { last = null; schedule(); }
      },
      breach: function () { requestBreach(state, cssWidth()); },
      destroy: function () {
        dead = true;
        if (raf) window.cancelAnimationFrame(raf);
        raf = 0;
        hit.removeEventListener('touchstart', onTouchStart);
        hit.removeEventListener('touchend', onTouchEnd);
        hit.removeEventListener('touchcancel', onTouchCancel);
        hit.removeEventListener('click', onClick);
        if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
        if (hit.parentNode) hit.parentNode.removeChild(hit);
      },
      _state: function () {
        return { x: state.x, facing: state.facing, mode: state.mode, lineVisible: state.lineVisible, spout: state.spout };
      },
      // Tests: the midpoint (CSS px, canvas space) between every pair of
      // neighbouring outline samples, as last drawn — where the outline must
      // be unbroken.
      _outlineMidpoints: function () {
        var out = [];
        for (var q = 0; q < BRA.length; q++) out.push([(SX[BRA[q]] + SX[BRB[q]]) / 2, (SY[BRA[q]] + SY[BRB[q]]) / 2]);
        return out;
      }
    };
  }

  return {
    WHALE_SPRITE: SPRITE,
    WHALE_PALETTES: T,
    whalePaletteFor: paletteFor,
    newWhalieState: newState,
    stepWhalie: step,
    createWhalie: create
  };
})();

var WHALE_SPRITE = whalieEngine.WHALE_SPRITE;
var WHALE_PALETTES = whalieEngine.WHALE_PALETTES;
var whalePaletteFor = whalieEngine.whalePaletteFor;
var newWhalieState = whalieEngine.newWhalieState;
var stepWhalie = whalieEngine.stepWhalie;
var createWhalie = whalieEngine.createWhalie;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    WHALE_SPRITE: WHALE_SPRITE,
    WHALE_PALETTES: WHALE_PALETTES,
    whalePaletteFor: whalePaletteFor,
    newWhalieState: newWhalieState,
    stepWhalie: stepWhalie,
    createWhalie: createWhalie
  };
}
