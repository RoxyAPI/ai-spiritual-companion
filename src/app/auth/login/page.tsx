import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Section } from '@/components/section';
import { SignInForm } from '@/components/sign-in-form';
import { Card, CardContent } from '@/components/ui/card';
import { config } from '@/config/companion.config';
import { getUser } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'Sign in',
  robots: { index: false, follow: false },
};

const PROMISES = [
  'Your chart is calculated once and then it is yours.',
  'Every reading is kept, so the next conversation starts further along.',
  'Nothing you write is ever sent anywhere to be calculated.',
];

export default async function LoginPage() {
  if (await getUser()) redirect('/companion');

  return (
    <Section wash="start" containerClassName="grid items-center gap-12 md:grid-cols-2">
      <div className="space-y-6">
        <div className="space-y-3">
          <p className="eyebrow text-muted-foreground">{config.name}</p>
          <h1 className="text-3xl leading-tight">{config.tagline}</h1>
        </div>
        <ul className="space-y-3">
          {PROMISES.map((promise) => (
            <li key={promise} className="flex gap-3 text-sm text-muted-foreground">
              <span aria-hidden className="text-accent">
                &bull;
              </span>
              {promise}
            </li>
          ))}
        </ul>
      </div>

      <Card>
        <CardContent className="py-8">
          <SignInForm />
        </CardContent>
      </Card>
    </Section>
  );
}
