import { xrefIdSetEquals, traditionPairOf } from '../sharedSets';

describe('xrefIdSetEquals', () => {
  it('true for the same ids in any order', () => {
    expect(xrefIdSetEquals(['a', 'b', 'c'], ['c', 'a', 'b'])).toBe(true);
  });
  it('false when sizes differ', () => {
    expect(xrefIdSetEquals(['a', 'b'], ['a', 'b', 'c'])).toBe(false);
  });
  it('false on partial overlap', () => {
    expect(xrefIdSetEquals(['a', 'b'], ['a', 'c'])).toBe(false);
  });
  it('ignores duplicates', () => {
    expect(xrefIdSetEquals(['a', 'a', 'b'], ['a', 'b'])).toBe(true);
  });
});

describe('traditionPairOf', () => {
  it('normalises order so A↔B === B↔A', () => {
    const p1 = traditionPairOf({ id: 'x', name: 'Christianity' }, { id: 'y', name: "Bahá'í" });
    const p2 = traditionPairOf({ id: 'y', name: "Bahá'í" }, { id: 'x', name: 'Christianity' });
    expect(p1).toEqual(p2);
    expect(p1.pairName).toBe("Bahá'í ↔ Christianity");
    expect(p1.pairKey).toBe('y↔x');
  });
  it('same-tradition pair reads once', () => {
    const p = traditionPairOf({ id: 'x', name: 'Islam' }, { id: 'x', name: 'Islam' });
    expect(p.pairName).toBe('Islam ↔ Islam');
    expect(p.pairKey).toBe('x↔x');
  });
  it('is order-independent for two distinct traditions with the same name', () => {
    // Both books unresolved → both named "Other" but different ids.
    const p1 = traditionPairOf({ id: 'b1', name: 'Other' }, { id: 'b2', name: 'Other' });
    const p2 = traditionPairOf({ id: 'b2', name: 'Other' }, { id: 'b1', name: 'Other' });
    expect(p1).toEqual(p2);
    expect(p1.pairKey).toBe('b1↔b2');
  });
});
