# Agents Guide

An MIT licensed template: an AI spiritual companion that remembers the person it is talking to. Next.js 16 App Router with TypeScript, Tailwind 4 and shadcn components, Supabase for identity and storage, pgvector for semantic memory, the Vercel AI SDK for the conversation, `@roxyapi/sdk` for the two calculations the application owns, and Remote MCP for everything the model reaches itself. There is one product idea underneath all of it: **the calculations are stateless and exact, and the memory is stateful and yours.** A natal chart is computed once from immutable birth data and stored forever, live facts are fetched only when a question needs them, and everything personal lives in a Supabase project the owner controls, behind row level security, where it never reaches the calculation service.

You are most likely a coding agent helping somebody make this their own. Protect that idea when you change anything. More templates to fork: https://roxyapi.com/starters

## Canonical RoxyAPI references (use these, do not guess)

Prefer these live sources over memory for any RoxyAPI path, field, SDK method, or limit. They are always current.

- **Docs MCP (no API key):** connect `https://roxyapi.com/mcp/docs` (Streamable HTTP, one tool `search_docs`). Ask it for any endpoint, field, or integration step instead of hardcoding a path. `{ "mcpServers": { "roxy-docs": { "type": "http", "url": "https://roxyapi.com/mcp/docs" } } }`
- **Agent playbook:** `https://roxyapi.com/AGENTS.md`, implementation rules for building on RoxyAPI.
- **Discovery context:** `https://roxyapi.com/llms.txt` (concise) and `https://roxyapi.com/llms-full.txt` (deep).
- **Live OpenAPI spec:** `https://roxyapi.com/api/v2/openapi.json`, the source of truth for every field and example. Never invent a response field.
- **SDK reference:** `node_modules/@roxyapi/sdk/AGENTS.md` for method names and the two step geocode pattern. Response types are exported from the same package; never redeclare one.
- **Live playground:** `https://roxyapi.com/api-reference`. **Sitemap:** `https://roxyapi.com/sitemap.txt`.

## Setup

1. Get an API key at https://roxyapi.com/pricing and a model key from one of the providers in `docs/integrations.md`.
2. Start the database. This needs Docker and no account: `npx supabase start`, then `npx supabase db reset` to apply the migrations. The first command prints an API URL, a publishable key, and the address of a local mail viewer that catches the sign in links.
3. `cp .env.example .env.local` and fill in the five values it documents.
4. `npm install`, then `npm run dev`, then open http://localhost:3000
5. `npm run verify` runs the whole gate in the order everything else runs it: format, lint, types, tests, build with no key. Run it before you push. The same order runs on commit and on push.

## Endpoints it actually calls

The calculation layer is split by one question: does exactly one call have to happen? Where the answer is yes, the application makes the call through the typed SDK. Everything else is reached by the model itself over Remote MCP.

| Endpoint | SDK method | Called from | How often |
|---|---|---|---|
| `GET /location/search` | `roxy.location.searchCities` | `/api/cities`, behind the onboarding autocomplete | While somebody types their birth city |
| `POST /astrology/natal-chart` | `roxy.astrology.generateNatalChart` | the onboarding server action | **Once per account, ever** |

The conversation reaches the rest through Remote MCP servers at `https://roxyapi.com/mcp/{domain}`, connected in `src/lib/mcp.ts`. The model resolves a place, reads today sky, or draws a card when a question needs it, and skips all of it when a question does not.

Three things about that module are load bearing.

**The default connects a few domains, not all of them.** Every connected tool is a tool definition in front of the model on every turn, and vendors document selection accuracy falling as that list grows. `ROXYAPI_MCP_PRODUCTS` widens it, and every domain on the platform works without a code change. Sources and numbers: `docs/companion.md`.

**Every call asks for the compact response shape.** `compact: true` returns the same data with each field name sent once for a whole array instead of once per row, which is lossless and roughly 40 to 52 percent fewer tokens on a detailed chart. It is injected by a wrapper and asked for again in the system prompt. Lower inference cost, no bearing on how many requests are counted.

**The natal chart tool is never given to the model.** The application computes that once per account and caches it, and a guarantee a model can opt out of is not a guarantee. It is already in the prompt on every turn.

Every tool result also renders. `src/lib/tool-widgets.ts` reads the `dynamic-tool` parts of an assistant message, asks `componentForTool` from `@roxyapi/ui-react` which component draws that tool name, parses the JSON text block, and `src/components/companion/tool-widget.tsx` mounts it above the prose in the same bubble. Nothing is listed per tool: connect a domain and its results draw themselves, and a tool no component covers keeps the written answer. `/chart` draws the stored chart with the same library, through `src/components/natal-wheel.tsx`. Compact results are decoded inside the components, so leave `compact` on. Full pattern: https://roxyapi.com/docs/tutorials/ai-chat-widgets

## How the memory works

One turn, in order:

1. The Supabase server client resolves the session from cookies.
2. The cached chart is read from the database. No calculation call.
3. `recall` returns the relevant past, by meaning through pgvector, or by recency when there is no embedding model or the embedding call fails.
4. The tool set is gathered from the connected Remote MCP servers.
5. `buildSystemPrompt` folds all of it plus the chosen tone into one prompt. It is a pure function, and it is where to look when the companion says something unexpected.
6. The reply streams, and the model calls whichever calculations the question actually needed.
7. `remember` appends the reading, what it was grounded in, and, when embeddings are available, the embedded memory.

**`src/lib/memory/` is the only module that reads or writes `readings` and `memories`. Two verbs, `recall` and `remember`.** If you are adding a third, the flow has grown a step that belongs inside one of them.

Four tables, all with row level security keyed to the signed in user: `profiles`, `charts` (one row per account, enforced by the primary key), `readings` (append only), `memories` (append only, `vector(768)`). Full schema and reasoning: `docs/memory.md`.

## How to extend it

**Give the companion another domain.** Add its slug to `ROXYAPI_MCP_PRODUCTS` and add the tool names you want to `COMPANION_TOOLS` in `src/lib/mcp.ts`, or set `ROXYAPI_MCP_TOOLS=all` to hand over everything the connected domains offer. No code change and no upgrade, including for domains added to the platform after this was written. Watch the total: the tool count guidance in `docs/companion.md` is the thing to stay inside.

**Add an application controlled reading.** When exactly one call must happen at a moment you choose, rather than when a model decides, do it the way onboarding does: call it through `unwrap` in a server action, and pass the rendered text to `remember` with a new `kind`. The memory layer needs no change, because `readings.kind` is a free string precisely so a fork can add its own. Do not add a second API client.

**Change the voice.** `src/lib/prompt.ts` holds four tone presets and the rules that survive all of them. Adding a fifth is three steps and all three are required: the key in the `TonePreset` union in `src/types/index.ts`, the paragraph in `TONE_PRESETS`, and the option in the onboarding step. `tests/prompt.test.ts` fails until all three are done. The grounding rules and the safety boundaries sit outside the presets on purpose.

**Swap the model provider.** One environment variable, `LLM_PROVIDER`. Adding a fourth provider means installing its AI SDK package and adding one branch to `getModel()` in `src/lib/ai.ts`. If it also has an embedding endpoint that can produce 768 dimensions, add a branch to `getEmbeddingModel()`; if it cannot, return `null` and recall falls back to recency by itself.

**Add paid plans.** This is expected and welcome. Memory is the natural premium feature in a companion product, and the seam is already in the right place: add a subscription flag to `profiles`, gate `recall` and `remember` on it, and the free experience degrades to a capable stateless assistant with no change to the conversation code. Everything in this repository is MIT, including whatever you build on top.

**Change the look.** Two blocks in `src/app/globals.css`, light and dark. `tests/design-tokens.test.ts` fails if you finish one and forget the other.

**Theme the drawings.** The `--roxy-*` block at the end of `:root` in `src/app/globals.css` points every surface, ink, border, status colour, focus ring, typeface, corner and shadow the components paint at a palette token, so they move with a recolour and need no second copy in `.dark`. Never restyle a component to change how a drawing looks: set a token, and if the product has no token for what you need, add it to the palette first. Reasoning, the surface pairing that is easy to get backwards, and the tokens left to derive: `docs/design.md`. Every token, its light and dark default and what it paints: https://github.com/RoxyAPI/ui/blob/main/packages/ui/THEMING.md

## The rules that are not style preferences

**The calculation service receives birth data only.** A date, a time, coordinates, a timezone. Never a journal entry, never a mood, never a line of the conversation. If a feature you are adding would put something the person wrote into a calculation request, the design is wrong: split it so the calculation gets the birth data and the language model gets the sentence.

**The natal chart is computed once per account, ever.** It comes from immutable birth data, so a second call is pure waste. `charts.user_id` is the primary key, which makes that structural rather than a promise. Do not add a refresh button.

**Row level security is the access control.** Every query runs as the signed in user and every policy is keyed to `auth.uid()`. The application code does not repeat the check, and there is no service role key in this project. Adding one means a bug in any route handler bypasses every policy at once.

**Location first, chart second.** Never ask somebody for coordinates. The city autocomplete resolves latitude, longitude and the IANA timezone, and the IANA name is what gets stored, because it is the form that stays correct across a daylight saving boundary in the year somebody was born.

**The build must work with no keys.** Every call happens when somebody asks a question, never at build time, so a fork can deploy before it has bought anything.

## Conventions

- Server components by default. `'use client'` only for the transcript, the message, the drawn tool results, the drawn natal chart, the onboarding steps, the city autocomplete, the theme provider, the theme toggle, the sign in form, and the sign out button. That is ten files, and the shadcn primitives under `components/ui/` carry their own directive.
- **A page never sets a width, a gutter, or a section padding.** Compose `<Section>`; it owns the full width band, the optional wash, the shared container, and the rhythm. The width is declared once, as `.site-container`, and a test fails if anything redeclares it. The conversation screen is the single documented exception and it owns its height, not its width.
- **Types live in `src/types/` and nowhere else.** API response types are never among them: import those from `@roxyapi/sdk`, which generates them from the live spec.
- No `as any`, no hand written interfaces for API responses, no dead code.
- No apostrophes, no em dashes, and no double hyphens in prose that a reader of this repository will see. Code is exempt.
- Reuse before you add. Check `src/lib/` and `src/components/` first.

## What the tests guard

`npm test` is seven drift guards, not a coverage exercise. Keep them passing and keep them honest.

- `schema` : every table in the migrations has row level security enabled and a policy, the search function is `security invoker` rather than `security definer`, and the TypeScript schema still matches the SQL.
- `memory` : recall degrades to recency without an embedding model and searches vectors with one, both paths return the same shape, and a failing embedding provider costs the quality of one recall rather than the turn or the reading.
- `prompt` : every tone preset has a voice, and the grounding rules and the safety boundaries survive under all of them.
- `guard` : each API error code still maps to a message somebody can act on, and a missing key never reaches the network.
- `design-tokens` : every palette token exists in light and dark, every `--roxy-*` token holds a reference to one of them rather than a colour of its own, the drawn corners still match the radius scale, the social card still uses the palette it cannot read, and only the stylesheet declares the site width.
- `tool-widgets` : a completed tool call resolves to the component that draws it, a server prefixed tool name still resolves, and a failed call, an undrawable tool and an unparsable result each leave the written answer standing rather than throwing inside the render.
- `mcp` : the default domain set stays lean, the tool selection stays inside the published guidance, the compact flag reaches every call, and the natal chart tool is never handed to the model.

`npm run test:drift` is separate and hits the network: it checks that the two endpoints above still exist in the live specification and that every domain the conversation connects to is still mounted. It runs weekly, not on pull requests, because a green build must never depend on a third party being reachable.

If you add a guard, break it once on purpose and watch it fail before you trust it. A test that reads a file and asserts a value can pass vacuously.

## The docs router

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

## Upstream sync

`@roxyapi/sdk` regenerates from the live specification, so a new endpoint or a corrected type arrives through a dependency update rather than a code change. When a dependency update turns red on a single nullability error naming a single file, read it: that is usually the generated client correctly reporting a field that was always nullable and was always read unguarded.
