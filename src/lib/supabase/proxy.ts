import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';
import type { Database } from '@/types/database';

/**
 * Refreshes the session on every request so a server component never reads an expired one.
 *
 * @remarks It refreshes and nothing else. Gating lives in the pages, where the redirect target is
 * obvious from the page it is on and can be reasoned about one route at a time. Gating here is how
 * an application ends up in a redirect loop it cannot see.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return response;

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '',
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Nothing may run between creating the client and this call. Anything in between can leave the
  // browser and the server holding different cookies, which surfaces as people being signed out at
  // random and is close to impossible to reproduce.
  await supabase.auth.getClaims();

  return response;
}
