import { describe, expect, it } from 'vitest';
import { sanitizeRedirectPath } from '@/lib/utils';

describe('sanitizeRedirectPath', () => {
  it('rejects the backslash form browsers normalize to a protocol relative URL', () => {
    expect(sanitizeRedirectPath('/\\evil.example/phish')).toBe('/companion');
  });

  it('passes an ordinary relative path through', () => {
    expect(sanitizeRedirectPath('/chart')).toBe('/chart');
    expect(sanitizeRedirectPath('/companion?welcome=1')).toBe('/companion?welcome=1');
  });

  it('rejects absolute URLs to other hosts', () => {
    expect(sanitizeRedirectPath('https://evil.example/phish')).toBe('/companion');
    expect(sanitizeRedirectPath('http://evil.example')).toBe('/companion');
  });

  it('rejects the protocol relative double slash form', () => {
    expect(sanitizeRedirectPath('//evil.example/phish')).toBe('/companion');
  });

  it('falls back when the parameter is missing or empty', () => {
    expect(sanitizeRedirectPath(null)).toBe('/companion');
    expect(sanitizeRedirectPath('')).toBe('/companion');
  });

  it('honours a caller supplied fallback', () => {
    expect(sanitizeRedirectPath('javascript:alert(1)', '/')).toBe('/');
  });
});
