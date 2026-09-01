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
│   ├── companion/          the transcript, the composer, the message
│   ├── onboarding/         the form and the city autocomplete
│   ├── ui/                 shadcn primitives, unmodified
│   └── section.tsx         the layout primitive
├── config/companion.config.ts   the one file a fork edits. See config.md
├── lib/
│   ├── ai.ts               which model answers. See companion.md
│   ├── auth.ts             session helpers and the onboarding gate
│   ├── memory/             recall and remember. See memory.md
│   ├── prompt.ts           buildSystemPrompt and the tone presets
│   ├── roxy/               the calculation client and its error guard
│   └── supabase/           the browser, server, and middleware clients
├── types/
│   ├── database.ts         the schema as TypeScript. Guarded by tests/schema.test.ts
│   └── index.ts            every other type in the project
supabase/migrations/        the schema itself
tests/                      five suites plus one that runs weekly
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

### Endpoints this template calls

Three, and each one is called exactly where you would expect.

| Endpoint | SDK method | Called from | How often |
|---|---|---|---|
| `GET /location/search` | `roxy.location.searchCities` | `/api/cities`, behind the onboarding autocomplete | While somebody types their birth city, once |
| `POST /astrology/natal-chart` | `roxy.astrology.generateNatalChart` | the onboarding server action | **Once per account, ever.** The result is stored and the primary key on `charts.user_id` makes a second row impossible |
| `POST /astrology/transits` | `roxy.astrology.calculateTransits` | `/api/chat` | Once per turn, for today's sky |

The transits request takes the **birth data**, not the chart response, in its `natalChart` field. Passing the stored chart back returns a validation error. Keep sending the same immutable birth values the chart was computed from.

## The Supabase boundary

Three clients, one per environment, in `src/lib/supabase/`.

- `client.ts` for the browser, used only by the sign in form and the sign out button.
- `server.ts` for server components, server actions, and route handlers. It reads and writes the session cookies.
- `middleware.ts` refreshes the session on every request so a server component never sees an expired one.

They differ only in how they reach cookies. Do not add a fourth, and do not import the browser one on the server.

Every query runs as the signed in user, so row level security is doing the access control and the application code is not repeating it. There is no service role key in this project at all. Adding one would mean any bug in a route handler bypasses every policy at once.

## Two tools, one job each

**Biome** formats and organises imports. **ESLint** with the Next configuration owns the framework rules Biome does not cover: hooks, images, accessibility. Biome's linter is off in `biome.json` so the two never argue about the same line. `next-env.d.ts` is excluded from both, since Next generates and ignores it.

## Scripts

| Script | What it runs |
|---|---|
| `npm run dev` | The development server |
| `npm run build` | The production build. Must pass with no keys set |
| `npm run check` | Biome, fixing what it can |
| `npm run check:ci` | Biome, failing instead of fixing |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | The five local suites |
| `npm run test:drift` | The specification drift suite. Hits the network, runs weekly, never in a pull request |
| `npm run verify` | The whole gate in the order it runs everywhere else |

The order in `verify` is fixed and it is cheapest first: format, lint, types, tests, build. A two minute build should never be the thing that tells you about a missing semicolon. The same order runs on commit and on push through the git hooks, and again on every pull request.

## What the tests guard

`npm test` is five drift guards, not a coverage exercise.

| Suite | Asserts |
|---|---|
| `schema` | Every table in the migrations has row level security enabled and at least one policy, and `src/types/database.ts` names exactly the tables and columns the migrations create. This is the guard on the security promise in [memory.md](./memory.md). |
| `memory` | `recall` returns recency when no embedding model is configured and searches vectors when one is, `remember` writes a reading either way, and both return the same shape. |
| `prompt` | Every tone preset in the type union has a paragraph, the grounding rules and both boundary blocks survive under all of them, and the recalled memories and chart facts reach the prompt. |
| `guard` | Each error code still maps to a message, and a missing key never reaches the network. |
| `design-tokens` | Every palette token exists in light and in dark, and nothing except `globals.css` declares the site width. |

`npm run test:drift` is separate and hits the network: it fetches the live OpenAPI specification and asserts every endpoint in the table above still exists. It runs on a schedule rather than on pull requests, because a green build must never depend on a third party being reachable.

Each of these was validated by planting a deliberate error and watching it fail. A test that reads a file and asserts a value can pass vacuously, so if you add one, break it once on purpose before you trust it.

## House style

- Server components by default. `'use client'` only for the transcript, the composer, the city autocomplete, the theme toggle, and the sign in form.
- No `as any`, no hand written interfaces for API responses, no dead code.
- Comments are for the non obvious why. The default is no comment.
- Reuse before you add. Check `src/lib/` and `src/components/` before writing a helper that probably already exists.
- No apostrophes, no em dashes, and no double hyphens in any prose a reader of this repository will see. Code is exempt.
