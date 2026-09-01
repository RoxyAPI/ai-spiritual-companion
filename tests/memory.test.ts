import type { SupabaseClient } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { recall, remember } from '@/lib/memory';
import type { Database } from '@/types/database';

/**
 * The seam, both ways round.
 *
 * The claim this suite defends is that a caller cannot tell which path ran. Semantic recall and
 * recency recall return the same shape, and `remember` stores the reading whether or not it can
 * also embed it, so switching provider changes the quality of the memory and never the code around
 * it.
 */

const mocks = vi.hoisted(() => ({
  embeddingModel: null as unknown,
  embedFails: false,
}));

vi.mock('ai', () => ({
  embed: vi.fn(async () => {
    if (mocks.embedFails) throw new Error('429 quota exceeded');
    return { embedding: [0.1, 0.2, 0.3] };
  }),
}));

vi.mock('@/lib/ai', () => ({
  getEmbeddingModel: () => mocks.embeddingModel,
  embeddingOptions: () => ({}),
}));

beforeEach(() => {
  // The degradation paths log on purpose. Silence the console so a passing run stays readable.
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  mocks.embeddingModel = null;
  mocks.embedFails = false;
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

/** A Supabase double narrow enough to be readable and wide enough to catch a wrong table. */
function fakeClient(
  options: {
    rpcRows?: { id: string; content: string; created_at: string; similarity: number }[];
    readingRows?: { shown: string; created_at: string }[];
  } = {},
) {
  const calls = { rpc: [] as unknown[], inserted: [] as { table: string; row: unknown }[] };

  const client = {
    rpc: (name: string, args: unknown) => {
      calls.rpc.push({ name, args });
      return Promise.resolve({ data: options.rpcRows ?? [], error: null });
    },
    from: (table: string) => ({
      select: () => ({
        order: () => ({
          limit: () => Promise.resolve({ data: options.readingRows ?? [], error: null }),
        }),
      }),
      insert: (row: unknown) => {
        calls.inserted.push({ table, row });
        return {
          select: () => ({
            single: () => Promise.resolve({ data: { id: 'reading-1' }, error: null }),
          }),
          then: (resolve: (value: { error: null }) => void) => resolve({ error: null }),
        };
      },
    }),
  } as unknown as SupabaseClient<Database>;

  return { client, calls };
}

describe('recall without an embedding model', () => {
  it('returns the most recent readings instead of failing', async () => {
    const { client, calls } = fakeClient({
      readingRows: [{ shown: 'Career was the theme', created_at: '2026-08-01T10:00:00Z' }],
    });

    const hits = await recall(client, 'what should I focus on', 4);

    expect(hits).toEqual([{ content: 'Career was the theme', createdAt: '2026-08-01T10:00:00Z' }]);
    expect(calls.rpc).toHaveLength(0);
  });

  it('reports no similarity, so a caller cannot pretend the search was semantic', async () => {
    const { client } = fakeClient({
      readingRows: [{ shown: 'anything', created_at: '2026-08-01T10:00:00Z' }],
    });

    const [hit] = await recall(client, 'a question', 4);
    expect(hit.similarity).toBeUndefined();
  });
});

describe('recall with an embedding model', () => {
  it('searches the vector index and returns the same shape', async () => {
    mocks.embeddingModel = { id: 'test-embedding' };
    const { client, calls } = fakeClient({
      rpcRows: [
        {
          id: 'm1',
          content: 'Career was the theme',
          created_at: '2026-08-01T10:00:00Z',
          similarity: 0.82,
        },
      ],
    });

    const hits = await recall(client, 'what should I focus on', 4);

    expect(hits).toEqual([
      { content: 'Career was the theme', createdAt: '2026-08-01T10:00:00Z', similarity: 0.82 },
    ]);
    expect(calls.rpc).toEqual([
      { name: 'match_memories', args: { query_embedding: '[0.1,0.2,0.3]', match_count: 4 } },
    ]);
  });

  it('falls back to recency when there is nothing to search on', async () => {
    mocks.embeddingModel = { id: 'test-embedding' };
    const { client, calls } = fakeClient({ readingRows: [] });

    await recall(client, '   ', 4);
    expect(calls.rpc).toHaveLength(0);
  });
});

describe('when the embedding provider fails on the day', () => {
  it('recall falls back to recency instead of losing the turn', async () => {
    // The real failure this guards: free tiers rate limit embeddings hard, and a 429 used to take
    // the whole conversation down with a 500. An embedding provider having a bad minute must cost
    // the quality of the recall and nothing else.
    mocks.embeddingModel = { id: 'test-embedding' };
    mocks.embedFails = true;
    const { client, calls } = fakeClient({
      readingRows: [{ shown: 'Career was the theme', created_at: '2026-08-01T10:00:00Z' }],
    });

    const hits = await recall(client, 'what should I focus on', 4);

    expect(hits).toEqual([{ content: 'Career was the theme', createdAt: '2026-08-01T10:00:00Z' }]);
    expect(calls.rpc).toHaveLength(0);
  });

  it('remember still stores the reading, and only the index entry is lost', async () => {
    mocks.embeddingModel = { id: 'test-embedding' };
    mocks.embedFails = true;
    const { client, calls } = fakeClient();

    await expect(
      remember(client, 'user-1', {
        kind: 'conversation',
        shown: 'The answer',
        asked: 'The question',
      }),
    ).resolves.toBeUndefined();

    expect(calls.inserted.map((entry) => entry.table)).toEqual(['readings']);
  });
});

describe('remember', () => {
  it('stores the reading and nothing else when no embedding model is configured', async () => {
    const { client, calls } = fakeClient();

    await remember(client, 'user-1', {
      kind: 'conversation',
      shown: 'The answer',
      asked: 'The question',
    });

    expect(calls.inserted.map((entry) => entry.table)).toEqual(['readings']);
  });

  it('stores the reading and the memory when one is', async () => {
    mocks.embeddingModel = { id: 'test-embedding' };
    const { client, calls } = fakeClient();

    await remember(client, 'user-1', {
      kind: 'conversation',
      shown: 'The answer',
      asked: 'The question',
    });

    expect(calls.inserted.map((entry) => entry.table)).toEqual(['readings', 'memories']);

    const memory = calls.inserted[1].row as { content: string; embedding: string };
    // Question and answer are embedded together, so a later recall can match on either side.
    expect(memory.content).toBe('The question\n\nThe answer');
    expect(memory.embedding).toBe('[0.1,0.2,0.3]');
  });
});
