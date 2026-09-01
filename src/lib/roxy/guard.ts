import 'server-only';
import { hasApiKey } from './client';

/** Shown when no key is configured. The setup notice renders this rather than a stack trace. */
export const NO_KEY =
  'ROXYAPI_KEY is not set. Add it to .env.local and restart the dev server. Get a key at roxyapi.com/pricing.';

/**
 * The envelope every SDK method resolves to. `data` is the typed response on success and `error` is
 * the typed API error on failure; the two are mutually exclusive, and the error always carries a
 * stable `code` worth switching on.
 */
interface SdkResult<T> {
  data?: T;
  error?: { error?: string; code?: string } | undefined;
}

/** Maps a stable error code to something a person can act on, without leaking internals. */
function messageForCode(code: string | undefined): string {
  switch (code) {
    case 'validation_error':
      return 'That request was rejected as invalid. Check the birth date, time, and place.';
    case 'api_key_required':
    case 'invalid_api_key':
      return NO_KEY;
    case 'subscription_not_found':
    case 'subscription_inactive':
      return 'This key has no active subscription. Renew at roxyapi.com/account.';
    case 'rate_limit_exceeded':
      return 'Monthly request quota reached. Upgrade at roxyapi.com/pricing.';
    case 'not_found':
      return 'That was not found.';
    default:
      // The upstream text is deliberately not passed through to the reader. It is third party prose
      // that has never been reviewed for what it discloses, and it describes nothing the reader can
      // act on. Whoever runs the server gets the real thing in the log below instead.
      return 'The calculation could not be completed. Please try again.';
  }
}

/**
 * Awaits one call, returns its `data`, and throws a clear error otherwise. Every server action and
 * route handler calls this instead of repeating the missing key check and the error branch.
 *
 * @example
 * ```ts
 * const chart = await unwrap(roxy.astrology.generateNatalChart({ body: birth }));
 * ```
 */
export async function unwrap<T>(call: Promise<SdkResult<T>>): Promise<T> {
  if (!hasApiKey) throw new Error(NO_KEY);
  const { data, error } = await call;
  if (error) {
    console.error('[roxy] calculation call failed:', error.code ?? 'no code', error.error ?? '');
    throw new Error(messageForCode(error.code));
  }
  return data as T;
}

/**
 * Non throwing variant, for a caller that has something useful to do without the answer. The chat
 * turn uses it: a transit lookup that fails should still get a reply out of the chart and the
 * memory rather than failing the whole turn.
 */
export async function tryUnwrap<T>(
  call: Promise<SdkResult<T>>,
): Promise<{ data: T } | { error: string }> {
  try {
    return { data: await unwrap(call) };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'The calculation could not be completed.',
    };
  }
}
