import {
  SCRIPT_SIZE_SCALE, scriptScale, scriptOf, scriptScaleForText,
  uiScriptScale, UI_SCRIPT_SCALE,
  TREE_DEPTH_WEIGHT, treeDepthWeight,
  TREE_DEPTH_COLOR_ROLE, treeDepthColorRole,
  buildThemePayload, DEFAULT_READER_PREFS,
} from '../readerTypography';

describe('scriptScale (by language code)', () => {
  it('returns 1 for Latin languages', () => {
    for (const l of ['en', 'es', 'fr', 'de', 'tr', 'en-US']) {
      expect(scriptScale(l)).toBe(1);
    }
  });
  it('returns 1 for Cyrillic (ru)', () => {
    expect(scriptScale('ru')).toBe(1);
  });
  it('returns the Arabic multiplier for fa / ar / ur', () => {
    expect(scriptScale('fa')).toBe(SCRIPT_SIZE_SCALE.arabic);
    expect(scriptScale('fa-IR')).toBe(SCRIPT_SIZE_SCALE.arabic);
    expect(scriptScale('ar')).toBe(SCRIPT_SIZE_SCALE.arabic);
    expect(scriptScale('ur')).toBe(SCRIPT_SIZE_SCALE.arabic);
  });
  it('returns the CJK multiplier for zh / ja / ko', () => {
    expect(scriptScale('zh')).toBe(SCRIPT_SIZE_SCALE.cjk);
    expect(scriptScale('zh-Hans')).toBe(SCRIPT_SIZE_SCALE.cjk);
  });
  it('returns 1 for null / undefined / empty', () => {
    expect(scriptScale(null)).toBe(1);
    expect(scriptScale(undefined)).toBe(1);
    expect(scriptScale('')).toBe(1);
  });
  it('keeps Arabic in the 1.10-1.20 band and CJK in 1.00-1.10', () => {
    expect(SCRIPT_SIZE_SCALE.arabic).toBeGreaterThanOrEqual(1.10);
    expect(SCRIPT_SIZE_SCALE.arabic).toBeLessThanOrEqual(1.20);
    expect(SCRIPT_SIZE_SCALE.cjk).toBeGreaterThanOrEqual(1.00);
    expect(SCRIPT_SIZE_SCALE.cjk).toBeLessThanOrEqual(1.10);
  });
});

describe('scriptOf (by string content)', () => {
  it('detects Perso-Arabic text', () => {
    expect(scriptOf('کتاب ایقان')).toBe('arabic');
    expect(scriptOf('مناجات')).toBe('arabic');
    expect(scriptOf('پژوهش')).toBe('arabic'); // Persian-specific consonants پ چ ژ گ
  });
  it('detects Han text', () => {
    expect(scriptOf('隐言经')).toBe('cjk');
    expect(scriptOf('巴哈欧拉的著作')).toBe('cjk');
  });
  it('detects Kana and Hangul as CJK', () => {
    expect(scriptOf('ひらがな')).toBe('cjk');
    expect(scriptOf('한국어')).toBe('cjk');
  });
  it('does not classify CJK punctuation alone as CJK', () => {
    expect(scriptOf('。「」')).toBeNull();
  });
  it('returns null for Latin and Cyrillic', () => {
    expect(scriptOf('Writings of Bahá’u’lláh')).toBeNull();
    expect(scriptOf('Писания Бахауллы')).toBeNull();
  });
  it('returns null for empty / null', () => {
    expect(scriptOf('')).toBeNull();
    expect(scriptOf(null)).toBeNull();
    expect(scriptOf(undefined)).toBeNull();
  });
  it('first non-Latin script present wins for mixed strings', () => {
    expect(scriptOf('Prayer مناجات')).toBe('arabic');
  });
});

describe('scriptScaleForText', () => {
  it('scales a Persian-named heading', () => {
    expect(scriptScaleForText('مناجات')).toBe(SCRIPT_SIZE_SCALE.arabic);
  });
  it('leaves a Latin heading at 1', () => {
    expect(scriptScaleForText('Morning')).toBe(1);
  });
});

describe('tree depth weight ramp', () => {
  it('is 600 / 500 / 400 across the first three tiers', () => {
    expect(TREE_DEPTH_WEIGHT).toEqual([600, 500, 400]);
  });
  it('treeDepthWeight clamps depth ≥ 2 to the last tier', () => {
    expect(treeDepthWeight(0)).toBe(600);
    expect(treeDepthWeight(1)).toBe(500);
    expect(treeDepthWeight(2)).toBe(400);
    expect(treeDepthWeight(4)).toBe(400);
  });
  it('treeDepthWeight clamps a negative depth to the first tier', () => {
    expect(treeDepthWeight(-1)).toBe(600);
  });
});

describe('buildThemePayload — script size', () => {
  it('is unchanged when no language is passed (back-compat)', () => {
    const a = buildThemePayload(DEFAULT_READER_PREFS, 18, false);
    const b = buildThemePayload(DEFAULT_READER_PREFS, 18, false, undefined);
    expect(a.fontSize).toBe(b.fontSize);
  });
  it('scales the reader font size up for a Persian book', () => {
    const en = buildThemePayload(DEFAULT_READER_PREFS, 18, false, 'en');
    const fa = buildThemePayload(DEFAULT_READER_PREFS, 18, false, 'fa');
    expect(fa.fontSize).toBe(Math.round(en.fontSize * SCRIPT_SIZE_SCALE.arabic));
  });
});

describe('uiScriptScale', () => {
  it('enlarges Arabic and Persian chrome by 8%', () => {
    expect(uiScriptScale('ar')).toBe(1.08);
    expect(uiScriptScale('fa')).toBe(1.08);
    expect(uiScriptScale('fa-IR')).toBe(1.08);
    expect(uiScriptScale('AR')).toBe(1.08);
  });
  it('leaves every other UI language at 1', () => {
    expect(uiScriptScale('en')).toBe(1);
    expect(uiScriptScale('zh')).toBe(1);
    expect(uiScriptScale('de')).toBe(1);
    expect(uiScriptScale(null)).toBe(1);
    expect(uiScriptScale(undefined)).toBe(1);
  });
  it('UI_SCRIPT_SCALE is gentler than the reader content scale', () => {
    expect(UI_SCRIPT_SCALE.ar).toBeLessThan(1.15);
  });
});

describe('tree depth colour role', () => {
  it('is textPrimary / textSecondary / textSecondary across the first three tiers', () => {
    expect(TREE_DEPTH_COLOR_ROLE).toEqual(['textPrimary', 'textSecondary', 'textSecondary']);
  });
  it('maps depth to a colour role, clamped to the last tier', () => {
    expect(treeDepthColorRole(0)).toBe('textPrimary');
    expect(treeDepthColorRole(1)).toBe('textSecondary');
    expect(treeDepthColorRole(3)).toBe('textSecondary');
  });
});
