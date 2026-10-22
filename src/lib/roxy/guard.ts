import 'server-only';
import { hasApiKey } from './client';

/** Shown when no key is configured. The setup notice renders this rather than a stack trace. */
export const NO_KEY =
  'ROXY_API_KEY is not set. Add it to .env.local and restart the dev server. Get a key at roxyapi.com/pricing.';

/**
 * The envelope every SDK method resolves to. `data` is the typed response on success and `error` is
 * the typed API error on failure; the two are mutually exclusive, and the error always carries a
 * stable `code` worth switching on.
 */
interface SdkResult<T> {
  data?: T;
  error?: { error?: string; code?: string } | undefined;
  /** The raw response, absent when the request never completed. Read for `Retry-After`. */
  response?: { headers: Headers } | undefined;
}

/** Whole seconds from a `Retry-After` header, or `undefined` when it is absent or not a number. */
function retryAfterSeconds(headers: Headers | undefined): number | undefined {
  const seconds = Number(headers?.get('Retry-After'));
  return Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : undefined;
}

/** Maps a stable error code to something a person can act on, without leaking internals. */
function messageForCode(code: string | undefined, retryAfter?: number): string {
  switch (code) {
    case 'validation_error':
      return 'That request was rejected as invalid. Check the birth date, time, and place.';
    case 'date_out_of_range':
      return 'That date is outside the range the calculations cover. Try a different date.';
    case 'api_key_required':
    case 'invalid_api_key':
      return NO_KEY;
    case 'api_key_revoked':
      return 'This API key has been revoked. Create a new one at roxyapi.com/account and update ROXY_API_KEY.';
    case 'origin_required':
    case 'origin_not_allowed':
      return 'This key is restricted to approved websites. Use a secret key in ROXY_API_KEY, since this app calls from the server.';
    case 'subscription_not_found':
    case 'subscription_inactive':
      return 'This key has no active subscription. Renew at roxyapi.com/account.';
    case 'rate_limit_exceeded':
      return 'Monthly request quota reached. Upgrade at roxyapi.com/pricing.';
    case 'rate_limit_per_minute':
    case 'compute_saturated':
      return `The calculation service is briefly busy. Try again ${
        retryAfter ? `in ${retryAfter} ${retryAfter === 1 ? 'second' : 'seconds'}` : 'in a moment'
      }.`;
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
  const { data, error, response } = await call;
  if (error) {
    console.error('[roxy] calculation call failed:', error.code ?? 'no code', error.error ?? '');
    throw new Error(messageForCode(error.code, retryAfterSeconds(response?.headers)));
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
