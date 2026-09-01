# Agents Guide

This is an MIT licensed RoxyAPI Template: an AI spiritual companion that remembers the person it is talking to. Next.js, Supabase, and the Vercel AI SDK, with every calculation coming from [RoxyAPI](https://roxyapi.com).

The idea it demonstrates is one line long. **The calculations are stateless and exact, the memory is stateful and yours.** A natal chart is computed once from immutable birth data and stored forever. Today's sky is computed fresh each turn. Everything personal, the reading history and the semantic memory, lives in a Supabase project the owner controls, behind row level security, and never reaches the calculation service. The companion is the join of those two things at request time.

That is the part worth protecting when you change anything here. You are most likely a coding agent helping somebody make this their own. More Templates to fork: https://roxyapi.com/starters

## Canonical RoxyAPI references (use these, do not guess)

Prefer these live sources over memory for any RoxyAPI path, field, SDK method, or limit. They are always current.

- **Docs MCP (no API key):** connect `https://roxyapi.com/mcp/docs` (Streamable HTTP, one tool `search_docs`). Ask it for any endpoint, field, or integration step instead of hardcoding a path. `{ "mcpServers": { "roxy-docs": { "type": "http", "url": "https://roxyapi.com/mcp/docs" } } }`
- **Agent playbook:** `https://roxyapi.com/AGENTS.md`, implementation rules for building on RoxyAPI.
- **Discovery context:** `https://roxyapi.com/llms.txt` (concise) and `https://roxyapi.com/llms-full.txt` (deep).
- **Live OpenAPI spec:** `https://roxyapi.com/api/v2/openapi.json`, the source of truth for every field and example. Never invent a response field.
- **SDK reference:** `node_modules/@roxyapi/sdk/AGENTS.md` for method names and the two step geocode pattern. Response types are exported from the same package; never redeclare one.
- **Live playground:** `https://roxyapi.com/api-reference`. **Sitemap:** `https://roxyapi.com/sitemap.txt`.

## Setup

- Get an API key at https://roxyapi.com/pricing and a model key from one of the providers in `docs/integrations.md`
- Copy `.env.example` to `.env.local` and fill it in
- Start the database: `npx supabase start`, then `npx supabase db reset` to apply the migrations. Needs Docker. The command prints the URL and anon key to put in `.env.local`
- `npm install`, then `npm run dev`, then open http://localhost:3000
- `npm run verify` runs the whole gate in the order everything else runs it: format, lint, types, tests, build with no key. Run it before you push. The same order runs on commit and on push.

## The task router

The specification lives in `docs/`. Read the file that owns the concern before changing anything, and update it in the same change.

| If you are asked to... | Read |
|---|---|
| Change how memory is stored, recalled, or embedded, or touch the schema or the policies | `docs/memory.md` |
| Change the model, the tone presets, the system prompt, or the streaming | `docs/companion.md` |
| Change the product name, the environment variables, or anything a fork edits | `docs/config.md` |
| Change colours, fonts, spacing, the transcript, or dark mode | `docs/design.md` |
| Add, remove, or restructure a screen, or change who can reach one | `docs/pages.md` |
| Understand the architecture, the two service boundaries, the scripts, or the tests | `docs/code.md` |
| Touch metadata, structured data, the sitemap, or the social card | `docs/seo.md` |
| Change a provider, deploy it, or wire up a hosted database | `docs/integrations.md` |

## The rules that are not style preferences

**The calculation service receives birth data only.** A date, a time, coordinates, a timezone. Never a journal entry, never a mood, never a line of the conversation. If a feature you are adding would put something the person wrote into a calculation request, the design is wrong. Split it: the calculation gets the birth data, the language model gets the sentence.

**The natal chart is computed once per account, ever.** It comes from immutable birth data, so a second call is pure waste. `charts.user_id` is the primary key, which makes that structural rather than a promise. Do not add a refresh button.

**Row level security is the access control.** Every query runs as the signed in user and every policy is keyed to `auth.uid()`. The application code does not repeat the check, and there is no service role key in this project. Adding one means a bug in any route handler bypasses every policy at once.

**Location first, chart second.** Never ask somebody for coordinates. The city autocomplete resolves latitude, longitude, and the IANA timezone, and the IANA name is what gets stored, because it is the form that stays correct across a daylight saving boundary in the year somebody was born.

**The build must work with no keys.** Continuous integration has no secrets, and a fork should be able to deploy before it has bought anything. Every call happens when somebody asks a question, never at build time.

## How a turn works

1. The Supabase server client resolves the session from cookies.
2. The cached chart is read from the database. No calculation call.
3. `recall` returns the relevant past, semantically through pgvector or chronologically when no embedding model is configured.
4. Today's transits are computed live, from the stored birth data.
5. `buildSystemPrompt` folds all of it plus the chosen tone into one prompt. It is pure, and it is where to look when the companion says something unexpected.
6. The reply streams.
7. `remember` appends the reading and, when embeddings are on, the embedded memory.

`src/lib/memory/` is the only module that reads or writes `readings` and `memories`. Two verbs, `recall` and `remember`. If you are adding a third, the flow has grown a step that belongs inside one of them.

## What the tests guard

`npm test` is five drift guards, not a coverage exercise. Keep them passing and keep them honest.

- `schema` : every table in the migrations has row level security enabled and a policy, and the TypeScript schema still matches the SQL.
- `memory` : recall degrades to recency without an embedding model and searches vectors with one, and both paths return the same shape.
- `prompt` : every tone preset has a voice, and the grounding rules and the safety boundaries survive under all of them.
- `guard` : each API error code still maps to a message a person can act on.
- `design-tokens` : every palette token exists in light and dark, and only the stylesheet declares the site width.

`npm run test:drift` is separate and hits the network: it checks that every endpoint this template calls still exists in the live specification. It runs weekly, not on pull requests, because a green build must never depend on a third party being reachable.

If you add a guard, break it once on purpose and watch it fail before you trust it. A test that reads a file and asserts a value can pass vacuously.

## House style

- No apostrophes, no em dashes, and no double hyphens in any prose a reader of this repository will see. Code is exempt.
- Server components by default. `'use client'` only for the transcript, the composer, the city autocomplete, the theme toggle, and the sign in form.
- **A page never sets a width, a gutter, or a section padding.** Compose `<Section>`; it owns the full width band, the optional wash, the shared container, and the rhythm. The site width is declared once, as `.site-container`, and a test fails if anything redeclares it. The conversation screen is the single documented exception and it owns its height, not its width.
- **Types live in `src/types/` and nowhere else.** API response types are never among them: import those from `@roxyapi/sdk`.
- No `as any`, no hand written interfaces for API responses, no dead code.
- Reuse before you add. Check `src/lib/` and `src/components/` first.

## Upstream sync

`@roxyapi/sdk` regenerates from the live specification, so a new endpoint or a corrected type arrives through a dependency update rather than a code change. When a dependency update turns red on a single nullability error naming a single file, read it: that is usually the generated client correctly reporting a field that was always nullable and was always read unguarded.
