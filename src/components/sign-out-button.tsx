'use client';

import { signOut } from '@/app/auth/actions';
import { Button } from '@/components/ui/button';

/** Ends the session and returns to the landing page. The call runs on the server. */
export function SignOutButton() {
  return (
    <Button variant="ghost" size="sm" onClick={() => signOut()}>
      Sign out
    </Button>
  );
}
