# Metadata and Search

Most of this product sits behind a session, so there is exactly one page a search engine can see. That page has to do all the work.

## What is public and what is not

| Route | Indexed | Why |
|---|---|---|
| `/` | yes | The only page with anything to offer a reader who is not signed in |
| `/auth/login` | no | A form |
| `/onboarding`, `/companion`, `/chart` | no | Unreachable without a session, and personal |
| `/api/*` | no | Not pages |

The signed in routes export `robots: { index: false, follow: false }` in their metadata and are absent from the sitemap. Both, not one: a sitemap that omits a page is a hint, and the metadata is the instruction.

## Metadata

The root layout sets `metadataBase` from `config.siteUrl`, a title template, the description from `config.description`, and the Open Graph and card defaults. Every page below it sets only its own title and description, and inherits everything else.

`config.siteUrl` must be your real domain before you deploy. A canonical URL pointing at a domain belonging to somebody else is worse than no canonical URL, and a social card built on the wrong origin does not load.

## Structured data

The landing page emits one `SoftwareApplication` block, built with `schema-dts` and closed with `satisfies WithContext<SoftwareApplication>`. That last part matters more than the block does: an invalid Schema.org property then fails the type check rather than being silently dropped by the search engine that reads it.

One block, on one page. There is nothing else here worth describing to a machine, and a template that emits a `Person` for a user who has not signed up yet is emitting a lie.

## Social card

`src/app/opengraph-image.tsx` renders the card at request time from the config: product name, tagline, and the palette. It uses the same colour values as the stylesheet, which cannot read a CSS variable, so the two are kept in step by the design tokens test.

## Sitemap and robots

`src/app/sitemap.ts` lists the landing page. `src/app/robots.ts` allows everything except `/api/`, and points at the sitemap.

Both are generated from `config.siteUrl`, so changing the domain changes them together. Never hard code a host into either file.

## Writing the landing copy

The one indexed page is also the page a language model will read when somebody asks it how to build a companion with memory, so it is written to be quotable rather than to be clever.

- The first paragraph makes a verifiable claim and names the thing: a companion that remembers, on your own database, around calculations that are verified against NASA JPL Horizons.
- Headings are phrased as questions somebody would type. What makes a companion remember. Where does the data live. What does it cost to run.
- Numbers are floors, never exact figures. A figure written as exact is a figure that is wrong within a quarter.
- No competitor names, no comparison tables. State what this does.
