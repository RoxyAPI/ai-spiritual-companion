# Code

Architecture, the two service boundaries, and what the tests actually guard.

## Layout

```
src/
├── app/                    routes, one folder per screen. See pages.md
│   ├── api/chat/           the streaming turn
│   ├── api/cities/         the city search proxy
│   └── globals.css         the palette, the container, the grain. See design.md
├── components/
│   ├── companion/          the transcript with its composer, and one message
│   ├── onboarding/         the form and the city autocomplete
│   ├── ui/                 shadcn primitives, unmodified
│   └── section.tsx         the layout primitive
├── config/companion.config.ts   the one file a fork edits. See config.md
├── lib/
│   ├── ai.ts               which model answers and which one embeds. See companion.md
│   ├── auth.ts             session helpers and the onboarding gate
│   ├── chart.ts            a stored chart compressed to the facts a turn can use
│   ├── chat-limit.ts       per user turn caps, counted off the readings table
│   ├── mcp.ts              the tools the conversation may call. See companion.md
│   ├── memory/             recall and remember. See memory.md
│   ├── prompt.ts           buildSystemPrompt and the tone presets
│   ├── roxy/               the calculation client and its error guard
│   ├── seo.ts              the one structured data block. See seo.md
│   ├── supabase/           the server client and the session refresh client
│   └── utils.ts            cn, and the redirect path sanitizer the confirm route trusts
├── types/
│   ├── database.ts         the schema as TypeScript. Guarded by tests/schema.test.ts
│   └── index.ts            every other type in the project
supabase/migrations/        the schema itself
tests/                      eight suites plus one that runs weekly
```

## Types live in one place

`src/types/index.ts`, imported as `@/types`. A type declared next to the first file that needed it is a type the next person redeclares slightly differently.

Two exceptions, both deliberate. Calculation response types come from `@roxyapi/sdk`, which generates them from the live specification, so they are never hand written here. And `src/types/database.ts` holds the schema as TypeScript, because Supabase types the whole client from it.

`database.ts` is hand written rather than generated, for one reason: `charts.natal` and `readings.data` are `jsonb`, and a generated type calls them `Json`, which would force a cast at every read. Writing it by hand lets `natal` be typed as the calculation response it actually holds, so the chart page reads `chart.natal.planets[0].sign` with real type checking and no cast anywhere in the project. `tests/schema.test.ts` reads the migration SQL and fails if the file drifts from it, which is the trade that makes hand writing safe.

## The calculation boundary

`src/lib/roxy/client.ts` starts with `import 'server-only'`. That single line turns any accidental import from a client component into a build error, so the key cannot reach the browser by mistake rather than by discipline.

```ts
const roxy = createRoxy(process.env.ROXYAPI_KEY ?? '');
```

`src/lib/roxy/guard.ts` maps the stable error codes the API returns onto messages a person can act on, and exports `unwrap` (throws) and `tryUnwrap` (returns a discriminated result). Every call goes through one of them. Never call `fetch` against the API directly, never construct a second client, and never hand write a response type: `@roxyapi/sdk` ships them, generated from the live specification, and a local interface for a remote response is the one thing guaranteed to rot.

### Endpoints the application calls itself

Two, and both are places where exactly one call must happen, which is why neither is left to the model.

| Endpoint | SDK method | Called from | How often |
|---|---|---|---|
| `GET /location/search` | `roxy.location.searchCities` | `/api/cities`, behind the onboarding autocomplete | While somebody types their birth city |
| `POST /astrology/natal-chart` | `roxy.astrology.generateNatalChart` | the onboarding server action | **Once per account, ever.** The result is stored and the primary key on `charts.user_id` makes a second row impossible |

Everything the conversation needs comes from Remote MCP servers instead, reached by the model itself. That half lives in `src/lib/mcp.ts` and is explained in [companion.md](./companion.md), including why the natal chart tool is withheld from the model even though it exists.

## The Supabase boundary

Two clients, both server side, in `src/lib/supabase/`.

- `server.ts` for server components, server actions, and route handlers. It reads and writes the session cookies.
- `proxy.ts` refreshes the session on every request so a server component never sees an expired one.

They differ only in how they reach cookies. Do not add a third.

**There is no browser client, and that is deliberate.** The sign in form and the sign out button are client components, but neither one talks to Supabase: both call a server action in `src/app/auth/actions.ts` and the session work happens there. So nothing in the browser bundle ever constructs a Supabase client, and the Supabase API port never has to be reachable from a visitor network at all. Adding a browser client would put that port back on the public path, which is a larger change than the round trip it saves.

Every query runs as the signed in user, so row level security is doing the access control and the application code is not repeating it. There is no service role key in this project at all. Adding one would mean any bug in a route handler bypasses every policy at once.

## Two tools, one job each

**Biome** formats and organises imports. **ESLint** with the Next configuration owns the framework rules Biome does not cover: hooks, images, accessibility. The Biome linter is off in `biome.json` so the two never argue about the same line. `next-env.d.ts` is excluded from both, since Next generates and ignores it.

## Scripts

| Script | What it runs |
|---|---|
| `npm run dev` | The development server |
| `npm run build` | The production build. Must pass with no keys set |
| `npm start` | Serves a build that has already been made |
| `npm run format` | Biome, formatting only |
| `npm run check` | Biome, fixing what it can |
| `npm run check:ci` | Biome, failing instead of fixing |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | The six local suites |
| `npm run test:drift` | The specification drift suite. Hits the network, runs weekly, never in a pull request |
| `npm run verify` | The whole gate in the order it runs everywhere else |
| `npm run db:reset` | Recreates the local database and reapplies every migration |
| `npm run db:types` | Prints the types the Supabase CLI generates from the local schema, to read against the hand written `src/types/database.ts` |

The order in `verify` is fixed and it is cheapest first: format, lint, types, tests, build. A two minute build should never be the thing that tells you about a missing semicolon. The same order runs on commit and on push through the git hooks, and again on every pull request.

## What the tests guard

`npm test` is six drift guards, not a coverage exercise.

| Suite | Asserts |
|---|---|
| `schema` | The migrations create exactly the four tables of the memory layer, `charts.user_id` is the primary key, `profiles` and `charts` carry no update or delete policy, every table has row level security enabled with at least one policy and every policy predicate is keyed to `(select auth.uid())`, `match_memories` is declared `security invoker` and never `security definer`, and `src/types/database.ts` names exactly the tables and columns the migrations create. This is the guard on the security promise in [memory.md](./memory.md). |
| `memory` | `recall` returns recency when no embedding model is configured and searches vectors when one is, both return the same shape, and a failing embedding provider degrades to recency rather than failing the turn or losing the reading. |
| `mcp` | The default domain set stays lean and leads with Western astrology, the tool selection stays inside the range vendors publish as reliable, the compact flag reaches every call, and the natal chart tool is never handed to the model. |
| `prompt` | Every tone preset in the type union has a paragraph, the grounding rules and both boundary blocks survive under all of them, and the recalled memories and chart facts reach the prompt. |
| `guard` | Each error code still maps to a message, and a missing key never reaches the network. |
| `design-tokens` | Every palette token exists in light and in dark, and nothing except `globals.css` declares the site width. |

`npm run test:drift` is separate and touches the network: it asserts the two endpoints above still exist in the live OpenAPI specification, and that every domain the conversation connects to is still mounted. It runs on a schedule rather than on pull requests, because a green build must never depend on a third party being reachable.

Each of these was validated by planting a deliberate error and watching it fail. A test that reads a file and asserts a value can pass vacuously, so if you add one, break it once on purpose before you trust it.

## House style

- Server components by default. Eight files of ours carry `'use client'`, and that is the whole list: the transcript with its composer (`companion/chat.tsx`), one message (`companion/message.tsx`), the onboarding form and the city autocomplete, the sign in form, the sign out button, the theme provider, and the theme toggle. The shadcn primitives under `components/ui/` ship their own directive and are not counted, because they are unmodified.
- No `as any`, no hand written interfaces for API responses, no dead code.
- Comments are for the non obvious why. The default is no comment.
- Reuse before you add. Check `src/lib/` and `src/components/` before writing a helper that probably already exists.
- No apostrophes, no em dashes, and no double hyphens in any prose a reader of this repository will see. Code is exempt.

## Decision log

Choices that are settled, with the reason, so nobody has to relitigate them from the code.

| Decision | Why |
|---|---|
| The name is `ai-spiritual-companion` | It says what the thing is, and it will still be right when the stack under it changes. |
| Supabase for identity, storage, and vectors, rather than a separate vector service | The deploy target has an ephemeral filesystem and no shared memory between invocations, so an embedded index cannot hold per user memory there and an external store is required either way. Given that, one service covering auth, structured memory, vectors, and per user isolation beats bolting three together and still ending on a hosted service. |
| Semantic recall ships in the first version, not a later one | Recall by meaning is the difference between remembering and logging, and pgvector is an extension rather than a dependency, so the cost of shipping it was one column and one function. Recency remains a real mode, not a stub. |
| 768 dimensions | Available on every embedding model this template supports, comfortably inside the index limit, and a quarter of the storage of the widest option for no loss that matters at this scale. |
| The streaming library is on its current major | The route handler composes a stream and the client reads message parts, which is the shape of the current major and not of the one before it. Dependabot holds that major so the core and the provider packages can only move together. |
| The schema type is hand written | So a jsonb column can be typed as the response it actually holds. The migration contract test is what makes that safe. Reasoning above. |
| Tool calling through Remote MCP, but no agent framework | The live half of the calculations is fetched by the model, in a bounded number of steps, so a question that needs today sky gets it and one that does not costs nothing. What is settled is the layer above: no planner, no router, and no second model deciding what to do. One model, one turn, and the memory around it. Reasoning is in [companion.md](./companion.md). |
| No payments | A template that guesses at your pricing is a template you unpick before you use it. The memory seam is already where a paid line would go. |
