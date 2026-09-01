import 'server-only';
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';
import { openai } from '@ai-sdk/openai';
import type { EmbeddingModel, LanguageModel } from 'ai';

/**
 * Which model answers, and which one embeds. This is the entire provider surface of the project,
 * and the only place a model identifier appears. Do not restate one in a prompt, a component, or a
 * document: identifiers move, and a copy is how a version string goes stale for a year.
 *
 * Adding a provider is one branch in each function below plus its package. If it has no embedding
 * endpoint that can produce {@link EMBEDDING_DIMENSIONS}, leave it out of the second one and recall
 * degrades to recency by itself. See `docs/companion.md`.
 */

const PROVIDERS = ['google', 'anthropic', 'openai'] as const;

type Provider = (typeof PROVIDERS)[number];

/**
 * The width of every vector in the `memories` table. It is written into the column type, the index,
 * and the search function, so changing it here alone breaks the insert rather than the search,
 * which is the safer of the two failures but still a migration.
 */
export const EMBEDDING_DIMENSIONS = 768;

export function getProvider(): Provider {
  const raw = (process.env.LLM_PROVIDER ?? 'google').trim().toLowerCase();
  return PROVIDERS.find((p) => p === raw) ?? 'google';
}

/** The conversational model. */
export function getModel(): LanguageModel {
  switch (getProvider()) {
    case 'anthropic':
      return anthropic('claude-haiku-4-5');
    case 'openai':
      return openai('gpt-5.6-luna');
    default:
      return google('gemini-3.7-flash');
  }
}

/**
 * The embedding model, or `null` when the configured provider has none. A `null` here is what makes
 * `recall` fall back to recency, so this function is the single decision point for semantic memory
 * being on or off. Read it rather than the table in the documentation.
 */
export function getEmbeddingModel(): EmbeddingModel | null {
  switch (getProvider()) {
    case 'anthropic':
      return null;
    case 'openai':
      return openai.embedding('text-embedding-3-small');
    default:
      return google.embedding('gemini-embedding-001');
  }
}

/**
 * Provider settings that pin the output width to {@link EMBEDDING_DIMENSIONS}. Both models default
 * to something wider, so without this the insert fails on the column type.
 */
export function embeddingOptions(): Record<string, Record<string, string | number>> {
  return getProvider() === 'openai'
    ? { openai: { dimensions: EMBEDDING_DIMENSIONS } }
    : { google: { outputDimensionality: EMBEDDING_DIMENSIONS, taskType: 'SEMANTIC_SIMILARITY' } };
}

/** Whether the key the configured provider needs is present. Used by the setup notice. */
export function hasModelKey(): boolean {
  switch (getProvider()) {
    case 'anthropic':
      return Boolean(process.env.ANTHROPIC_API_KEY);
    case 'openai':
      return Boolean(process.env.OPENAI_API_KEY);
    default:
      return Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY);
  }
}
