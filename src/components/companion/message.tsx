'use client';

import type { UIMessage } from 'ai';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ToolWidget } from '@/components/companion/tool-widget';
import { toolWidgetsFor } from '@/lib/tool-widgets';
import { cn } from '@/lib/utils';

/**
 * One turn in the transcript.
 *
 * @remarks A message is an array of parts, not a string. Reaching for a `content` field is the
 * mistake this version of the streaming library invites, and it fails silently by rendering
 * nothing. The companion writes markdown whether or not it was asked to, so its side renders
 * markdown and the side belonging to the person renders plain text.
 *
 * A calculation the companion reached for is drawn as well as described: every completed tool call
 * that the component library can render lands above the prose, in the same bubble as the reading
 * written about it.
 */
export function Message({ message }: { message: UIMessage }) {
  const isPerson = message.role === 'user';
  const text = message.parts
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('');

  const widgets = toolWidgetsFor(message);

  // A drawing arrives before the interpretation the companion is still writing, so a message is
  // empty only when it has neither.
  if (!text && widgets.length === 0) return null;

  return (
    <div className={cn('flex', isPerson ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[42rem] rounded-2xl border px-4 py-3',
          isPerson
            ? 'bg-primary text-primary-foreground border-transparent'
            : 'bg-card text-card-foreground',
        )}
      >
        <ToolWidget widgets={widgets} />
        {isPerson ? (
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{text}</p>
        ) : (
          <div className="prose-reply">
            <Markdown remarkPlugins={[remarkGfm]}>{text}</Markdown>
          </div>
        )}
      </div>
    </div>
  );
}
