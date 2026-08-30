import { decideShareUpsert } from '../shareLinks';

describe('decideShareUpsert', () => {
  it('inserts a new unlisted row when none exists', () => {
    expect(decideShareUpsert(null)).toEqual({ action: 'insert', listed: false });
  });
  it('is a no-op when an unlisted row already exists', () => {
    expect(decideShareUpsert({ id: 'x', listed: false })).toEqual({ action: 'none', listed: false });
  });
  it('never downgrades a listed (Discover) row — no-op, stays listed', () => {
    expect(decideShareUpsert({ id: 'x', listed: true })).toEqual({ action: 'none', listed: true });
  });
});
