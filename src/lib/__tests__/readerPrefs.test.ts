import { stackFor } from '../readerPrefs';
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
