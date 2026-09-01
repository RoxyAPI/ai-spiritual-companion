import type { SupabaseClient } from '@supabase/supabase-js';
import { embed } from 'ai';
import { embeddingOptions, getEmbeddingModel } from '@/lib/ai';
import type { MemoryHit, ReadingInput } from '@/types';
import type { Database } from '@/types/database';

/**
 * The memory seam. Two verbs, and nothing else in the project reads or writes `readings` or
 * `memories`.
 *
 * `recall` runs before the model call and returns the past the model should see. `remember` runs
 * after it and appends what just happened. If you are adding a third verb, the flow has grown a
 * step that belongs inside one of these two.
 *
 * Both work whether or not the configured provider has an embedding endpoint, and the caller cannot
 * tell which path ran except by reading `similarity`. That is deliberate: the degraded mode is a
 * documented mode, not a broken one. See `docs/memory.md`.
 */

type Client = SupabaseClient<Database>;

/** Turns a vector into the literal form pgvector accepts over the wire. */
function toVectorLiteral(values: number[]): string {
  return `[${values.join(',')}]`;
}

/** The most recent readings, newest first. The floor every other path falls back to. */
async function recentReadings(supabase: Client, count: number): Promise<MemoryHit[]> {
  const { data, error } = await supabase
    .from('readings')
    .select('shown, created_at')
    .order('created_at', { ascending: false })
    .limit(count);

  if (error) throw new Error(`Recall failed: ${error.message}`);

  return (data ?? []).map((row) => ({ content: row.shown, createdAt: row.created_at }));
}

/**
 * The past worth showing the model this turn.
 *
 * With an embedding model configured this is a cosine similarity search over everything the
 * companion has ever said to this person. Without one it is the most recent readings, newest first,
 * which the tutorial this template implements is explicit is already a strong companion.
 *
 * @remarks There are two ways to end up on the recency path, and both are normal. The provider may
 * have no embedding endpoint at all, or the call may fail on the day. **An embedding provider
 * having a bad minute must never cost somebody their answer**, and free tiers rate limit embeddings
 * aggressively, so a failure here degrades the quality of the recall and nothing else. It is logged
 * rather than swallowed, because a companion that quietly stopped remembering looks exactly like
 * one that is working.
 *
 * @param supabase - A server client carrying the caller session. Row level security does the
 * filtering, so there is no user id argument to get wrong.
 * @param query - What the person just asked. Ignored on the recency path.
 * @param count - How many to return. Comes from the config, not from a caller literal.
 */
export async function recall(supabase: Client, query: string, count: number): Promise<MemoryHit[]> {
  const model = getEmbeddingModel();

  if (model && query.trim()) {
    try {
      const { embedding } = await embed({
        model,
        value: query,
        providerOptions: embeddingOptions(),
      });

      const { data, error } = await supabase.rpc('match_memories', {
        query_embedding: toVectorLiteral(embedding),
        match_count: count,
      });

      if (error) throw new Error(error.message);

      return (data ?? []).map((row) => ({
        content: row.content,
        createdAt: row.created_at,
        similarity: row.similarity,
      }));
    } catch (error) {
      console.warn('[memory] recall by meaning is unavailable, using recency instead:', error);
    }
  }

  return recentReadings(supabase, count);
}

/**
 * Appends one delivered turn. The reading always lands; the embedding lands only when the provider
 * has one and is answering, so a fork that switches provider keeps its history and simply stops
 * adding to the index.
 *
 * @remarks Both the question and the answer are embedded together, so a later recall matches on
 * either side of the exchange. Embedding only the answer loses every turn where the interesting
 * part was what the person said.
 *
 * The reading is stored first and its failure throws, because losing the durable record is a real
 * loss. The index entry is stored second and its failure only warns, because the row it points at
 * is already safe and an index can be rebuilt from it.
 */
export async function remember(
  supabase: Client,
  userId: string,
  reading: ReadingInput,
): Promise<void> {
  const { data: inserted, error } = await supabase
    .from('readings')
    .insert({
      user_id: userId,
      kind: reading.kind,
      data: { asked: reading.asked, grounding: reading.grounding ?? [] },
      shown: reading.shown,
    })
    .select('id')
    .single();

  if (error) throw new Error(`Could not store the reading: ${error.message}`);

  const model = getEmbeddingModel();
  if (!model) return;

  const content = `${reading.asked}\n\n${reading.shown}`;

  try {
    const { embedding } = await embed({
      model,
      value: content,
      providerOptions: embeddingOptions(),
    });

    const { error: memoryError } = await supabase.from('memories').insert({
      user_id: userId,
      reading_id: inserted.id,
      content,
      embedding: toVectorLiteral(embedding),
    });

    if (memoryError) throw new Error(memoryError.message);
  } catch (indexError) {
    console.warn('[memory] the reading was stored but not indexed for recall:', indexError);
  }
}
