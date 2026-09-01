# Memory

The memory layer is the product. Everything else in this template is scaffolding around it.

The split it exists to demonstrate: **RoxyAPI is stateless and computes facts, your database is stateful and remembers the person.** The companion is the join of the two, made at request time. Nothing about a user is stored outside the Supabase project you own.

## The privacy boundary (read this before you add a feature)

**RoxyAPI receives only calculation inputs: a date, a time, coordinates, a timezone, and a name where a numerology calculation needs one. It never receives journal entries, mood logs, or chat history.**

That is not a style preference. Conversation content, recalled memories, and everything in the `memories` and `readings` tables stay inside your Supabase project, protected by row level security. If you add a feature that would put a sentence the user wrote into a calculation request, the design is wrong: split it so the calculation gets the birth data and the language model gets the sentence.

The only thing that leaves your database besides birth data is the text you choose to send to your language model provider, which is the provider the forker picked and pays for.

## Tables

Four tables, all in `public`, all with row level security enabled and every policy keyed to `auth.uid()`. Migrations are checked in under `supabase/migrations/` so a fresh project reproduces the schema exactly.

| Table | Holds | Lifecycle |
|---|---|---|
| `profiles` | `id` (the auth user), display name, birth date, birth time, latitude, longitude, IANA timezone, birth place label, tone preset | Written once at onboarding. Birth data is immutable afterwards, because the cached chart was computed from it. |
| `charts` | `user_id` (primary key), `natal` jsonb, `computed_at` | Written once, ever. The primary key on `user_id` is what makes that structural rather than a promise. |
| `readings` | `user_id`, `created_at`, `kind`, `data` jsonb, `shown` text | Append only. One row per turn the companion answered, holding the structured response it was grounded in and the text the user actually saw. |
| `memories` | `user_id`, `created_at`, `content`, `embedding vector(768)`, `reading_id` | Append only. The semantic index over what was said. |

`charts.user_id` being the primary key is the single most important line in the schema. A natal chart is computed from immutable birth data, so it is worth exactly one calculation for the lifetime of the account. The table cannot hold a second row for the same person, so a bug that retried the computation would fail loudly on the insert instead of quietly billing every conversation.

### Row level security

Every table follows the same shape:

```sql
alter table public.readings enable row level security;

create policy "readings are private to their owner"
  on public.readings for select
  using ((select auth.uid()) = user_id);
```

`(select auth.uid())` rather than a bare `auth.uid()` is deliberate: wrapping it in a subselect lets Postgres evaluate it once per statement instead of once per row, which is the difference between a fast and a slow policy on a growing table.

Insert policies use `with check` on the same predicate, so a client cannot write a row belonging to somebody else even though it holds a valid session. `tests/schema.test.ts` reads the migration files and fails if any table is missing either the `enable row level security` line or a policy, which is the guard that stops a future table from shipping open.

## Semantic recall

`memories.embedding` is a `vector(768)` column from pgvector, indexed with HNSW under cosine distance:

```sql
create index memories_embedding_idx on public.memories
  using hnsw (embedding extensions.vector_cosine_ops);
```

Search goes through one SQL function rather than a client side query, so the vector never travels twice:

```sql
create function public.match_memories(query_embedding extensions.vector(768), match_count int)
returns table (id uuid, content text, created_at timestamptz, similarity float)
language sql stable security invoker set search_path = ''
```

`security invoker` is required. A `security definer` function would run as its owner and bypass row level security, which would hand every user the whole table through one call. Invoker keeps the caller identity, so the policy on `memories` still applies inside the function, and the body filters on `auth.uid()` as well so the planner can use the index.

**Dimensions are 768.** That is a deliberate choice and it is written into the column type, the index, and the function signature, so changing it means a migration. 768 is small enough to stay well inside the pgvector index limit, cheap to store, and available on every embedding model this template supports.

## The seam

All of it lives behind one module, `src/lib/memory/`, and there are exactly two verbs.

```ts
const memories = await recall(supabase, userMessage);   // before the model call
await remember(supabase, { kind, data, shown, prompt }); // after it
```

`recall` runs before the language model call and returns the past the model should see. `remember` runs after it and appends what just happened. Nothing else in the codebase reads or writes `readings` or `memories`. If you find yourself adding a third verb, the flow has probably grown a step that belongs inside one of these two.

Both return and accept the same shape whichever path they take, which is what makes the fallback below invisible to the caller.

### Graceful degradation is a property of `recall`, not of the caller

Semantic recall needs an embedding model. Two of the three supported chat providers offer one, and one does not, so `recall` has two paths and picks by configuration:

| Configured provider | Embedding model | Recall path |
|---|---|---|
| Google (default) | `gemini-embedding-001`, output dimensionality 768 | pgvector, top matches by cosine similarity |
| OpenAI | the current small text embedding model, `dimensions` set to 768 | pgvector, top matches by cosine similarity |
| Anthropic | none | most recent readings, newest first |

When no embedding model is configured, `recall` returns the most recent `readings` rows instead of searching `memories`, and `remember` writes the reading and skips the embedding. The companion still remembers, it just remembers chronologically rather than thematically. The tutorial this template implements is explicit that a timestamped reading history is already a strong companion, so this is a documented mode, not a broken one.

**There is a third way onto the recency path, and it is the one that actually happens: the embedding call fails.** Free tiers rate limit embeddings hard, and this product asks for two embeddings per turn, one to search with and one to store. So `recall` catches a failing embedding and falls back to recency rather than failing the turn, and `remember` stores the reading first and treats a failed index entry as a warning rather than an error, because the row it would have pointed at is already safe and an index can be rebuilt from rows.

The rule underneath both: **an embedding provider having a bad minute costs the quality of one recall, never an answer and never a history.** Both paths log, because a companion that quietly stopped remembering looks exactly like one that is working. `tests/memory.test.ts` covers both.

`getEmbeddingModel()` in `src/lib/ai.ts` returns the model or `null`, and it is the only place that decision is made. It sits beside `getModel()` because both answers come from the same one variable. Read that function, not the provider table, when you want to know what will happen.

## Request flow

One turn, in order. The numbering matches the tutorial the template implements.

1. **Identify.** The Supabase server client resolves the session from cookies. No session, no turn.
2. **Load the cached chart.** One read of `charts` by user. No calculation call, forever, past the first one.
3. **Recall.** `recall(supabase, userMessage)` returns the relevant past, semantically or chronologically.
4. **Fetch live facts.** The transits for today, computed against the stored birth data through `@roxyapi/sdk`. This is the only outbound calculation call in a conversation, and it carries birth data only.
5. **Assemble.** `buildSystemPrompt` folds the chart summary, the recalled memories, the live transits, and the chosen tone into one system prompt. It is a pure function and it is where you look when the companion says something you did not expect.
6. **Stream.** The reply streams to the browser.
7. **Remember.** On finish, `remember` appends the reading and, when embeddings are configured, the embedded memory.

Step 2 and step 4 are the whole argument. The expensive, immutable thing is computed once and stored. The cheap, time dependent thing is computed fresh. Neither one is guessed by the model.

## Where the paywall goes

This template ships no payments and never will, because a template that guesses at your pricing is a template you have to unpick. It ships the thing worth charging for.

Memory is the natural paid tier in a companion product: free users get the chart and today, paying users get a companion that remembers them. The seam is already in the right place for that. Gate `recall` and `remember` on a subscription flag on `profiles`, and the free experience degrades to a stateless assistant without a single change to the conversation code.

## Local development

The schema runs locally with the Supabase CLI, no hosted project needed:

```bash
npx supabase start          # starts Postgres, Auth, and the local dashboard
npx supabase db reset       # applies every migration in supabase/migrations
```

`npx supabase start` prints the local API URL and the publishable key. Put them in `.env.local` as described in [config.md](./config.md). Magic links sent locally are captured by the local mail viewer rather than delivered, and the CLI prints its address when it starts.

To change the schema, add a new file under `supabase/migrations/` with a timestamp prefix and run `npx supabase db reset`. Never edit a migration that has already run somewhere real. Then update `src/types/database.ts` to match, which `tests/schema.test.ts` will insist on.
