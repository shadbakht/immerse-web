import { shareUrl, parseSharePath, UUID_RE } from '../shareUrl';

describe('UUID_RE', () => {
  it('matches a v4 uuid and rejects junk', () => {
    expect(UUID_RE.test('7f4a91c2-1a2b-4c3d-8e9f-0a1b2c3d4e5f')).toBe(true);
    expect(UUID_RE.test('not-a-uuid')).toBe(false);
    expect(UUID_RE.test('7f4a91c2')).toBe(false);
  });
});

describe('shareUrl', () => {
  it('builds the canonical /c/<id> URL from NEXT_PUBLIC_SITE_URL', () => {
    expect(shareUrl('7f4a91c2-1a2b-4c3d-8e9f-0a1b2c3d4e5f', 'https://immerseresearch.app'))
      .toBe('https://immerseresearch.app/c/7f4a91c2-1a2b-4c3d-8e9f-0a1b2c3d4e5f');
  });
  it('trims a trailing slash on the base', () => {
    expect(shareUrl('7f4a91c2-1a2b-4c3d-8e9f-0a1b2c3d4e5f', 'https://immerseresearch.app/'))
      .toBe('https://immerseresearch.app/c/7f4a91c2-1a2b-4c3d-8e9f-0a1b2c3d4e5f');
  });
});

describe('parseSharePath', () => {
  const id = '7f4a91c2-1a2b-4c3d-8e9f-0a1b2c3d4e5f';
  it('extracts the id from /c/<id>', () => {
    expect(parseSharePath(`/c/${id}`, '')).toEqual({ id, save: false });
  });
  it('sets save:true only for ?save=1', () => {
    expect(parseSharePath(`/c/${id}`, '?save=1')).toEqual({ id, save: true });
    expect(parseSharePath(`/c/${id}`, '?save=0')).toEqual({ id, save: false });
  });
  it('returns null for a non-uuid id or a non-/c path', () => {
    expect(parseSharePath('/c/nope', '')).toBeNull();
    expect(parseSharePath('/read/abc', '')).toBeNull();
  });
});
