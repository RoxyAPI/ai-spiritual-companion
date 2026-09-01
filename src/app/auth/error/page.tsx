import type { Metadata } from 'next';
import Link from 'next/link';
import { Section } from '@/components/section';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'That link did not work',
  robots: { index: false, follow: false },
};

export default function AuthErrorPage() {
  return (
    <Section containerClassName="max-w-md space-y-4 py-16 sm:py-24">
      <h1 className="text-2xl">That link did not work</h1>
      <p className="text-sm text-muted-foreground">
        Sign in links expire, and each one works once. Ask for a fresh one and it will let you
        straight through.
      </p>
      <Button asChild>
        <Link href="/auth/login">Send another link</Link>
      </Button>
    </Section>
  );
}
