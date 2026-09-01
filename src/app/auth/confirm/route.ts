import { type EmailOtpType } from '@supabase/supabase-js';
import { redirect } from 'next/navigation';
import { type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/** Exchanges a magic link token for a session, then forwards to wherever the link was headed. */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const next = searchParams.get('next') ?? '/companion';

  if (!tokenHash || !type) redirect('/auth/error');

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });

  redirect(error ? '/auth/error' : next);
}
