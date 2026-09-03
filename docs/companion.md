# The Companion

How the conversation is built, which model answers it, and what it is allowed to say. The memory it draws on is [memory.md](./memory.md); this file owns the model, the prompt, and the streaming.

## Providers

One environment variable picks the model. Three are wired, and the shape is deliberately small so a fourth is a two line change in `src/lib/ai.ts`.

| `LLM_PROVIDER` | Chat model | Key | Notes |
|---|---|---|---|
| `google` (default) | the current fast chat model | `GOOGLE_GENERATIVE_AI_API_KEY` | Has a free tier, and the same key covers embeddings, so the default setup needs two keys in total rather than three. |
| `anthropic` | the current small chat model | `ANTHROPIC_API_KEY` | Strongest reader of a chart summary. No embedding endpoint, so recall falls back to recency. |
| `openai` | the current small chat model | `OPENAI_API_KEY` | Its embedding model is wired too, so recall stays semantic. |

Exact model identifiers live in `src/lib/ai.ts` and nowhere else. Do not restate them in a component, a prompt, a page, or a document, this one included: they move, and a copy is how a version string goes stale for a year. Read `getModel()` for what actually runs.

`getModel()` returns the chat model and `getEmbeddingModel()` returns the embedding model or `null`. Between them they are the entire provider surface.

## Tone presets

The user picks one at onboarding, it is stored on `profiles.tone_preset`, and it selects one paragraph inside the system prompt. Four ship:

| Preset | Voice |
|---|---|
| `warm` (default) | Kind, plain spoken, encouraging. Reads like a friend who happens to know the chart. |
| `mystical` | Symbolic and image led. Leans on the language of the tradition without becoming vague. |
| `clinical` | Precise and technical. Names the placement, states the mechanism, skips the reassurance. |
| `edgy` | Blunt and funny. Says the uncomfortable part. Never cruel. |

Adding one is three steps and all three are required: add the key to the `TonePreset` union in `src/types/index.ts`, add its paragraph to `TONE_PRESETS` in `src/lib/prompt.ts`, and add the label to the onboarding select. `tests/prompt.test.ts` asserts every member of the union has a paragraph, so a missed step fails the suite rather than shipping a companion with no voice.

**A preset changes the voice, never the facts and never the safety lines.** Those are outside the preset block on purpose.

## The system prompt

`buildSystemPrompt` in `src/lib/prompt.ts` is a pure function of everything the turn knows before the model speaks: the profile, the chart summary, the recalled memories, the tone, and today date. Pure means it is directly testable, and `tests/prompt.test.ts` tests it.

It assembles, in order:

1. **Identity and tone.** Who the companion is, plus the selected preset paragraph.
2. **The date today**, stated explicitly. A model that infers the date from its training data will get it wrong, and every transit reading depends on it.
3. **The person.** Their name, birth details, and the chart summary: luminaries, ascendant, and the placements worth naming. Not the whole chart response, which is large and mostly noise for a conversation.
4. **What the companion remembers.** The recalled memories with their dates, introduced as memory rather than as fact, so the model can say "last month you were focused on work" and mean it.
5. **How to use the live calculations.** Always ask for the compact response shape, resolve a place before any calculation that needs one, and call what the question needs rather than everything available. Four more rules stop the confident wrong answer: call a tool only with values the person actually gave, read the sky right now as today rather than as their birth date, never guess day against month on an all numeric date that could be read either way, and retry a failed call corrected rather than identical. When no calculation server answered, this block says so instead, and tells the model not to invent a transit, a card, or a date.
6. **Grounding rules.** Every claim traces to the data above or to a tool result. Never invent a placement, never recite the data back as a list, and never name a tool or show a raw data structure. This block also carries the things a practitioner would not need telling: lead with the reading rather than a hedge, reply in the language the person wrote in and translate any tool data whole, keep everything inside this turn with no promise of work continuing after it, and carry on through a trimmed history without apologising for it.
7. **Reading for other people.** The companion keeps one chart, the chart of the account holder. Somebody asking about a sister, a partner or a friend gets a real reading from the live calculations, built from the details of that person and never from the details of the account holder. A request to save a second chart gets one honest sentence and then the reading, rather than a pretence.
8. **When they say you are wrong.** Read the data again, then either hold and show the check, quoting the figures and naming the convention, or correct it in one line. Never invent a deeper layer to win the disagreement, and never agree only to be liked.
9. **Boundaries.** Below.

## Boundaries, and why they are not negotiable

The prompt closes with two rules that have nothing to do with astrology, and neither belongs to a tone preset.

**Not medical, legal, or financial advice.** The companion reads tendencies, cycles and timing as guidance. It never diagnoses, never prescribes, never tells anybody what to do with their health, their case, or their money, and it says so plainly when a question goes there.

**Distress goes to a human.** When somebody sounds like they are in crisis, the companion stops reading the chart, responds like a person, and points at real help in their country. It does not analyse the placement behind their pain and it does not pretend to be a therapist.

There is also a framing rule. This is a spiritual guide, not a romantic partner. Companion apps that simulate romance are now regulated in several places, and the template stays clearly on the guidance side of that line. Do not prompt it into a relationship.

`tests/prompt.test.ts` asserts these blocks are present in the built prompt under every tone preset. Rewrite the wording if you like; deleting them is not an edit this template supports.

## Streaming

The route handler is `src/app/api/chat/route.ts`, and it is the only place the model is called.

It reads the session, loads the cached chart, recalls, gathers the tools, builds the prompt, and streams. The model may take a few steps inside one turn, resolving a place and then reading the sky, and `stopWhen` bounds that. `onEnd` is where `remember` runs, so a turn is stored after it was actually delivered rather than optimistically, along with the names and arguments of every calculation the answer was grounded in.

The client is `src/components/companion/chat.tsx`, a client component using the AI SDK chat hook against `/api/chat`. It renders message parts, not message strings, because a message is an array of parts in this version of the SDK and reaching for `.content` is the mistake to avoid.

**Every tool result is drawn as well as described.** `src/lib/tool-widgets.ts` walks the `dynamic-tool` parts of a message, and for each one that completed it asks `componentForTool` from `@roxyapi/ui-react` which component draws that tool name, parses the JSON text block out of the result, and returns a list. `src/components/companion/tool-widget.tsx` mounts that list above the prose, inside the same bubble. Nothing is listed per tool, so connecting a domain in `src/lib/mcp.ts` is all it takes for its results to draw, and a tool no component covers keeps the written answer instead of breaking it. One line of the system prompt tells the companion the drawing is there, so it interprets rather than reprints.

Two details are load bearing. A streaming message is a new object on every chunk, so a widget is memoised by tool call id and the same `data` object is handed back each time; parsing again would redraw a finished chart under the arriving prose. And the components read their own `--roxy-*` custom properties, which the `:root` block of `globals.css` points at the palette, so a recolour moves them and restyling a component is never the answer.

**Loading state is a spinner.** Never a coloured shimmer, per [design.md](./design.md). It shows until the companion has something on screen, which a drawing satisfies as much as the first token does.

## Live calculations, and who is allowed to make them

The calculation layer is split down the middle, and the line is drawn by one question: does exactly one call have to happen?

**The application owns the calls where the answer is yes.** The natal chart is computed once per account by the onboarding action through `@roxyapi/sdk`, and the birth city autocomplete is proxied by a route handler. Both are typed, both are deterministic, and neither is at the discretion of a model.

**The model owns everything else**, through Remote MCP servers over Streamable HTTP. It resolves a place, pulls today sky, draws a card, asks for the month ahead, whenever a question actually needs one, and skips all of it when a question does not. That is better than pre fetching: a question about how somebody is feeling should not cost a chart lookup, and a question about next month should not be answered from a snapshot taken for today.

`src/lib/mcp.ts` owns the whole of that half. It connects the configured domains once per server instance, caches their tool definitions, and hands the result to the conversation.

### Which domains, and why not all of them

`DEFAULT_PRODUCTS` is `astrology`, `tarot`, `location`. `ROXYAPI_MCP_PRODUCTS` overrides it with any comma separated list of slugs, and every domain on the platform works without a code change, including ones added after this was written.

The default is a few domains rather than all of them because of a measured property of language models, not a limit of the platform. Every connected tool is a tool definition placed in front of the model on every turn, and selection accuracy falls as that list grows. The published guidance converges:

| Source | Guidance |
|---|---|
| [Anthropic, tool search](https://platform.claude.com/docs/en/agents-and-tools/tool-use/tool-search-tool) | Tool selection degrades once you exceed 30 to 50 available tools |
| [OpenAI, function calling](https://developers.openai.com/api/docs/guides/function-calling) | Aim for fewer than 20 functions available at the start of a turn, as a soft suggestion |
| [Google, function calling](https://ai.google.dev/gemini-api/docs/function-calling) | Keep the active set to 10 to 20 tools maximum |
| [Model Context Protocol, client best practices](https://modelcontextprotocol.io/docs/2026-07-28/develop/clients/client-best-practices) | Start with a minimal set of always on servers and connect others as needed |

Hard API ceilings exist and sit an order of magnitude above all of that, so they are not the number to design against.

### Which tools, out of those domains

Those three domains offer 52 tools between them, which is over the line for the default model, so `COMPANION_TOOLS` in `src/lib/mcp.ts` narrows that to the subset a companion uses: the sky now and ahead, the moon, horoscopes by period, the solar return and progressions, synastry for the question about somebody else, three tarot draws, and city search. Sixteen tools, comfortably inside every row of the table above.

Set `ROXYAPI_MCP_TOOLS=all` to hand over everything the connected domains offer, which is the right move on a stronger model. Set it to a comma separated list of tool names to curate your own.

**One tool is never given to the model, under any configuration.** `post_astrology_natal_chart` is withheld by `NEVER_EXPOSED`, because the chart is computed exactly once per account by the application and cached, and a guarantee a model can opt out of is not a guarantee. The chart is already in the prompt on every turn, so there is nothing to gain by letting it be recomputed.

### Compact responses

Every RoxyAPI tool takes an opt in `compact` boolean. It returns the same data with each field name sent once for a whole array instead of once per row, which is lossless and cuts the size of a detailed chart response by roughly 40 to 52 percent. Measured on a transits call while building this: 56,662 bytes down to 33,338, a reduction of 41 percent.

It is enabled two ways on purpose. `withCompactResults` wraps every tool so the flag is in the arguments whichever way the model calls it, and one line of the system prompt asks for the same thing, so the behaviour stays visible to somebody who removes the wrapper. Fewer tokens in a tool result is less to pay your model provider and less for the model to read. It has no bearing on how many requests are counted.

### No agent framework

There is no planner, no router, and no second model deciding what to do. One model, one turn, a bounded number of steps, and the memory around it. A companion has one person and one chart, so the thing that makes it good is what it remembers, not how elaborately it thinks.
