import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { OnboardingForm } from '@/components/onboarding/onboarding-form';
import { Section } from '@/components/section';
import { Card, CardContent } from '@/components/ui/card';
import { config } from '@/config/companion.config';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Set up your companion',
  robots: { index: false, follow: false },
};

export default async function OnboardingPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .maybeSingle();

  if (profile) redirect('/companion');

  return (
    <Section wash="start" containerClassName="max-w-xl space-y-8">
      <div className="space-y-2">
        <p className="eyebrow text-muted-foreground">Setting up {config.name}</p>
        <h1 className="text-3xl">Let us start with you</h1>
      </div>

      {/* The card holds an autocomplete, so it has to let the dropdown escape its bounds. */}
      <Card className="overflow-visible">
        <CardContent className="py-8">
          <OnboardingForm defaultTone={config.defaultTone} />
        </CardContent>
      </Card>

      <p className="text-xs leading-relaxed text-muted-foreground">
        Your birth date, birth time and coordinates are sent once to calculate the chart. Nothing
        else about you ever leaves the database, including every word you and {config.name} say to
        each other.
      </p>
    </Section>
  );
}
