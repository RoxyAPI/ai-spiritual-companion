# Pages

Five screens and two API routes. Every screen either gets somebody to the conversation or is the conversation.

## Routes

| Route | Access | What it does |
|---|---|---|
| `/` | public | The landing page. What the product is, why memory is the difference, and one call to action. Redirects a signed in visitor to their next step. |
| `/auth/login` | public | Email field, one button, a magic link. Nothing else. |
| `/auth/confirm` | public, no UI | Route handler. Exchanges the link token for a session and forwards to `/onboarding` or `/companion`. |
| `/auth/error` | public | Where a stale or already used link lands, with a link back to try again. |
| `/onboarding` | signed in, no profile | Name, birth date, birth time, birth city, tone. Submitting it geocodes once, computes the chart once, and stores both. |
| `/companion` | signed in, onboarded | The conversation. |
| `/chart` | signed in, onboarded | The stored natal chart, rendered from the database with no calculation call. |
| `/api/chat` | signed in | POST. The streaming turn. See [companion.md](./companion.md). |
| `/api/cities` | signed in | GET. Proxies the city search so the key stays on the server. |

## Gating

There are three states a visitor can be in, and one helper decides which: `requireOnboarded()` in `src/lib/auth.ts`.

| State | `/` sends them to | `/onboarding` | `/companion` and `/chart` |
|---|---|---|---|
| Signed out | stays on the landing page | `/auth/login` | `/auth/login` |
| Signed in, no profile | `/onboarding` | renders | `/onboarding` |
| Signed in, onboarded | `/companion` | `/companion` | renders |

Middleware refreshes the Supabase session on every request so a server component never reads an expired one. It does not do the gating: gating lives in the pages, where the redirect target is obvious and testable, and middleware that redirects is middleware that eventually redirects in a loop.

## Anatomy

### `/` landing

Four bands, composed from `Section`.

1. **Hero.** Eyebrow, headline, one paragraph, and a single button that reads `Start` for a signed out visitor. Wash from the start corner.
2. **The argument.** Three columns: the calculation is stateless and exact, the memory is yours and private, the join is the companion. This is the section a reader screenshots, so it carries the claim that the calculations are verified against NASA JPL Horizons.
3. **How a turn works.** The seven step flow from [memory.md](./memory.md), compressed to five, as a numbered list. Concrete, no diagram.
4. **What it does not do.** Short and honest: no data leaves for a calculation except a birth date and a place, no conversation is ever sent to the calculation service, no payments are included. Wash from the end corner.

Footer carries the license, the source link, and the support link.

### `/onboarding`

One card, one form, one submit. Fields in order: display name, birth date, birth time, birth city, tone preset.

**The city field is an autocomplete, never a coordinate input.** Typing three characters queries `/api/cities`, results show city, province, and country because that is what separates two places with the same name, and choosing one captures the latitude, longitude, and IANA timezone silently. A person is never asked for a number they would have to look up. This is the rule that matters most on this screen and the reason the route exists.

Selection state is split from pending state: the chosen city stays chosen until a new one is picked, so the label never updates ahead of the value under it.

Submit runs a server action that validates, writes the profile, computes the chart once, and redirects. It is the only place in the product that calls the natal chart endpoint.

The card holding the autocomplete needs `overflow-visible`, or the dropdown is clipped by the card.

### `/companion`

Header row with the person's name, their tone, and a link to their chart. Then the transcript, then the composer. Layout rules are in [design.md](./design.md), including why this screen owns its height.

An empty transcript shows three suggested openers rather than a blank box, and each one is a question the companion can answer well because the chart and the sky are already in its context.

### `/chart`

The stored chart, read from the database and rendered as a table: luminaries and ascendant first, then every placement with its sign, degree, house, and whether it is retrograde, then the major aspects.

The page states plainly that this was computed once, on the date shown, and has not been recomputed since. That line is the demonstration. Without it the page is just a table.

## Metadata and social

Per route metadata, the sitemap, and the social card are in [seo.md](./seo.md). The signed in routes are excluded from the sitemap and carry `robots: { index: false }`, because a page nobody can reach without a session has nothing to offer a search engine.
