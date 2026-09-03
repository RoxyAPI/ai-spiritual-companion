# Pages

Six screens, one route handler with no interface, and two API routes. Every screen either gets somebody to the conversation or is the conversation.

## Routes

| Route | Access | What it does |
|---|---|---|
| `/` | public | The landing page. What the product is, why memory is the difference, and one call to action. Redirects a signed in visitor to their next step. |
| `/auth/login` | public | What the product does on one side, one email field and one button on the other. A magic link creates the account and signs the person in. |
| `/auth/confirm` | public, no UI | Route handler. Exchanges the link token for a session and forwards to `/onboarding` or `/companion`. |
| `/auth/error` | public | Where a stale or already used link lands, with a link back to try again. |
| `/onboarding` | signed in, no profile | Three guided steps. Finishing it geocodes once, computes the chart once, and stores both. |
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

Footer carries the product name, the credit naming who computes the positions and that they are verified against NASA JPL Horizons, and links to the source and to support.

### `/onboarding`

Three steps and a moment, in one card, with a step indicator across the top.

| Step | What it does |
|---|---|
| 1, why once | Explains that a chart is a photograph of one moment, so it is calculated once and kept. Somebody is about to be asked for their birth time by a stranger, and this is the paragraph that earns it. |
| 2, birth details | Name, date, time, and the city autocomplete. Continue stays disabled, and says why, until all four are filled. |
| 3, voice | The four tones as selectable cards, each showing a line of how it actually sounds. Hearing the voice beats reading its adjective. |
| The moment | While the chart is computed, the card says what is happening: placing every body at the moment you were born, once, and then it is yours. |

Nothing is submitted before the last step. Values live in React state rather than hidden inputs, so a field cannot be half filled and invisible, and the final action builds the form data and calls the server action once.

**The city field is an autocomplete, never a coordinate input.** Typing three characters queries `/api/cities`, results show city, province, and country because that is what separates two places with the same name, and choosing one captures the latitude, longitude, and IANA timezone silently. A person is never asked for a number they would have to look up. This is the rule that matters most on this screen and the reason the route exists.

Selection state is split from pending state: the chosen city stays chosen until a new one is picked, so the label never updates ahead of the value under it. A superseded search is aborted and an abort is not a failure, but a real failure says so, because silently showing nothing reads as "your birthplace is not in there".

Submitting runs a server action that validates, writes the profile, computes the chart once, and redirects. It is the only place in the product that calls the natal chart endpoint.

### `/companion`

The transcript and its composer, with a panel beside them listing what has been stored, by date, and saying whether recall is currently running by meaning or by recency. On a narrow screen the panel is replaced by one line above the transcript, because the memory is the product and a phone is where most people will meet it. Layout rules are in [design.md](./design.md), including why this screen owns its height.

An empty transcript greets the person by name, says the chart is loaded, and offers three openers rather than showing a blank box. The greeting changes once there is a history, because a returning visitor should not be welcomed like a new one.

Every calculation the companion reaches for is drawn as well as described, above the prose in the same bubble. How that works is in [companion.md](./companion.md).

### `/chart`

The stored chart, read from the database and drawn as a wheel by `RoxyNatalChart`, through the client boundary in `src/components/natal-wheel.tsx` because the page itself is a server component. The stored response is passed as `data` untouched.

Under the wheel the page keeps its own tables: luminaries and ascendant first, then every placement with its sign, degree, house and whether it is retrograde, then the major aspects. The placements table stays because the drawn planet list gives the sign and the degree and not the house or the motion, so removing it would lose two columns.

The page states plainly that this was computed once, on the date shown, and has not been recomputed since. That line is the demonstration. Without it the page is just a chart.

## Metadata and social

Per route metadata, the sitemap, and the social card are in [seo.md](./seo.md). The signed in routes are excluded from the sitemap and carry `robots: { index: false }`, because a page nobody can reach without a session has nothing to offer a search engine.
