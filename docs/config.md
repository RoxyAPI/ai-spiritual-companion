# Configuration

Everything a fork changes without touching a component. Two places: environment variables, and one typed config file.

## Environment variables

Copy `.env.example` to `.env.local`. Nothing here is ever prefixed `NEXT_PUBLIC_` except the two Supabase values that are designed to be public.

| Variable | Required | What it is |
|---|---|---|
| `ROXYAPI_KEY` | yes | Your RoxyAPI key. Server side only. It is read in one module and that module cannot be imported from the browser. Get one at https://roxyapi.com/pricing |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Your Supabase project URL. Public by design. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | yes | Your Supabase publishable key. Public by design, and safe only because row level security is on every table. See [memory.md](./memory.md). |
| `LLM_PROVIDER` | no | `google` (default), `anthropic`, or `openai`. See [companion.md](./companion.md). |
| `GOOGLE_GENERATIVE_AI_API_KEY` | with `google` | Free tier available. Covers chat and embeddings with one key. |
| `ANTHROPIC_API_KEY` | with `anthropic` | Chat only. Recall falls back to recency. |
| `OPENAI_API_KEY` | with `openai` | Covers chat and embeddings. |

Two keys is the intended steady state: one for calculations, one for the model. The Supabase values come from your project and are not secrets.

**The build must succeed with none of them set.** `env -u ROXYAPI_KEY npm run build` is part of the gate, and continuous integration carries no secrets at all. Every call happens when somebody asks a question, never at build time. If a change makes the build need a key, the change has a bug.

## `companion.config.ts`

One file, `src/config/companion.config.ts`, typed against `CompanionConfig` in `src/types/index.ts`. It is what a fork edits to make the product its own.

| Field | Type | Used by |
|---|---|---|
| `name` | string | The product name in the header, the page titles, and the system prompt |
| `tagline` | string | The landing hero and the meta description |
| `description` | string | The landing subheading and the social card |
| `siteUrl` | string | Canonical URLs, the sitemap, and the social card. Set it to your domain before you deploy. |
| `defaultTone` | `TonePreset` | Preselected in the onboarding form |
| `recallCount` | number | How many past memories reach the prompt each turn. Four is a good default; more crowds the context and dilutes the answer. |
| `supportUrl` | string | Where the footer sends somebody who needs help |

Nothing about colours, fonts, or layout lives here. Those are in `globals.css` and are covered by [design.md](./design.md), because a colour that can be set from a config file is a colour that has to be validated at runtime for no benefit.

There is no separate contract test for this file, because there are no feature toggles to hold to routes: the type checker already rejects a missing field or a tone that does not exist, and that is the whole contract.

## Supabase setup

Local, no account needed:

```bash
npx supabase start
npx supabase db reset
```

The CLI prints an API URL and a publishable key. Those two values are your `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for local work.

Hosted, for a deployment: create a project, then link and push.

```bash
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

The URL and the publishable key are in the project API settings. Full deployment notes are in [integrations.md](./integrations.md).

## What is deliberately not configurable

- **No theme switcher and no palette config.** One palette, light and dark, both designed. A fork changes the tokens in `globals.css` and the whole product follows.
- **No feature flags.** There are five screens and they all matter.
- **No payments.** The template ships the memory pattern, which is the thing worth charging for, and leaves the charging to you. Reasoning is in [memory.md](./memory.md).
