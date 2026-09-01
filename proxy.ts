import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/proxy';

/**
 * Refreshes the session on every request so a server component never reads an expired one. It does
 * that and nothing else: gating lives in the pages, where the redirect target is obvious.
 */
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
