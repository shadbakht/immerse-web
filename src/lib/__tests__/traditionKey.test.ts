import {
  traditionKeyFromRootCategoryId, traditionKeyFromSupabaseName, traditionLabelKey, traditionGroupId,
} from '../traditionKey';

describe('traditionKey', () => {
  it('collapses every language root of a tradition to one key', () => {
    for (const id of ['cat-bahai', 'cat-fr-bahai', 'cat-zh-bahai', 'cat-ar-bahai']) {
      expect(traditionKeyFromRootCategoryId(id)).toBe('bahai');
    }
    expect(traditionKeyFromRootCategoryId('cat-tr-christian')).toBe('christian');
    expect(traditionKeyFromRootCategoryId('cat-de-more')).toBe('more');
  });
  it('rejects non-tradition categories', () => {
    expect(traditionKeyFromRootCategoryId('cat-fr-crampon')).toBeNull();
    expect(traditionKeyFromRootCategoryId('cat-bahai-the-bb')).toBeNull();
    expect(traditionKeyFromRootCategoryId('imported')).toBeNull();
  });
  it('maps Supabase tradition names', () => {
    expect(traditionKeyFromSupabaseName('Islam')).toBe('islamic');
    expect(traditionKeyFromSupabaseName("Bahá'í")).toBe('bahai');
    expect(traditionKeyFromSupabaseName('Nope')).toBeNull();
    expect(traditionKeyFromSupabaseName(null)).toBeNull();
  });
  it('labels and ids', () => {
    expect(traditionLabelKey('zoroastrian')).toBe('reminders.tradition.zoroastrian');
    expect(traditionLabelKey('more')).toBe('common.otherTradition');
    expect(traditionGroupId('hindu')).toBe('tradition:hindu');
  });
});
