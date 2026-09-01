# The Companion

How the conversation is built, which model answers it, and what it is allowed to say. The memory it draws on is [memory.md](./memory.md); this file owns the model, the prompt, and the streaming.

## Providers

One environment variable picks the model. Three are wired, and the shape is deliberately small so a fourth is a two line change in `src/lib/ai.ts`.

| `LLM_PROVIDER` | Chat model | Key | Notes |
|---|---|---|---|
| `google` (default) | `gemini-3.7-flash` | `GOOGLE_GENERATIVE_AI_API_KEY` | Has a free tier, and the same key covers embeddings, so the default setup needs two keys in total rather than three. |
| `anthropic` | `claude-haiku-4-5` | `ANTHROPIC_API_KEY` | Strongest reader of a chart summary. No embedding endpoint, so recall falls back to recency. |
| `openai` | the current small chat model | `OPENAI_API_KEY` | Its embedding model is wired too, so recall stays semantic. |

Exact model identifiers live in `src/lib/ai.ts` and nowhere else. Do not restate them in a component, a prompt, or a page: they move, and a copy is how a version string goes stale for a year.

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

`buildSystemPrompt` in `src/lib/prompt.ts` is a pure function of everything the turn knows: the profile, the chart summary, the recalled memories, the live transits, the tone, and today's date. Pure means it is directly testable, and `tests/prompt.test.ts` tests it.

It assembles, in order:

1. **Identity and tone.** Who the companion is, plus the selected preset paragraph.
2. **Today's date**, stated explicitly. A model that infers the date from its training data will get it wrong, and every transit reading depends on it.
3. **The person.** Their name, birth details, and the chart summary: luminaries, ascendant, and the placements worth naming. Not the whole chart response, which is large and mostly noise for a conversation.
4. **What the companion remembers.** The recalled memories with their dates, introduced as memory rather than as fact, so the model can say "last month you were focused on work" and mean it.
5. **Today's sky.** The transit aspects computed this turn, with orb and whether they are applying.
6. **Grounding rules.** Every claim traces to the data above. Never invent a placement. Never recite the data back as a list.
7. **Boundaries.** Below.

## Boundaries, and why they are not negotiable

The prompt closes with two rules that have nothing to do with astrology, and neither belongs to a tone preset.

**Not medical, legal, or financial advice.** The companion reads tendencies, cycles and timing as guidance. It never diagnoses, never prescribes, never tells anybody what to do with their health, their case, or their money, and it says so plainly when a question goes there.

**Distress goes to a human.** When somebody sounds like they are in crisis, the companion stops reading the chart, responds like a person, and points at real help in their country. It does not analyse the placement behind their pain and it does not pretend to be a therapist.

There is also a framing rule. This is a spiritual guide, not a romantic partner. Companion apps that simulate romance are now regulated in several places, and the template stays clearly on the guidance side of that line. Do not prompt it into a relationship.

`tests/prompt.test.ts` asserts these blocks are present in the built prompt under every tone preset. Rewrite the wording if you like; deleting them is not an edit this template supports.

## Streaming

The route handler is `src/app/api/chat/route.ts`, and it is the only place the model is called.

It reads the session, loads the cached chart, recalls, fetches transits, builds the prompt, and streams. `onFinish` is where `remember` runs, so a turn is stored after it was actually delivered rather than optimistically.

The client is `src/components/companion/chat.tsx`, a client component using the AI SDK chat hook against `/api/chat`. It renders message parts, not message strings, because a message is an array of parts in this version of the SDK and reaching for `.content` is the mistake to avoid.

**Loading state is a spinner.** Never a coloured shimmer, per [design.md](./design.md).

## What the companion can actually calculate

Three endpoints, listed with their purpose in [code.md](./code.md). The conversation itself calls exactly one of them, once per turn.

Deliberately absent: tool calling. The companion does not choose which calculation to run, because it does not need to. It has one person, one chart, and one sky, and all three are already in the prompt before the model sees the question. A tool loop here would buy nothing and cost a round trip. The template that demonstrates tool calling across every domain is a different one, linked from the README.
