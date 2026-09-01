import Link from 'next/link';
import { SignOutButton } from '@/components/sign-out-button';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { config } from '@/config/companion.config';
import { getUser } from '@/lib/auth';

/** Full width band, contained content, one fixed height so the conversation screen can subtract it. */
export async function SiteHeader() {
  const user = await getUser();

  return (
    <header className="border-b">
      <div className="site-container flex h-[var(--header-h)] items-center justify-between gap-4">
        <Link href="/" className="font-display text-lg tracking-tight">
          {config.name}
        </Link>
        <nav className="flex items-center gap-1">
          {user ? (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/companion">Companion</Link>
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/chart">Chart</Link>
              </Button>
              <SignOutButton />
            </>
          ) : (
            <Button variant="ghost" size="sm" asChild>
              <Link href="/auth/login">Sign in</Link>
            </Button>
          )}
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
