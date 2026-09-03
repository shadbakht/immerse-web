import { bookLanguage } from '../catalog';
import type { Catalog } from '../catalog';

const catalog: Catalog = {
  version: 'test',
  categories: [],
  books: [
    { id: 'genesis', categoryId: 'c', title: 'Genesis', language: 'en' },
    { id: 'suttacentral-tr-kp', categoryId: 'c', title: 'Metta', language: 'tr' },
    { id: 'legacy-book', categoryId: 'c', title: 'Legacy' }, // no language field
  ],
};

describe('bookLanguage', () => {
  it('returns the book language', () => {
    expect(bookLanguage(catalog, 'suttacentral-tr-kp')).toBe('tr');
  });
  it('defaults to en for a legacy entry without a language', () => {
    expect(bookLanguage(catalog, 'legacy-book')).toBe('en');
  });
  it('defaults to en for an unknown slug', () => {
    expect(bookLanguage(catalog, 'nope')).toBe('en');
  });
});
