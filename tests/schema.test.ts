import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The guard on the security promise, and on the hand written schema type.
 *
 * Row level security is what makes the anon key safe to publish, so a table that ships without it
 * is not a bug in a feature, it is every user reading every other user. This suite reads the
 * migrations rather than trusting a comment.
 *
 * It also holds `src/types/database.ts` to the SQL. That file is hand written on purpose, because
 * generated types call a jsonb column `Json` and force a cast at every read. This is the trade that
 * makes hand writing safe: drift fails here.
 */

const MIGRATIONS = join(process.cwd(), 'supabase', 'migrations');

const raw = readdirSync(MIGRATIONS)
  .filter((file) => file.endsWith('.sql'))
  .sort()
  .map((file) => readFileSync(join(MIGRATIONS, file), 'utf8'))
  .join('\n');

/**
 * The statements only. Every assertion below is about what the database will actually do, and the
 * migrations explain themselves at length, so a comment that mentions a construct must not read as
 * a declaration of it.
 */
const sql = raw
  .split('\n')
  .filter((line) => !line.trim().startsWith('--'))
  .join('\n');

/** Every `create table public.x (...)` block, with its column names in declaration order. */
function tablesInSql(): Map<string, string[]> {
  const tables = new Map<string, string[]>();
  const pattern = /create table public\.(\w+)\s*\(([\s\S]*?)\n\);/g;

  for (const match of sql.matchAll(pattern)) {
    const [, name, body] = match;
    const columns = body
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('--'))
      .map((line) => line.split(/\s+/)[0])
      // A table level constraint is not a column.
      .filter((token) => !['primary', 'unique', 'check', 'foreign', 'constraint'].includes(token));
    tables.set(name, columns);
  }

  return tables;
}

const tables = tablesInSql();

describe('the migrations create the tables the application expects', () => {
  it('creates exactly the four tables of the memory layer', () => {
    expect([...tables.keys()].sort()).toEqual(['charts', 'memories', 'profiles', 'readings']);
  });

  it('makes charts.user_id the primary key, so a chart can exist only once per account', () => {
    expect(sql).toMatch(/create table public\.charts\s*\([\s\S]*?user_id uuid primary key/);
  });

  it('gives profiles and charts no update or delete policy, so birth data cannot drift', () => {
    for (const table of ['profiles', 'charts']) {
      expect(sql).not.toMatch(new RegExp(`on public\\.${table} for update`));
      expect(sql).not.toMatch(new RegExp(`on public\\.${table} for delete`));
    }
  });
});

describe('every table is closed by row level security', () => {
  for (const table of tables.keys()) {
    it(`${table} enables row level security`, () => {
      expect(sql).toContain(`alter table public.${table} enable row level security;`);
    });

    it(`${table} carries at least one policy keyed to the signed in user`, () => {
      const policies = [...sql.matchAll(new RegExp(`on public\\.${table} for (\\w+)`, 'g'))];
      expect(policies.length).toBeGreaterThan(0);
    });
  }

  it('every policy predicate is keyed to auth.uid(), never left open', () => {
    const policies = sql.split('create policy').slice(1);
    expect(policies.length).toBeGreaterThan(0);
    for (const policy of policies) {
      expect(policy).toContain('(select auth.uid())');
    }
  });
});

describe('the semantic search function cannot bypass those policies', () => {
  it('is declared security invoker', () => {
    expect(sql).toMatch(/create function public\.match_memories[\s\S]*?security invoker/);
  });

  it('is never declared security definer', () => {
    expect(sql).not.toContain('security definer');
  });
});

describe('src/types/database.ts matches the SQL', () => {
  const types = readFileSync(join(process.cwd(), 'src', 'types', 'database.ts'), 'utf8');

  for (const [table, columns] of tables) {
    it(`declares a row type for ${table} with every column`, () => {
      expect(types).toContain(`${table}: {`);
      for (const column of columns) {
        expect(types).toContain(`${column}:`);
      }
    });
  }

  it('declares the search function with the arguments the SQL takes', () => {
    expect(types).toContain('match_memories');
    expect(types).toContain('query_embedding');
    expect(types).toContain('match_count');
  });
});
