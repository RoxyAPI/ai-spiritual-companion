'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { Loader2, SendHorizontal } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Message } from '@/components/companion/message';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

/**
 * The transcript and the composer.
 *
 * @remarks This screen owns its height, which is the one documented exception to a page never
 * setting a dimension. A conversation needs a fixed column with an independently scrolling
 * transcript and a composer pinned below it, and `100svh` rather than `100vh` keeps that composer
 * above the collapsing address bar on a phone. See docs/design.md.
 */
export function Chat({ openers, greeting }: { openers: string[]; greeting: string }) {
  const [input, setInput] = useState('');
  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({ api: '/api/chat' }),
  });
  const endRef = useRef<HTMLDivElement>(null);

  const busy = status === 'submitted' || status === 'streaming';
  // The spinner is only for the wait before the first token. Once text is arriving, the text is the
  // indicator, and leaving a spinner up beside it keeps spinning after the answer is complete while
  // the turn is being stored.
  const waiting = status === 'submitted';

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setInput('');
    sendMessage({ parts: [{ type: 'text', text: trimmed }] });
  }

  return (
    <div className="flex h-[calc(100svh-var(--header-h))] flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto py-6">
        {messages.length === 0 ? (
          <div className="max-w-2xl space-y-5 py-10">
            <div className="space-y-2">
              <p className="font-display text-2xl">{greeting}</p>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Your chart is loaded and today&rsquo;s sky has been measured against it. Ask
                anything, or start with one of these.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {openers.map((opener) => (
                <Button
                  key={opener}
                  variant="outline"
                  size="sm"
                  className="h-auto whitespace-normal py-2 text-left"
                  onClick={() => send(opener)}
                >
                  {opener}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((message) => <Message key={message.id} message={message} />)
        )}

        {waiting ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Reading
          </div>
        ) : null}

        {error ? (
          <p className="text-sm text-destructive">
            That reply did not come through. Try asking again.
          </p>
        ) : null}

        <div ref={endRef} />
      </div>

      <form
        className="flex items-end gap-2 border-t py-4"
        onSubmit={(event) => {
          event.preventDefault();
          send(input);
        }}
      >
        <Textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              send(input);
            }
          }}
          placeholder="Ask your companion"
          rows={2}
          className="resize-none"
          aria-label="Message"
        />
        <Button type="submit" size="icon" disabled={busy || !input.trim()} aria-label="Send">
          <SendHorizontal className="size-4" />
        </Button>
      </form>
    </div>
  );
}
