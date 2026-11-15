jest.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }));
import { isPsalmStanzaHeading } from '../ReaderPanel';

describe('isPsalmStanzaHeading', () => {
  it('matches the unnumbered stanza rows of both editions', () => {
    expect(isPsalmStanzaHeading({ paragraph_number: 0, content: 'נ NUN' })).toBe(true);
    expect(isPsalmStanzaHeading({ paragraph_number: 0, content: 'צ TZADE' })).toBe(true);
    expect(isPsalmStanzaHeading({ paragraph_number: null, content: 'ALEPH' })).toBe(true);
  });
  it('never matches a numbered verse or ordinary text', () => {
    expect(isPsalmStanzaHeading({ paragraph_number: 105, content: 'NUN' })).toBe(false);
    expect(isPsalmStanzaHeading({ paragraph_number: 0, content: 'NUN. Thy word is a lamp' })).toBe(false);
    expect(isPsalmStanzaHeading({ paragraph_number: 0, content: 'HE said' })).toBe(false);
  });
});
