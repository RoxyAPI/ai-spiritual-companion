import { describe, expect, it } from 'vitest';
import { evaluateChatQuota, readLimit } from '@/lib/chat-limit';

const LIMITS = { perMinute: 8, perDay: 200 };

describe('evaluateChatQuota', () => {
  it('allows a turn under both windows', () => {
    expect(evaluateChatQuota({ lastMinute: 7, lastDay: 40 }, LIMITS)).toEqual({ allowed: true });
  });

  it('blocks at the minute cap with a short retry', () => {
    const quota = evaluateChatQuota({ lastMinute: 8, lastDay: 40 }, LIMITS);
    expect(quota.allowed).toBe(false);
    if (!quota.allowed) expect(quota.retryAfterSeconds).toBe(30);
  });

  it('blocks at the day cap with a long retry, and the day window wins over the minute one', () => {
    const quota = evaluateChatQuota({ lastMinute: 8, lastDay: 200 }, LIMITS);
    expect(quota.allowed).toBe(false);
    if (!quota.allowed) expect(quota.retryAfterSeconds).toBe(3600);
  });

  it('treats a zero limit as chat paused', () => {
    const quota = evaluateChatQuota({ lastMinute: 0, lastDay: 0 }, { perMinute: 0, perDay: 0 });
    expect(quota.allowed).toBe(false);
  });
});

describe('readLimit', () => {
  it('reads a plain number', () => {
    expect(readLimit('12', 8)).toBe(12);
  });

  it('floors decimals and accepts zero', () => {
    expect(readLimit('4.9', 8)).toBe(4);
    expect(readLimit('0', 8)).toBe(0);
  });

  it('falls back on unset, negative, or garbage values', () => {
    expect(readLimit(undefined, 8)).toBe(8);
    expect(readLimit('-3', 8)).toBe(8);
    expect(readLimit('plenty', 8)).toBe(8);
  });
});
