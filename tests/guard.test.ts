import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The error contract.
 *
 * Two things are guarded. Every stable error code the calculation service returns still maps to a
 * message somebody can act on, and a missing key never reaches the network, which is what makes a
 * fork without a key show a setup notice rather than a stack trace.
 */

const ORIGINAL_KEY = process.env.ROXYAPI_KEY;

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  if (ORIGINAL_KEY === undefined) delete process.env.ROXYAPI_KEY;
  else process.env.ROXYAPI_KEY = ORIGINAL_KEY;
});

async function loadGuard(key: string | undefined) {
  if (key === undefined) delete process.env.ROXYAPI_KEY;
  else process.env.ROXYAPI_KEY = key;
  return await import('@/lib/roxy/guard');
}

describe('with no key configured', () => {
  it('never opens a request', async () => {
    const { unwrap } = await loadGuard(undefined);
    const call = vi.fn();

    await expect(unwrap(call() as never)).rejects.toThrow(/ROXYAPI_KEY is not set/);
    expect(call).toHaveBeenCalledTimes(1);
  });

  it('tells a forker exactly what to do about it', async () => {
    const { NO_KEY } = await loadGuard(undefined);
    expect(NO_KEY).toContain('.env.local');
    expect(NO_KEY).toContain('roxyapi.com/pricing');
  });
});

describe('error codes map to messages a person can act on', () => {
  const cases: [string, RegExp][] = [
    ['validation_error', /birth date, time, and place/],
    ['invalid_api_key', /ROXYAPI_KEY is not set/],
    ['subscription_inactive', /no active subscription/],
    ['rate_limit_exceeded', /quota reached/],
    ['not_found', /not found/],
  ];

  for (const [code, expected] of cases) {
    it(`${code}`, async () => {
      const { unwrap } = await loadGuard('test-key');
      await expect(unwrap(Promise.resolve({ error: { code } }))).rejects.toThrow(expected);
    });
  }

  it('never passes an unrecognised upstream message through to the reader', async () => {
    const { unwrap } = await loadGuard('test-key');
    const thrown = unwrap(
      Promise.resolve({ error: { code: 'something_new', error: 'Upstream said this' } }),
    );
    await expect(thrown).rejects.toThrow('The calculation could not be completed');
    // The upstream text is third party prose nobody reviewed. It goes to the server log instead.
    await expect(thrown).rejects.not.toThrow('Upstream said this');
  });
});

describe('tryUnwrap', () => {
  it('returns data rather than throwing on success', async () => {
    const { tryUnwrap } = await loadGuard('test-key');
    await expect(tryUnwrap(Promise.resolve({ data: { ok: true } }))).resolves.toEqual({
      data: { ok: true },
    });
  });

  it('returns the mapped message rather than throwing on failure', async () => {
    const { tryUnwrap } = await loadGuard('test-key');
    const result = await tryUnwrap(Promise.resolve({ error: { code: 'not_found' } }));
    expect(result).toHaveProperty('error');
  });
});
