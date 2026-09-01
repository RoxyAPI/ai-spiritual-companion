import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  stepCountIs,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from 'ai';
import { config } from '@/config/companion.config';
import { getModel } from '@/lib/ai';
import { requireOnboarded } from '@/lib/auth';
import { chartFacts } from '@/lib/chart';
import { getCompanionTools } from '@/lib/mcp';
import { recall, remember } from '@/lib/memory';
import { buildSystemPrompt } from '@/lib/prompt';
import { createClient } from '@/lib/supabase/server';
import type { Json } from '@/types';

/**
 * One turn of the conversation, and the only place the language model is called.
 *
 * The order below is the argument the whole template makes. The expensive immutable thing, the
 * natal chart, is read from the database and never recomputed. The personal thing, what was said
 * before, never leaves the database at all. The live facts are fetched by the model itself from
 * Remote MCP servers, so a question that needs today sky gets today sky and a question that does
 * not costs nothing.
 */

/** The last thing the person actually typed, which is what recall searches on. */
function lastUserText(messages: UIMessage[]): string {
  const last = [...messages].reverse().find((message) => message.role === 'user');
  if (!last) return '';
  return last.parts
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join(' ')
    .trim();
}

export async function POST(request: Request) {
  const { messages }: { messages: UIMessage[] } = await request.json();
  const user = await requireOnboarded();
  const supabase = await createClient();

  const { data: chart } = await supabase
    .from('charts')
    .select('natal')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!chart) {
    return Response.json({ error: 'No chart stored for this account.' }, { status: 409 });
  }

  const asked = lastUserText(messages);

  // Independent of each other, so they run together. Only birth data ever crosses to the
  // calculation service, never a word of the conversation.
  const [memories, tools] = await Promise.all([
    recall(supabase, asked, config.recallCount),
    getCompanionTools(),
  ]);

  const instructions = buildSystemPrompt(
    {
      displayName: user.displayName,
      tone: user.tone,
      birth: user.birth,
      birthPlace: user.birthPlace,
      chart: chartFacts(chart.natal),
      memories,
      today: new Date().toLocaleDateString('en-CA'),
      hasTools: Object.keys(tools).length > 0,
    },
    config.name,
  );

  const result = streamText({
    model: getModel(),
    instructions,
    tools,
    // A turn may resolve a place, then read the sky, then answer. Past that it is looping.
    stopWhen: stepCountIs(6),
    messages: await convertToModelMessages(messages),
    // Appending happens after the reply was actually delivered, so the history records what the
    // person saw rather than what the server hoped to send.
    //
    // The failure is caught and logged rather than thrown. A rejection here would be swallowed by
    // the stream machinery, and losing a memory silently is the worst bug this product can have:
    // everything keeps working and the companion just quietly stops remembering.
    onEnd: async ({ text, toolCalls }) => {
      if (!text.trim()) return;
      try {
        await remember(supabase, user.id, {
          kind: 'conversation',
          shown: text,
          asked,
          grounding: toolCalls.map((call) => ({ tool: call.toolName, input: call.input as Json })),
        });
      } catch (error) {
        console.error('[companion] the turn was delivered but not remembered:', error);
      }
    },
  });

  return createUIMessageStreamResponse({ stream: toUIMessageStream({ stream: result.stream }) });
}
