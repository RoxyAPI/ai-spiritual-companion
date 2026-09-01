import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { BirthData, TonePreset } from '@/types';

/**
 * The three states a visitor can be in, and the one helper that resolves them. Gating lives here
 * and in the pages rather than in the proxy, so a redirect target is obvious from the route it is
 * on and cannot quietly become a loop.
 */

export interface OnboardedUser {
  id: string;
  displayName: string;
  birth: BirthData;
  birthPlace: string;
  tone: TonePreset;
}

/** The signed in user, or `null`. */
export async function getUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
}

/** Sends a signed out visitor to sign in, and returns the user otherwise. */
export async function requireUser() {
  const user = await getUser();
  if (!user) redirect('/auth/login');
  return user;
}

/**
 * The gate every companion route uses. Sends a signed out visitor to sign in and an unfinished one
 * to onboarding, and otherwise returns the profile flattened into the shape the rest of the
 * application wants.
 */
export async function requireOnboarded(): Promise<OnboardedUser> {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from('profiles')
    .select(
      'display_name, birth_date, birth_time, birth_place, latitude, longitude, timezone, tone_preset',
    )
    .eq('id', user.id)
    .maybeSingle();

  if (!profile) redirect('/onboarding');

  return {
    id: user.id,
    displayName: profile.display_name,
    birthPlace: profile.birth_place,
    tone: profile.tone_preset,
    birth: {
      date: profile.birth_date,
      time: profile.birth_time,
      latitude: profile.latitude,
      longitude: profile.longitude,
      timezone: profile.timezone,
    },
  };
}
