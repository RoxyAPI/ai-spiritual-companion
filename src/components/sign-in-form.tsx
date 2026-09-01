'use client';

import { Loader2, MailCheck } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createClient } from '@/lib/supabase/client';

/**
 * One field and one button. A link in an email means no password for somebody to remember, no reset
 * flow to build, and no credential of theirs for you to lose.
 *
 * @remarks Three states, all of them designed: asking, sending, and sent. The sent state names the
 * address the link went to, because the single most common failure of a passwordless sign in is a
 * typo in the address, and a person cannot spot one they were never shown.
 */
export function SignInForm() {
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (sentTo) {
    return (
      <div className="space-y-4">
        <div className="flex size-10 items-center justify-center rounded-full border">
          <MailCheck className="size-4 text-primary" />
        </div>
        <div className="space-y-2">
          <p className="font-display text-xl">Check your inbox</p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            A sign in link is on its way to <span className="text-foreground">{sentTo}</span>. It
            works once and expires shortly, so open it on this device if you can.
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="px-0"
          onClick={() => {
            setSentTo(null);
            setEmail('');
          }}
        >
          Use a different address
        </Button>
      </div>
    );
  }

  return (
    <form
      className="space-y-5"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        setError(null);

        const { error: signInError } = await createClient().auth.signInWithOtp({
          email,
          options: { emailRedirectTo: `${window.location.origin}/auth/confirm?next=/companion` },
        });

        setPending(false);
        if (signInError) setError(signInError.message);
        else setSentTo(email);
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Button type="submit" size="lg" className="w-full" disabled={pending || !email}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : null}
        {pending ? 'Sending your link' : 'Email me a sign in link'}
      </Button>

      <p className="text-xs leading-relaxed text-muted-foreground">
        No password to set and none for anybody to lose. New here? The same link creates your
        account.
      </p>
    </form>
  );
}
