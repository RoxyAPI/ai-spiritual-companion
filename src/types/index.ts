import type { GetLocationSearchResponse, NatalChartResponse } from '@roxyapi/sdk';

/**
 * Every type in the project except two: the schema, which lives in `./database`, and calculation
 * responses, which are generated from the live specification by `@roxyapi/sdk` and are never
 * redeclared here. A type written next to the first file that needed it is a type the next person
 * redeclares slightly differently.
 */

/** Any value Postgres will accept in a `jsonb` column. */
export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

/** The four voices. Adding one is three steps, all listed in `docs/companion.md`. */
export type TonePreset = 'warm' | 'mystical' | 'clinical' | 'edgy';

/** What a fork edits. One file, `src/config/companion.config.ts`. */
export interface CompanionConfig {
  name: string;
  tagline: string;
  description: string;
  /** The deployed origin. Canonical URLs, the sitemap, and the social card all derive from it. */
  siteUrl: string;
  defaultTone: TonePreset;
  /** How many past memories reach the prompt each turn. More crowds the context and dilutes the reply. */
  recallCount: number;
  supportUrl: string;
}

/**
 * A place chosen in the onboarding autocomplete, carrying everything a chart needs. Narrowed from
 * the generated response rather than rewritten, so a field that changes upstream fails the type
 * check here instead of going quietly wrong at runtime. `timezone` is the IANA identifier and
 * never a numeric offset: see `AGENTS.md`.
 */
export type CityChoice = Pick<
  GetLocationSearchResponse['cities'][number],
  'city' | 'province' | 'country' | 'latitude' | 'longitude' | 'timezone'
>;

/**
 * The immutable inputs every calculation is made from. This is the ONLY user data that ever
 * leaves for a calculation, and keeping it in one named shape is what makes that auditable.
 */
export interface BirthData {
  date: string;
  time: string;
  latitude: number;
  longitude: number;
  timezone: string;
}

/**
 * One item of recalled past, whichever way it was found. `similarity` is present only on the
 * vector path, so a caller that renders it has to admit the fallback exists.
 */
export interface MemoryHit {
  content: string;
  createdAt: string;
  similarity?: number;
}

/** What `remember` appends after a turn has actually been delivered. */
export interface ReadingInput {
  kind: string;
  /** The text the person saw. This is what gets embedded. */
  shown: string;
  /** The question that produced it, embedded alongside the answer so a recall can match either. */
  asked: string;
  /**
   * What the answer was grounded in: the calculations the companion reached for, by name and
   * arguments. Stored so a reading can be traced back to the facts behind it months later.
   */
  grounding?: { tool: string; input: Json }[];
}

/** The compact chart the prompt carries, instead of the whole response. */
export interface ChartFacts {
  sun: string;
  moon: string;
  ascendant: string;
  placements: string[];
  aspects: string[];
}

/** Everything one turn knows, handed to `buildSystemPrompt` as a single argument. */
export interface PromptContext {
  displayName: string;
  tone: TonePreset;
  birth: BirthData;
  birthPlace: string;
  chart: ChartFacts;
  memories: MemoryHit[];
  today: string;
  /** False when no calculation server answered, so the prompt can say so instead of inventing. */
  hasTools: boolean;
}

export type { NatalChartResponse };
