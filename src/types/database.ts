import type { Json, NatalChartResponse, TonePreset } from '@/types';

/**
 * The schema, as TypeScript. Every Supabase client in the project is typed from it, so a query
 * against a column that does not exist fails the type check rather than at runtime.
 *
 * @remarks This file is hand written rather than generated, for one reason: `charts.natal` and
 * `readings.data` are `jsonb`, and generated types call those `Json`, which forces a cast at every
 * read. Writing it by hand lets `natal` be typed as the calculation response it actually holds, so
 * the chart page reads `natal.planets[0].sign` with real type checking and there is no cast
 * anywhere in the project. `tests/schema.test.ts` reads the migration SQL and fails if the two ever
 * disagree, which is the trade that makes hand writing safe. Run `npm run db:types` to see what a
 * generator would have produced after you change the schema.
 */

type ProfileRow = {
  id: string;
  display_name: string;
  birth_date: string;
  birth_time: string;
  birth_place: string;
  latitude: number;
  longitude: number;
  timezone: string;
  tone_preset: TonePreset;
  created_at: string;
};

type ChartRow = {
  user_id: string;
  natal: NatalChartResponse;
  computed_at: string;
};

type ReadingRow = {
  id: string;
  user_id: string;
  kind: string;
  data: Json;
  shown: string;
  created_at: string;
};

type MemoryRow = {
  id: string;
  user_id: string;
  reading_id: string | null;
  content: string;
  embedding: string;
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: Omit<ProfileRow, 'created_at' | 'tone_preset'> & { tone_preset?: TonePreset };
        Update: Record<string, never>;
        Relationships: [];
      };
      charts: {
        Row: ChartRow;
        Insert: Omit<ChartRow, 'computed_at'>;
        Update: Record<string, never>;
        Relationships: [];
      };
      readings: {
        Row: ReadingRow;
        Insert: Omit<ReadingRow, 'id' | 'created_at'>;
        Update: Record<string, never>;
        Relationships: [];
      };
      memories: {
        Row: MemoryRow;
        Insert: Omit<MemoryRow, 'id' | 'created_at'>;
        Update: Record<string, never>;
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: {
      match_memories: {
        Args: { query_embedding: string; match_count: number };
        Returns: { id: string; content: string; created_at: string; similarity: number }[];
      };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};
