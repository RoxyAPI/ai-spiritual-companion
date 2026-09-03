'use client';

import { ArrowLeft, Check, Loader2 } from 'lucide-react';
import { startTransition, useActionState, useState } from 'react';
import { completeOnboarding, type OnboardingState } from '@/app/onboarding/actions';
import { CitySearch } from '@/components/onboarding/city-search';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { CityChoice, TonePreset } from '@/types';

/**
 * Birth data, once, as a guided flow rather than a wall of fields.
 *
 * @remarks Three steps and a moment. Somebody arriving here is being asked for their birth time by
 * a stranger, which is a lot to ask without saying why, so the first step says why and the second
 * says it again beside the field. Nothing is submitted until the last step, and the values live in
 * state rather than in hidden inputs, so a field cannot be half filled and invisible.
 *
 * This is the only moment the product computes a natal chart, and the values captured here are
 * immutable afterwards, because that chart was computed from them.
 */

/** The label and the sample beside each voice. The paragraph behind it lives in `src/lib/prompt.ts`. */
const TONES: { value: TonePreset; label: string; hint: string; sample: string }[] = [
  {
    value: 'warm',
    label: 'Warm',
    hint: 'Kind and plain spoken',
    sample: 'Today is asking you to go gently. Here is where that shows up.',
  },
  {
    value: 'mystical',
    label: 'Mystical',
    hint: 'Symbol and image',
    sample: 'The tide is turning in your seventh house. Something long submerged is surfacing.',
  },
  {
    value: 'clinical',
    label: 'Clinical',
    hint: 'Precise and technical',
    sample: 'Transiting Saturn is square your natal Venus at an orb of one degree, applying.',
  },
  {
    value: 'edgy',
    label: 'Edgy',
    hint: 'Blunt and funny',
    sample: 'You already know what this transit is about. You have just been avoiding it.',
  },
];

const STEPS = ['Why once', 'Your birth', 'Your voice'] as const;

export function OnboardingForm({ defaultTone }: { defaultTone: TonePreset }) {
  const [step, setStep] = useState(0);
  const [displayName, setDisplayName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [birthTime, setBirthTime] = useState('');
  const [city, setCity] = useState<CityChoice | null>(null);
  const [tone, setTone] = useState<TonePreset>(defaultTone);
  const [state, submit, pending] = useActionState<OnboardingState, FormData>(
    completeOnboarding,
    {},
  );

  const detailsComplete = Boolean(displayName.trim() && birthDate && birthTime && city);

  function finish() {
    if (!city) return;
    const data = new FormData();
    data.set('displayName', displayName.trim());
    data.set('birthDate', birthDate);
    data.set('birthTime', birthTime);
    data.set('tone', tone);
    data.set('city', city.city);
    data.set('province', city.province);
    data.set('country', city.country);
    data.set('latitude', String(city.latitude));
    data.set('longitude', String(city.longitude));
    data.set('timezone', city.timezone);
    // Dispatched from a click rather than from a form action, so opening the transition is ours to
    // do. It is what keeps `pending` reliable, and the waiting screen below is all `pending`.
    startTransition(() => submit(data));
  }

  // The chart is being computed. Saying what is happening is the whole difference between a wait
  // that reads as considered and one that reads as broken.
  if (pending) {
    return (
      <div className="flex min-h-72 flex-col items-center justify-center gap-4 text-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
        <div className="space-y-1">
          <p className="font-display text-xl">Reading the sky as it was</p>
          <p className="text-sm text-muted-foreground">
            Placing every body at the moment you were born. This happens once, and then it is yours.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <ol className="flex items-center gap-3" aria-label="Progress">
        {STEPS.map((label, index) => (
          <li key={label} className="flex min-w-0 flex-1 items-center gap-2">
            <span
              className={cn(
                'flex size-6 shrink-0 items-center justify-center rounded-full border text-xs',
                index < step && 'border-primary bg-primary text-primary-foreground',
                index === step && 'border-primary text-primary',
                index > step && 'text-muted-foreground',
              )}
            >
              {index < step ? <Check className="size-3" /> : index + 1}
            </span>
            {/* On a narrow screen only the step being worked on is named. Three truncated labels
                say less than one whole one. */}
            <span
              className={cn(
                'eyebrow truncate',
                index === step ? 'text-foreground' : 'hidden text-muted-foreground sm:inline',
              )}
            >
              {label}
            </span>
          </li>
        ))}
      </ol>

      {step === 0 ? (
        <div className="space-y-6">
          <div className="space-y-3">
            <h2 className="font-display text-2xl">You only do this once</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              A birth chart is a photograph of the sky at one exact moment. That moment does not
              change, so the chart is calculated a single time, stored in a database you own, and
              read from there ever after. It is never recalculated and never sent anywhere again.
            </p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Three short steps: when you were born, where, and how you would like to be spoken to.
              About a minute.
            </p>
          </div>
          <Button size="lg" className="w-full" onClick={() => setStep(1)}>
            Begin
          </Button>
        </div>
      ) : null}

      {step === 1 ? (
        <div className="space-y-6">
          <div className="space-y-2">
            <h2 className="font-display text-2xl">When and where you began</h2>
            <p className="text-sm text-muted-foreground">
              These four values are the only thing ever sent to be calculated.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="displayName">What should the companion call you</Label>
            <Input
              id="displayName"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              maxLength={80}
              autoComplete="given-name"
              placeholder="Rosa"
            />
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="birthDate">Birth date</Label>
              <Input
                id="birthDate"
                type="date"
                value={birthDate}
                onChange={(event) => setBirthDate(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="birthTime">Birth time</Label>
              <Input
                id="birthTime"
                type="time"
                value={birthTime}
                onChange={(event) => setBirthTime(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                It is on a birth certificate. The ascendant moves a degree every four minutes, so
                this is the value worth checking.
              </p>
            </div>
          </div>

          <CitySearch selected={city} onSelect={setCity} />

          <div className="flex gap-3">
            <Button variant="ghost" size="lg" onClick={() => setStep(0)}>
              <ArrowLeft className="size-4" />
              Back
            </Button>
            <Button
              size="lg"
              className="flex-1"
              disabled={!detailsComplete}
              onClick={() => setStep(2)}
            >
              {detailsComplete ? 'Choose a voice' : 'Fill in all four to continue'}
            </Button>
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="space-y-6">
          <div className="space-y-2">
            <h2 className="font-display text-2xl">How should it speak to you</h2>
            <p className="text-sm text-muted-foreground">
              This changes the voice and never the facts. Here is how each one sounds.
            </p>
          </div>

          <fieldset className="space-y-3">
            <legend className="sr-only">Voice</legend>
            {TONES.map((option) => (
              <label
                key={option.value}
                className={cn(
                  'block cursor-pointer rounded-2xl border p-4',
                  tone === option.value ? 'border-primary bg-card' : 'hover:bg-card/60',
                )}
              >
                <input
                  type="radio"
                  name="tone-choice"
                  value={option.value}
                  checked={tone === option.value}
                  onChange={() => setTone(option.value)}
                  className="sr-only"
                />
                <span className="flex items-baseline justify-between gap-3">
                  <span className="font-display text-lg">{option.label}</span>
                  <span className="eyebrow text-muted-foreground">{option.hint}</span>
                </span>
                <span className="mt-2 block text-sm italic text-muted-foreground">
                  {option.sample}
                </span>
              </label>
            ))}
          </fieldset>

          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

          <div className="flex gap-3">
            <Button variant="ghost" size="lg" onClick={() => setStep(1)}>
              <ArrowLeft className="size-4" />
              Back
            </Button>
            <Button size="lg" className="flex-1" onClick={finish}>
              Meet your companion
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
