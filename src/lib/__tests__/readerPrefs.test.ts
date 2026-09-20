/** @jest-environment jsdom */
import { stackFor, applyReaderPrefs } from '../readerPrefs';
import { DEFAULT_READER_PREFS } from '../readerTypography';

describe('stackFor — script face', () => {
  it('Latin book: unchanged Latin stack', () => {
    expect(stackFor(DEFAULT_READER_PREFS, 'en')).toBe(`'Literata', Georgia, serif`);
  });
  it('Persian book: default Amiri appended', () => {
    expect(stackFor(DEFAULT_READER_PREFS, 'fa')).toBe(`'Literata', Georgia, 'Amiri', serif`);
  });
  it('Persian book: chosen Scheherazade appended — reads scriptFacePersian, not scriptFaceArabic', () => {
    expect(stackFor({ ...DEFAULT_READER_PREFS, scriptFacePersian: 'scheherazade' }, 'fa'))
      .toBe(`'Literata', Georgia, 'Scheherazade New', serif`);
  });
  it('Persian book: IranNastaliq appended', () => {
    expect(stackFor({ ...DEFAULT_READER_PREFS, scriptFacePersian: 'irannastaliq' }, 'fa'))
      .toBe(`'Literata', Georgia, 'IranNastaliq', serif`);
  });
  it('Arabic book: unaffected by scriptFacePersian — reads scriptFaceArabic, never offers IranNastaliq', () => {
    expect(stackFor({ ...DEFAULT_READER_PREFS, scriptFacePersian: 'irannastaliq' }, 'ar'))
      .toBe(`'Literata', Georgia, 'Amiri', serif`);
  });
  it('Chinese book: LXGW WenKai appended', () => {
    expect(stackFor(DEFAULT_READER_PREFS, 'zh')).toBe(`'Literata', Georgia, 'LXGW WenKai', serif`);
  });
});

describe('applyReaderPrefs — footnote marker colour (--reader-footnote)', () => {
  // Mirrors the mobile reader's applyTheme: vivid royal blue on the light themes,
  // a lighter blue on the dark ones (royal blue on #0F1923 / black is unreadable).
  // Keyed off the same "dark chrome" flag mobile uses (darkSmoothing).
  const read = () => document.documentElement.style.getPropertyValue('--reader-footnote');
  const apply = (theme: 'light' | 'sepia' | 'quiet' | 'dark' | 'night') =>
    applyReaderPrefs({ ...DEFAULT_READER_PREFS, theme }, { fontSizePx: 18, isDark: false });

  it.each(['light', 'sepia', 'quiet'] as const)('%s theme: royal blue', (t) => {
    apply(t);
    expect(read().toUpperCase()).toBe('#0F5BDB');
  });
  it.each(['dark', 'night'] as const)('%s theme: lighter blue', (t) => {
    apply(t);
    expect(read().toUpperCase()).toBe('#8CB8FF');
  });
});
