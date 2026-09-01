import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/database';

/**
 * The browser client. Used by exactly two places, the sign in form and the sign out button, and
 * neither reads a table: every query in this project runs on the server, where the session cookie
 * lives. The key it carries is public by design and safe only because row level security is on
 * every table.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '',
  );
}
