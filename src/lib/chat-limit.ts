import 'server-only';

import type { createClient } from '@/lib/supabase/server';

/**
 * Per user spend protection for the chat route. Every completed turn appends one row to
 * `readings`, so counting recent rows is a rate limit that needs no extra store or dependency and
 * stays correct on serverless hosts, where an in memory counter would silently multiply by
 * instance count and reset on every cold start. The check runs before any model or calculation
 * call, so a person over the limit costs nothing.
 *
 * Tune with CHAT_TURNS_PER_MINUTE and CHAT_TURNS_PER_DAY. Setting either to 0 pauses the chat.
 */

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export interface ChatLimits {
  perMinute: number;
  perDay: number;
}

export type ChatQuota =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number; message: string };

const DEFAULT_PER_MINUTE = 8;
const DEFAULT_PER_DAY = 200;

/** Reads one limit from the environment, falling back when unset or not a usable number. */
export function readLimit(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
}

export function chatLimitsFromEnv(): ChatLimits {
  return {
    perMinute: readLimit(process.env.CHAT_TURNS_PER_MINUTE, DEFAULT_PER_MINUTE),
    perDay: readLimit(process.env.CHAT_TURNS_PER_DAY, DEFAULT_PER_DAY),
  };
}

/** Pure decision, tested directly. The day window is checked first because it is the wider claim. */
export function evaluateChatQuota(
  counts: { lastMinute: number; lastDay: number },
  limits: ChatLimits,
): ChatQuota {
  if (counts.lastDay >= limits.perDay) {
    return {
      allowed: false,
      retryAfterSeconds: 3600,
      message: 'The daily conversation limit is reached. It clears as the day rolls over.',
    };
  }
  if (counts.lastMinute >= limits.perMinute) {
    return {
      allowed: false,
      retryAfterSeconds: 30,
      message: 'A short pause. A few seconds between questions keeps the readings grounded.',
    };
  }
  return { allowed: true };
}

/** Counts this user's recent turns off the readings table and applies the limits. */
export async function checkChatQuota(
  supabase: SupabaseServerClient,
  userId: string,
  limits: ChatLimits = chatLimitsFromEnv(),
  now: Date = new Date(),
): Promise<ChatQuota> {
  const minuteAgo = new Date(now.getTime() - 60_000).toISOString();
  const dayAgo = new Date(now.getTime() - 86_400_000).toISOString();

  const [minute, day] = await Promise.all([
    supabase
      .from('readings')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', minuteAgo),
    supabase
      .from('readings')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', dayAgo),
  ]);

  return evaluateChatQuota({ lastMinute: minute.count ?? 0, lastDay: day.count ?? 0 }, limits);
}
