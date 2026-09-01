'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';

/** Ends the session and returns to the landing page. */
export function SignOutButton() {
  const router = useRouter();

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={async () => {
        await createClient().auth.signOut();
        router.push('/');
        router.refresh();
      }}
    >
      Sign out
    </Button>
  );
}
