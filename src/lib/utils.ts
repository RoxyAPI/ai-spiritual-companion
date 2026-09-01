import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Forces a redirect target to stay on this site, returning the fallback for anything that would
 * leave it. Next.js redirect() forwards its argument verbatim with no validation of its own, so a
 * user supplied next parameter is an open redirect until it is checked. The check is the shape the
 * Next.js documentation itself uses: resolve against a base and require the same origin, which
 * also catches the protocol relative double slash and backslash forms a prefix test misses.
 */
export function sanitizeRedirectPath(raw: string | null, fallback = '/companion'): string {
  if (!raw) return fallback;
  try {
    const base = 'http://relative-check.local';
    const url = new URL(raw, base);
    if (url.origin !== base) return fallback;
    return url.pathname + url.search + url.hash;
  } catch {
    return fallback;
  }
}
