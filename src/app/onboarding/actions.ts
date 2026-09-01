'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { TONE_KEYS } from '@/lib/prompt';
import { roxy } from '@/lib/roxy/client';
import { unwrap } from '@/lib/roxy/guard';
import { createClient } from '@/lib/supabase/server';

/**
 * The only place in the product that computes a natal chart.
 *
 * It runs once per account. The chart comes from immutable birth data, so a second calculation
 * would be pure waste, and the primary key on `charts.user_id` means a bug that tried it would fail
 * loudly on the insert rather than quietly billing every conversation.
 */

const schema = z.object({
  displayName: z.string().trim().min(1, 'Tell the companion what to call you').max(80),
  birthDate: z.iso.date('Use the date picker'),
  birthTime: z.string().regex(/^\d{2}:\d{2}$/, 'Use the time picker'),
  // Derived from the preset map rather than repeated here. A hand written list accepts a SHORT one
  // silently, so a voice offered by the form would be rejected on submit and nothing would fail
  // until somebody picked it.
  tone: z.enum(TONE_KEYS),
  city: z.string().trim().min(1, 'Choose your birth city from the list'),
  province: z.string(),
  country: z.string(),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  timezone: z.string().trim().min(1, 'Choose your birth city from the list'),
});

export type OnboardingState = { error?: string };

export async function completeOnboarding(
  _previous: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Please check the form and try again.' };
  }

  const input = parsed.data;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect('/auth/login');

  const birth = {
    date: input.birthDate,
    time: `${input.birthTime}:00`,
    latitude: input.latitude,
    longitude: input.longitude,
    timezone: input.timezone,
  };

  const place = [input.city, input.province, input.country].filter(Boolean).join(', ');

  try {
    // Chart first. A profile without a chart would leave the companion holding birth data it cannot
    // read, and the chart is the call that can fail.
    const natal = await unwrap(roxy.astrology.generateNatalChart({ body: birth }));

    const { error: profileError } = await supabase.from('profiles').insert({
      id: auth.user.id,
      display_name: input.displayName,
      birth_date: birth.date,
      birth_time: birth.time,
      birth_place: place,
      latitude: birth.latitude,
      longitude: birth.longitude,
      timezone: birth.timezone,
      tone_preset: input.tone,
    });
    if (profileError) return { error: 'Your profile could not be saved. Please try again.' };

    const { error: chartError } = await supabase
      .from('charts')
      .insert({ user_id: auth.user.id, natal });
    if (chartError) return { error: 'Your chart could not be saved. Please try again.' };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Your chart could not be calculated.' };
  }

  redirect('/companion');
}
