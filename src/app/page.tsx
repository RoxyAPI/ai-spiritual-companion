import Link from 'next/link';
import { redirect } from 'next/navigation';
import { JsonLd } from '@/components/json-ld';
import { Section } from '@/components/section';
import { Button } from '@/components/ui/button';
import { config } from '@/config/companion.config';
import { getUser } from '@/lib/auth';
import { softwareApplication } from '@/lib/seo';
import { createClient } from '@/lib/supabase/server';

const ARGUMENT = [
  {
    title: 'The calculation is stateless and exact',
    body: 'Positions come from an ephemeris verified against NASA JPL Horizons. Ask for the same moment twice and you get the same answer, because none of it is generated.',
  },
  {
    title: 'The memory is stateful and yours',
    body: 'Your chart, every reading you have been shown, and the index over them live in a database you own. Nothing you write is ever sent anywhere to be calculated.',
  },
  {
    title: 'The companion is the join',
    body: 'Facts on one side, continuity on the other, brought together the moment you ask. That is the difference between a horoscope and something that knows you.',
  },
];

const TURN = [
  'Your stored chart is read from the database. No calculation, no waiting.',
  'What you said before is searched by meaning, and the closest few come back.',
  'When the question calls for it, the sky today is computed live against your birth data.',
  'All of it is handed to the model as grounded context, and the reply streams.',
  'The reading is appended to your history, so the next conversation starts further along.',
];

export default async function HomePage() {
  const user = await getUser();

  if (user) {
    const supabase = await createClient();
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();
    redirect(profile ? '/companion' : '/onboarding');
  }

  return (
    <>
      <JsonLd data={softwareApplication()} />

      <Section wash="start" containerClassName="space-y-6">
        <p className="eyebrow text-muted-foreground">{config.name}</p>
        <h1 className="max-w-3xl text-4xl leading-tight sm:text-5xl">
          A spiritual companion that remembers you
        </h1>
        <p className="max-w-2xl text-lg text-muted-foreground">{config.description}</p>
        <div className="flex flex-wrap gap-3">
          <Button asChild size="lg" className="min-w-44">
            <Link href="/auth/login">Start</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <a href="https://github.com/RoxyAPI/ai-spiritual-companion">Read the source</a>
          </Button>
        </div>
      </Section>

      <Section containerClassName="space-y-10">
        <h2 className="text-2xl">What makes a companion remember</h2>
        <div className="grid gap-8 sm:grid-cols-3">
          {ARGUMENT.map((item) => (
            <div key={item.title} className="space-y-2">
              <h3 className="text-lg">{item.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{item.body}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section containerClassName="space-y-6">
        <h2 className="text-2xl">What happens when you ask something</h2>
        <ol className="max-w-2xl space-y-4">
          {TURN.map((step, index) => (
            <li key={step} className="flex gap-4">
              <span className="eyebrow pt-1 text-muted-foreground">{index + 1}</span>
              <p className="text-sm leading-relaxed">{step}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section wash="end" containerClassName="space-y-4">
        <h2 className="text-2xl">Where does the data live</h2>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Your chart is computed exactly once, from a birth date, a birth time, and a place you pick
          from a list. That is the only information ever sent to be calculated. Journal entries,
          moods, and every word of every conversation stay in your own database, behind row level
          security, readable by nobody but you.
        </p>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          This is an open template under the MIT license. Clone it, rebrand it, add your own paid
          tier, and ship it under your own name.
        </p>
      </Section>
    </>
  );
}
