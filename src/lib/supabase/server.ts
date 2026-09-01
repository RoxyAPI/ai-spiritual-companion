import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/types/database';

/**
 * The server client, for server components, server actions, and route handlers. Every query in the
 * project goes through this, which is what makes row level security the access control rather than
 * something the application code has to remember to repeat.
 *
 * @remarks Never hoist this into a module level constant. On a fluid runtime that would share one
 * client, and therefore one session, across two people.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '',
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // A server component cannot write cookies. The proxy refreshes the session instead,
            // so this is the expected path rather than an error worth surfacing.
          }
        },
      },
    },
  );
}
