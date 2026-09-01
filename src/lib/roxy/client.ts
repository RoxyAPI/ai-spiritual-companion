import 'server-only';
import { createRoxy } from '@roxyapi/sdk';

/**
 * The calculation client. One key unlocks every domain, so there is no base URL to configure and no
 * schema to keep in sync: `createRoxy` sets the base URL and the auth on every request, and the
 * response types are generated from the live specification.
 *
 * @remarks The `server-only` import makes any accidental import from a client component a build
 * error, so the key cannot reach the browser by mistake rather than by discipline. Read
 * {@link hasApiKey} at a page boundary, or wrap the call in `unwrap` from `./guard`.
 */
const key = process.env.ROXYAPI_KEY;

export const roxy = createRoxy(key ?? '');

/** True when `ROXYAPI_KEY` is set. */
export const hasApiKey = Boolean(key);
