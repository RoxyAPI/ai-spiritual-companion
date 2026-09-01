# Design System

One palette, two fonts, one layout primitive, and a decision log at the bottom. The point of the visual design here is that a companion has to feel calm enough to be talked to, and most chat interfaces do not.

House direction: **quiet, printed, celestial without the cliche.** Ink and gold on warm paper in light, deep night sky in dark. Editorial serif for headings, a geometric sans for everything a person reads at length, a single film grain over the whole page, and no motion beyond a spinner. Never the generated template look: no purple family, no two stop diagonal gradients, no neon, no glow, no emoji headings, no card hover scale.

## Palette

One palette. It is declared as CSS custom properties in `src/app/globals.css`, mapped to the shadcn semantic variables, and every component uses the semantic class (`bg-card`, `text-muted-foreground`) rather than a colour. A fork recolours the product by editing the two blocks below and nothing else.

| Token | Light | Dark |
|---|---|---|
| `background` | `#FAF6EC` | `#0B1826` |
| `foreground` | `#14232E` | `#EFE7D3` |
| `card` | `#F1EADB` | `#1B2A39` |
| `card-foreground` | `#14232E` | `#EFE7D3` |
| `muted-foreground` | `#5C6A76` | `#92A4B2` |
| `primary` | `#254B5A` | `#C9A96B` |
| `primary-foreground` | `#F6F2E6` | `#16222E` |
| `accent` | `#B89D62` | `#99BAD7` |
| `border` | `#E4DBC6` | `#263A4C` |
| `destructive` | `#B23A38` | `#E4736B` |

Selectors are `:root` for light and `.dark` for dark, where `.dark` is written by the theme provider. `tests/design-tokens.test.ts` asserts every token in the table above exists in both blocks, so a half finished recolour fails the suite instead of shipping a dark mode with a light border.

Contrast is checked against the **card**, not the page background. The card is the darker of the two surfaces in light mode and the lighter one in dark, so a muted value that passes on the background can still fail inside a card, and a chat interface is almost entirely cards. Every foreground and background pair here is AAA, and every muted and primary pair is AA or better.

The primary swaps role between modes on purpose: deep ink on paper in light, warm gold on night in dark. Do not generate the dark values by inverting the light ones.

## Typography

Two families, loaded through `next/font/google` as CSS variables, mapped in the Tailwind theme block.

| Role | Font | Rules |
|---|---|---|
| Display serif | **Fraunces** (variable, optical size axis) | `h1`, `h2`, `h3` only. The editorial serif carries the whole personality of the product, so it never appears in body copy or a button. |
| Body sans | **Jost** | Everything else: messages, forms, labels, navigation, buttons. Weights 300, 400, 500. |

No script face. The practitioner facing template this design descends from uses one for pull quotes and hero flourishes, and this product has neither: a chat screen with a decorative script in it looks like a greetings card. Recorded in the log below.

Do not substitute **Inter**, which is the default of every generated template, or **Playfair Display**, which is the most saturated luxury serif in this niche.

Eyebrow treatment, used above section headings and inside buttons: uppercase, 12 to 13 pixels, letter spacing around 0.2em, medium weight, muted or primary colour. It is the `.eyebrow` class and it is declared once.

## Background treatment

- Base: the palette background across the whole body. No per section background colours.
- Texture: one fixed inline SVG turbulence overlay across the page at about 3.5 percent opacity, pointer events off. This is what makes the surface read as printed rather than rendered, and it is the reason the design needs no gradients at all.
- Wash: at most one large soft radial wash per major band, applied with `<Section wash="start">` or `wash="end"`, never by hand. The wash paints on the full width band so it can reach the screen edge.
- Never: two stop diagonal linear gradients, purple to anything, animated gradient meshes.

## Layout

**Full bleed band, contained content.** Every horizontal band spans the viewport so its background reaches the edge, and puts its content inside the shared container.

- The measure is declared once, as `.site-container` in `globals.css`. Nothing else may declare a page width, and `tests/design-tokens.test.ts` fails if anything redeclares it.
- `src/components/section.tsx` is the layout primitive a page composes. It owns the band, the optional wash, the container, and the vertical rhythm. A page never sets a width, a gutter, or a section padding.
- Never put the container in the root layout. A container there caps every background at its edge, so a washed band renders as a floating strip with gutters instead of reaching the screen.
- Rhythm: `py-16 sm:py-24` per section, applied by `Section`. `space-y-6` inside.
- Cards: the `card` surface, one pixel `border`, `rounded-2xl`, no shadow stack, no hover transform.
- Icons: lucide only, and only where they carry meaning.

### The one exception: the conversation screen owns its height

`/companion` is the only route that sets a height. A chat needs a fixed viewport column with an independently scrolling transcript and a composer pinned at the bottom, which a document flow cannot express. It uses `h-[calc(100svh-var(--header-h))]` inside `.site-container`, so it still never declares a width.

`100svh` rather than `100vh` is deliberate. On mobile browsers `100vh` includes the collapsing address bar, so the composer sits below the fold until the user scrolls, which on a chat screen is the whole interface being broken. Every other page is ordinary document flow.

One consequence, which is intended rather than a bug to fix: the footer sits just below the fold on this route, because the page is the header plus a full viewport column plus the footer. The composer is the last thing in view, which is the thing that matters. Do not shrink the column to fit the footer in, and do not remove the footer from one route.

## Messages

The transcript is the product surface, so it gets stated rules rather than being left to whoever edits it next.

- The person speaks in a `primary` bubble aligned to the end, the companion speaks on the `card` surface aligned to the start. Colour is the only thing distinguishing them; no avatars, no name labels, no timestamps on every line.
- Bubbles cap at `max-w-[42rem]` so a long answer stays readable on a wide screen. Measure beats width.
- The companion renders markdown, because a language model writes markdown whether or not you asked. The person renders as plain text.
- Waiting is a small spinner on the companion side. Never a shimmer, never a bouncing dot animation, never a fake typing indicator.
- The memory is shown, not implied. A panel beside the transcript lists what the companion has stored, with dates, and states whether recall is running by meaning or by recency. It is the whole point of the product made visible, and hiding it makes this look like every other chat box.

## Dark mode

`next-themes` with `attribute="class"`, `defaultTheme="system"`, `disableTransitionOnChange`. Never a hand rolled theme provider: they flash white on a dark mode load. The toggle sits in the header.

The toggle renders both icons and lets `dark:` classes choose between them, and reads the resolved theme only inside the click handler. The older mounted flag pattern is a lint error in current React and it is not needed.

## Decision log

| Decision | Why |
|---|---|
| Inherit the design base from the practitioner facing template rather than the default neutral theme | This product is talked to, not clicked through. A neutral developer theme is right for a code demonstration and wrong for something a person tells their worries to. Founder decision, taken at build time, overriding the original plan for a bare default theme. |
| One palette, no palette switcher | Theming configuration is out of scope for this template. A fork edits two CSS blocks, which is less work than learning a switcher. |
| Ink and gold, celestial without purple | Purple, violet and indigo are the single strongest generated template tell in this niche. Night sky reads celestial without them. |
| No script accent face | Inherited from a template that has pull quotes and a hero flourish. This one has a chat transcript, and a script face in a conversation reads as a greetings card. |
| Fraunces and Jost, no Inter, no Playfair Display | Free equivalents of what brands in this space actually pay for. Both of the excluded faces are saturation casualties. |
| Grain, one wash, no gradients | Printed tactility reads made. Gradient meshes read generated. |
| Light mode default, system respected | Every researched palette source in this niche leads light and airy, and a companion should not open at night unless the person is in it. |
| `100svh` on the conversation screen | `100vh` puts the composer under the mobile address bar, which breaks the only control that matters. |
| The stored memory sits beside the transcript | The memory is the product, and a product whose value is invisible is one nobody can tell apart from a chat box. A panel rendered on the server also needs no streaming plumbing to show it. |
| Never rerun the shadcn initializer | It rewrites `globals.css` and destroys the palette. Add components with the add command only; the design tokens test is the tripwire. |
