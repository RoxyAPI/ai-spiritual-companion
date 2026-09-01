# Integrations

Three services. One computes, one remembers, one talks. Nothing else is required to run this.

## RoxyAPI, the calculations

Every chart, transit, and city lookup comes from https://roxyapi.com. One key covers every domain, so there is no base URL to configure and no schema to keep in sync.

- Key: `ROXYAPI_KEY`, server side only. Get one at https://roxyapi.com/pricing
- Client: `@roxyapi/sdk`, called through `src/lib/roxy/`. See [code.md](./code.md) for the endpoints and where each is called.
- Positions are verified against NASA JPL Horizons. The verification tables are at https://roxyapi.com/methodology
- Free live playground: https://roxyapi.com/api-reference

This template makes at most one calculation call per conversation turn, plus one for the whole life of an account. The chart is the expensive immutable thing and it is stored, which is the entire architectural point.

## Supabase, the memory

Identity, the database, and the vector index, all in one project. Schema and policies are in [memory.md](./memory.md).

**Local**, which needs Docker and no account:

```bash
npx supabase start
npx supabase db reset
```

The command prints an API URL, a publishable key, and the address of a local mail viewer where magic links are captured instead of being delivered.

**Hosted**, for a real deployment:

1. Create a project at https://supabase.com/dashboard
2. `npx supabase link --project-ref <your-project-ref>`
3. `npx supabase db push` to apply the migrations
4. Copy the project URL and the publishable key from the API settings into your environment
5. In Authentication, add your deployed URL to the redirect allow list, or the magic link will bounce back to localhost

The publishable key is public by design. It is safe only because row level security is enabled on every table and every policy is keyed to the signed in user. If you ever add a service role key to this project, understand that it bypasses all of that, and put it nowhere near a route handler.

pgvector ships with Supabase as an extension. The first migration enables it; there is nothing to install.

## The language model

Pick one with `LLM_PROVIDER`. The comparison lives here; the model identifiers live in `src/lib/ai.ts`.

| Provider | Value | Get a key | Cost shape | Embeddings |
|---|---|---|---|---|
| Google | `google` (default) | https://aistudio.google.com/apikey | Free tier available, then pay as you go | Yes, same key. The free tier rate limits embeddings tightly, so recall falls back to recency when it is exceeded |
| Anthropic | `anthropic` | https://console.anthropic.com/settings/keys | Pay as you go, billing required first | No, recall falls back to recency |
| OpenAI | `openai` | https://platform.openai.com/api-keys | Pay as you go, billing required first | Yes, same key |

Google is the default because one key covers both the conversation and the embeddings, which keeps a first run to two keys in total.

Adding a provider means installing its AI SDK package, adding a branch to `getModel()`, and, if it has an embedding endpoint that can produce 768 dimensions, a branch to `getEmbeddingModel()`. If it cannot produce 768, do not force it: return `null` and let recall fall back, or write a migration that changes the dimension everywhere it appears.

## Deploying to Vercel

The deploy button in the README clones the repository and prompts for the environment variables. After the first deploy:

1. Point a Supabase project at it, hosted rather than local, per the steps above
2. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `ROXYAPI_KEY`, and your model key
3. Set `siteUrl` in `src/config/companion.config.ts` to the deployed domain and push, so canonical URLs and the social card resolve
4. Add the deployed domain to the Supabase redirect allow list

The build itself needs none of these. Continuous integration builds this project with no secrets at all, which is deliberate: a fork should be able to deploy before it has bought anything.

## Deliberately absent

- **No analytics.** Add your own if you want it. A template that phones home on a product belonging to somebody else is a template with a problem.
- **No error reporting service.** Same reason.
- **No payments.** [memory.md](./memory.md) explains where the paid line naturally falls and why the template leaves it to you.
- **No email service.** Magic links go through Supabase Auth, which is enough to run this. Attach a real sender in the Supabase dashboard before you have real users, because the built in one is rate limited for development.
