import { makeTraditionResolver } from '../tradition';
import type { Catalog } from '../catalog';

const catalog = {
  categories: [
    { id: 'cat-christian', parentId: null, name: 'Christian', sortOrder: 3 },
    { id: 'cat-tr-christian', parentId: null, name: 'Hristiyanlık', sortOrder: 3 },
    { id: 'cat-tr-nt', parentId: 'cat-tr-christian', name: 'Yeni Antlaşma', sortOrder: 1 },
  ],
  books: [
    { id: 'bible-kjv-john', categoryId: 'cat-christian', title: 'John' },
    { id: 'bible-tr-turytc-jhn', categoryId: 'cat-tr-nt', title: 'YUHANNA' },
  ],
} as unknown as Catalog;

describe('makeTraditionResolver', () => {
  const resolve = makeTraditionResolver(
    catalog,
    new Map([['uuid-john', 'bible-kjv-john'], ['uuid-yuhanna', 'bible-tr-turytc-jhn']]),
    'Other',
    k => `label:${k}`,
  );
  it('gives one tradition to the same tradition in two languages', () => {
    expect(resolve('uuid-john')).toEqual({ id: 'tradition:christian', name: 'label:christian' });
    expect(resolve('uuid-yuhanna')).toEqual({ id: 'tradition:christian', name: 'label:christian' });
  });
  it('accepts a slug when the uuid is unknown', () => {
    expect(resolve('bible-kjv-john').id).toBe('tradition:christian');
  });
  it('falls back to Other, keyed by the book itself', () => {
    expect(resolve('mystery')).toEqual({ id: 'mystery', name: 'Other' });
  });
});
