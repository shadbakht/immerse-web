import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchRecentlyAdded, pickRecentlyAdded, recentSince } from '../recentlyAdded';

const NOW = new Date('2026-10-19T12:00:00Z');

describe('recentSince', () => {
  it('reaches back 30 days for a long-established language', () => {
    // English arrived in April.
    expect(recentSince('2026-04-06T09:00:00Z', NOW).toISOString()).toBe('2026-09-19T12:00:00.000Z');
  });

  it('starts after the launch week for a language newer than that', () => {
    // Arabic arrived on 14 September.
    expect(recentSince('2026-09-14T08:00:00Z', NOW).toISOString()).toBe('2026-09-21T08:00:00.000Z');
  });
});

describe('pickRecentlyAdded', () => {
  const arabic = [
    { id: 'launch-1', addedAt: '2026-09-14T08:00:00Z' },
    { id: 'launch-2', addedAt: '2026-09-17T08:00:00Z' },
    { id: 'kafi', addedAt: '2026-10-16T10:00:00Z' },
    { id: 'bihar', addedAt: '2026-10-16T10:05:00Z' },
  ];

  it('leaves out the launch week and lists the rest newest first', () => {
    expect(pickRecentlyAdded(arabic, '2026-09-14T08:00:00Z', NOW).map(b => b.id)).toEqual(['bihar', 'kafi']);
  });

  it('leaves out anything older than 30 days', () => {
    const english = [
      { id: 'june', addedAt: '2026-06-02T10:00:00Z' },
      { id: 'zhuangzi', addedAt: '2026-09-09T10:00:00Z' },
      { id: 'september', addedAt: '2026-09-20T10:00:00Z' },
    ];
    expect(pickRecentlyAdded(english, '2026-04-06T09:00:00Z', NOW).map(b => b.id)).toEqual(['september']);
  });

  it('keeps only books this device has', () => {
    expect(pickRecentlyAdded(arabic, '2026-09-14T08:00:00Z', NOW, new Set(['kafi'])).map(b => b.id)).toEqual(['kafi']);
  });

  it('lists a book once', () => {
    const twice = [...arabic, { id: 'kafi', addedAt: '2026-10-16T10:00:00Z' }];
    expect(pickRecentlyAdded(twice, '2026-09-14T08:00:00Z', NOW).map(b => b.id)).toEqual(['bihar', 'kafi']);
  });

  it('shows nothing for a language with no books', () => {
    expect(pickRecentlyAdded(arabic, null, NOW)).toEqual([]);
  });
});

describe('fetchRecentlyAdded', () => {
  // A stand-in for the Supabase query builder: records every call, and answers
  // each `from()` with the next canned response.
  function fakeClient(responses: { data: unknown; error: unknown }[]) {
    const queries: [string, unknown[]][][] = [];
    const client = {
      from(table: string) {
        const log: [string, unknown[]][] = [['from', [table]]];
        queries.push(log);
        const response = responses[queries.length - 1];
        const builder: object = new Proxy({}, {
          get(_target, prop: string) {
            if (prop === 'then') return (resolve: (v: unknown) => void) => resolve(response);
            if (prop === 'maybeSingle') return () => Promise.resolve(response);
            return (...args: unknown[]) => { log.push([prop, args]); return builder; };
          },
        });
        return builder;
      },
    } as unknown as Pick<SupabaseClient, 'from'>;
    return { queries, client };
  }

  it('reads curated books only, from the end of the launch week', async () => {
    const { queries, client } = fakeClient([
      { data: { created_at: '2026-09-14T08:00:00Z' }, error: null },
      {
        data: [
          { created_at: '2026-10-16T10:05:00Z', book_slug_map: { local_id: 'bihar' } },
          { created_at: '2026-10-16T10:00:00Z', book_slug_map: [{ local_id: 'kafi' }] },
          { created_at: '2026-10-16T09:00:00Z', book_slug_map: null },
        ],
        error: null,
      },
    ]);
    const result = await fetchRecentlyAdded(client, 'ar', NOW);

    expect(result).toEqual({
      firstAddedAt: '2026-09-14T08:00:00Z',
      rows: [
        { id: 'bihar', addedAt: '2026-10-16T10:05:00Z' },
        { id: 'kafi', addedAt: '2026-10-16T10:00:00Z' },
      ],
    });
    for (const query of queries) {
      expect(query).toEqual(expect.arrayContaining([
        ['eq', ['language', 'ar']],
        ['eq', ['is_active', true]],
        ['eq', ['is_user_imported', false]],
      ]));
    }
    expect(queries[1]).toContainEqual(['gte', ['created_at', '2026-09-21T08:00:00.000Z']]);
  });

  it('stops after one read when the language has no books', async () => {
    const { queries, client } = fakeClient([{ data: null, error: null }]);
    expect(await fetchRecentlyAdded(client, 'xx', NOW)).toEqual({ firstAddedAt: null, rows: [] });
    expect(queries).toHaveLength(1);
  });

  it('throws when a read fails', async () => {
    const { client } = fakeClient([{ data: null, error: new Error('offline') }]);
    await expect(fetchRecentlyAdded(client, 'en', NOW)).rejects.toThrow('offline');
  });
});
