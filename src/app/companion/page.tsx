import type { Metadata } from 'next';
import Link from 'next/link';
import { Chat } from '@/components/companion/chat';
import { Badge } from '@/components/ui/badge';
import { config } from '@/config/companion.config';
import { getEmbeddingModel } from '@/lib/ai';
import { requireOnboarded } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Your companion',
  robots: { index: false, follow: false },
};

const OPENERS = [
  'What is today asking of me',
  'What keeps coming back in my chart',
  'Where is my attention going this month',
];

export default async function CompanionPage() {
  const user = await requireOnboarded();
  const supabase = await createClient();

  const { data: stored } = await supabase
    .from('readings')
    .select('created_at, shown')
    .order('created_at', { ascending: false })
    .limit(4);

  const remembered = stored ?? [];
  const greeting = remembered.length
    ? `Welcome back, ${user.displayName}.`
    : `Hello ${user.displayName}. Let us begin.`;
  const semantic = Boolean(getEmbeddingModel());

  return (
    <div className="site-container">
      <div className="grid gap-8 lg:grid-cols-[1fr_18rem]">
        <div className="flex min-w-0 flex-col">
          {/* The panel below is desktop only, so the phone gets the same claim in one line. The
              memory is the product, and a phone is where most people will meet it. */}
          <p className="border-b py-3 text-xs text-muted-foreground lg:hidden">
            {remembered.length === 0
              ? 'Nothing remembered yet. Every reading is kept in your own database.'
              : `Remembering ${remembered.length} reading${remembered.length === 1 ? '' : 's'}, ${
                  semantic ? 'recalled by meaning' : 'recalled by recency'
                }.`}
          </p>
          <Chat openers={OPENERS} greeting={greeting} />
        </div>

        {/* The memory, shown rather than implied. A product whose value is invisible is a product
            nobody can tell apart from a chat box. */}
        <aside className="hidden space-y-4 border-l py-6 pl-8 lg:block">
          <div className="space-y-1">
            <p className="eyebrow text-muted-foreground">What it remembers</p>
            <p className="text-xs text-muted-foreground">
              {semantic
                ? 'Recall is by meaning, over everything said so far.'
                : 'Recall is by recency, most recent first.'}
            </p>
          </div>

          {remembered.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing yet. Every reading you are shown is kept here, in your own database.
            </p>
          ) : (
            <ul className="space-y-3">
              {remembered.map((reading) => (
                <li key={reading.created_at} className="space-y-1">
                  <Badge variant="outline">{reading.created_at.slice(0, 10)}</Badge>
                  <p className="line-clamp-3 text-xs leading-relaxed text-muted-foreground">
                    {reading.shown}
                  </p>
                </li>
              ))}
            </ul>
          )}

          <p className="text-xs text-muted-foreground">
            {user.displayName}, {user.tone} voice.{' '}
            <Link href="/chart" className="underline underline-offset-2">
              See the chart {config.name} reads from
            </Link>
            .
          </p>
        </aside>
      </div>
    </div>
  );
}
