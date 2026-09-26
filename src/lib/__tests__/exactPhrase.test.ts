import { exactFold, hasExactPhrase } from '../exactPhrase';

// Spec: a quoted search is tolerant of ONLY case and diacritics. Punctuation is literal
// and word order is exact. (Typographic variants of one mark are the same character.)
describe('hasExactPhrase — what IS tolerated', () => {
  it.each([
    ['Kitab-i-Aqdas', 'the Kitáb-i-Aqdas says'],
    ['KITÁB-I-AQDAS', 'the kitab-i-aqdas says'],
    ['glory of god', 'the Glory of God!'],
    ["Baha'i", 'the Bahá’í Faith'],           // straight typed, curly in the corpus
    ["Bahá'í", 'the Bahá’í Faith'],
    ["'Abdu'l-Baha", '‘Abdu’l‑Bahá said'],    // curly + non-breaking hyphen + accent
    ['Kitab-i-Aqdas', 'the Kitáb–i–Aqdas says'], // en dash is a typographic hyphen
    ['was I am', 'was  I   am'],              // whitespace runs
    ['光明', '愿你们光明磊落'],                  // Han: no spaces, plain containment
    ['Aqdas', 'Kitáb-i-Aqdas'],               // a hyphen is a word boundary
  ])('%s  ⊂  %s', (phrase, text) => {
    expect(hasExactPhrase(text, phrase)).toBe(true);
  });
});

describe('hasExactPhrase — what is NOT tolerated', () => {
  it.each([
    ['Kitab-i-Aqdas', 'the Kitab i Aqdas says'],   // hyphen → space
    ['Kitab-i-Aqdas', 'the Kitabi Aqdas says'],    // hyphen removed
    ['Bahai', 'the Bahá’í Faith'],                 // apostrophe removed
    ['Baha i', 'the Bahá’í Faith'],                // apostrophe → space
    ['Before Abraham was I am', 'Before Abraham was, I am'], // comma present in text only
    ['Before Abraham was, I am', 'Before Abraham was I am'], // comma present in query only
    ['holy mariner', 'the Mariner Holy'],          // word order
    ['light', 'the lights of heaven'],             // whole words
    ['light', 'a delight'],
    ['明光', '愿你们光明磊落'],                      // Han order
    ['i Aqdas', 'Kitáb-i-Aqdas'],
  ])('%s  ⊄  %s', (phrase, text) => {
    expect(hasExactPhrase(text, phrase)).toBe(false);
  });
});

describe('hasExactPhrase — edges', () => {
  it('an empty phrase never matches', () => {
    expect(hasExactPhrase('anything', '')).toBe(false);
    expect(hasExactPhrase('anything', '   ')).toBe(false);
  });
  it('finds a later occurrence when the first is inside a longer word', () => {
    expect(hasExactPhrase('delight, and then light', 'light')).toBe(true);
  });
  it('a phrase that ends in punctuation is matched literally', () => {
    expect(hasExactPhrase('O Son of Spirit! My first counsel', 'O Son of Spirit!')).toBe(true);
    expect(hasExactPhrase('O Son of Spirit, my first counsel', 'O Son of Spirit!')).toBe(false);
  });
});

describe('exactFold', () => {
  it('strips diacritics, lowercases, folds mark variants, collapses whitespace — nothing else', () => {
    expect(exactFold('  Kitáb–i–Aqdas ‘Abdu’l‑Bahá  “Hi”  ')).toBe('kitab-i-aqdas \'abdu\'l-baha "hi"');
    expect(exactFold("was, I am.")).toBe('was, i am.');
  });
});
