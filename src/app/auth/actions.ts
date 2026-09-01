'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

/**
 * Runs on the server so the browser only ever talks to this app. The Supabase URL does not need to
 * be reachable from wherever the visitor is browsing, which is what keeps sign in working over SSH
 * tunnels, containers, and preview deployments alike.
 */
export async function sendMagicLink(email: string): Promise<{ error: string | null }> {
  const origin = (await headers()).get('origin') ?? 'http://localhost:3000';
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/confirm?next=/companion` },
  });
  return { error: error?.message ?? null };
}

/** Ends the session on the server and returns to the landing page. */
export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/');
}
