import 'server-only';
import { createMCPClient, type MCPClient } from '@ai-sdk/mcp';
import type { ToolSet } from 'ai';

/**
 * The conversational half of the calculation layer.
 *
 * Every RoxyAPI domain is a Remote MCP server over Streamable HTTP, so the model can reach live
 * calculations itself: it resolves a city, pulls today transits, draws a card, without the
 * application deciding in advance which of those a question needed.
 *
 * The other half stays out of the model hands on purpose. The natal chart is computed once by the
 * onboarding action through `@roxyapi/sdk`, and the city autocomplete is proxied by a route
 * handler, because both are app controlled paths where exactly one call must happen. See
 * `docs/companion.md`.
 *
 * Clients live for the lifetime of the server instance and their tool definitions are cached, so a
 * cold start pays the discovery cost once and every later turn reuses it.
 */

const MCP_BASE = process.env.ROXYAPI_MCP_URL ?? 'https://roxyapi.com/mcp';
const API_KEY = process.env.ROXYAPI_KEY ?? '';

/**
 * The domains this companion connects by default, in canonical order, and the single place the
 * default lives. Override with `ROXYAPI_MCP_PRODUCTS`, a comma separated list of slugs.
 *
 * @remarks Western astrology for the chart and the sky, tarot for a reading the companion can
 * actually draw, and location so it can resolve a place itself mid conversation. Deliberately a
 * few domains rather than every domain on the platform: see {@link COMPANION_TOOLS} for why the
 * size of the exposed set matters, and `docs/companion.md` for the sources behind the number.
 *
 * Enabling more is one comma. Every domain on the platform works here without a code change,
 * including domains added after this was written.
 */
export const DEFAULT_PRODUCTS = ['astrology', 'tarot', 'location'];

/**
 * The tools a companion is given, out of everything the connected domains offer.
 *
 * @remarks Model vendors publish converging guidance that tool selection gets less accurate as the
 * list grows: Anthropic documents degradation past 30 to 50 tools, OpenAI suggests fewer than 20
 * available at the start of a turn, and Google recommends an active set of 10 to 20. The connected
 * domains offer 52 between them, which is over that line for the default model, so the companion
 * is given the subset a companion uses. Sources are in `docs/companion.md`.
 *
 * Set `ROXYAPI_MCP_TOOLS=all` to expose everything the connected domains offer, which is the right
 * move on a stronger model or a fork that needs the breadth. {@link NEVER_EXPOSED} still applies.
 */
export const COMPANION_TOOLS = [
  // The sky, now and ahead.
  'post_astrology_transits',
  'post_astrology_transit_aspects',
  'post_astrology_transits_monthly',
  'get_astrology_moon_phase_current',
  'get_astrology_moon_phase_upcoming',
  // The period, in words.
  'get_astrology_horoscope_sign_daily',
  'get_astrology_horoscope_sign_weekly',
  'get_astrology_horoscope_sign_monthly',
  // The year, and the slow inner clock.
  'post_astrology_solar_return',
  'post_astrology_progressions',
  // The question every companion is eventually asked about somebody else.
  'post_astrology_synastry',
  'post_astrology_compatibility_score',
  // Something to draw.
  'post_tarot_daily',
  'post_tarot_spreads_three_card',
  'post_tarot_yes_no',
  // Somewhere to place it.
  'get_location_search',
];

/**
 * Never given to the model, whatever else is configured.
 *
 * @remarks The natal chart is computed exactly once per account, by the onboarding action, and
 * cached. That guarantee is worth more than the convenience of letting the model recompute it, and
 * a guarantee the model can opt out of is not a guarantee, so the tool is withheld rather than
 * discouraged in a prompt. The chart is already in the prompt on every turn.
 */
export const NEVER_EXPOSED = ['post_astrology_natal_chart'];

/** Reads the configured slugs, tolerating spaces, blanks, and the older `-api` suffix form. */
export function resolveProducts(raw?: string): string[] {
  const requested = raw
    ?.split(',')
    .map((slug) => slug.trim())
    .filter(Boolean);
  const slugs = requested?.length ? requested : DEFAULT_PRODUCTS;
  return slugs.map((slug) => slug.replace(/-api$/, ''));
}

/** Narrows a tool set to the configured selection, minus anything the app must own itself. */
export function selectTools(tools: ToolSet, raw?: string): ToolSet {
  const requested = raw
    ?.split(',')
    .map((name) => name.trim())
    .filter(Boolean);
  const allowAll = requested?.length === 1 && requested[0].toLowerCase() === 'all';
  const allowed = new Set(requested?.length && !allowAll ? requested : COMPANION_TOOLS);

  return Object.fromEntries(
    Object.entries(tools).filter(
      ([name]) => !NEVER_EXPOSED.includes(name) && (allowAll || allowed.has(name)),
    ),
  ) as ToolSet;
}

/**
 * Wraps every tool so `compact: true` is part of the arguments whichever way the model calls it.
 *
 * Compact is an opt in per call flag on every RoxyAPI tool. It returns the same data with each
 * field name sent once for a whole array instead of once per row, which is lossless and typically
 * 40 to 52 percent fewer tokens on a detailed chart. Fewer tokens in the tool result is less to pay
 * for and less for the model to read; it changes nothing about how many requests are counted.
 *
 * The system prompt asks for the same thing in words. Both are deliberate: this wrapper makes it
 * certain, and the prompt line keeps the behaviour visible to somebody who removes the wrapper.
 */
export function withCompactResults(tools: ToolSet): ToolSet {
  return Object.fromEntries(
    Object.entries(tools).map(([name, tool]) => [
      name,
      tool.execute
        ? {
            ...tool,
            execute: (input: unknown, options: Parameters<NonNullable<typeof tool.execute>>[1]) =>
              tool.execute?.({ ...(input as object), compact: true }, options),
          }
        : tool,
    ]),
  ) as ToolSet;
}

let toolsCache: ToolSet | null = null;
let clients: MCPClient[] | null = null;
let initPromise: Promise<void> | null = null;

/**
 * Connects one domain, retrying a transient failure.
 *
 * @remarks Worth the twenty lines. A connection is opened once per server instance and the result
 * is cached, so a single dropped handshake at cold start would take that domain out of every
 * conversation until the process restarted, and it would do it quietly. Observed happening on a
 * first request opening several connections at once.
 */
async function connect(slug: string, attempts = 3): Promise<{ client: MCPClient; tools: ToolSet }> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const client = await createMCPClient({
        transport: {
          type: 'http',
          url: `${MCP_BASE}/${slug}`,
          headers: { 'X-API-Key': API_KEY },
        },
        // Retries a dropped tool call, which is a different failure from a dropped handshake.
        maxRetries: 2,
      });
      return { client, tools: await client.tools() };
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
    }
  }

  throw lastError;
}

async function initialize(): Promise<void> {
  const products = resolveProducts(process.env.ROXYAPI_MCP_PRODUCTS);
  const results = await Promise.allSettled(products.map((slug) => connect(slug)));

  const connected: MCPClient[] = [];
  const merged: ToolSet = {};

  // One unreachable domain must not cost the conversation the other three.
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      connected.push(result.value.client);
      Object.assign(merged, result.value.tools);
    } else {
      console.warn(`[mcp] could not connect ${products[index]}:`, result.reason);
    }
  });

  clients = connected;
  toolsCache = withCompactResults(selectTools(merged, process.env.ROXYAPI_MCP_TOOLS));

  console.log(
    `[mcp] connected ${connected.length} of ${products.length} domains, ` +
      `${Object.keys(toolsCache).length} of ${Object.keys(merged).length} tools given to the model`,
  );
}

/**
 * The tools the conversation may call, initialized on first use.
 *
 * @remarks Returns an empty set rather than throwing when no domain answers. A companion that has
 * lost its live calculations can still read the stored chart and what it remembers, which is a
 * worse answer than usual and a great deal better than no answer at all.
 */
export async function getCompanionTools(): Promise<ToolSet> {
  if (!toolsCache) {
    if (!initPromise) {
      initPromise = initialize().catch((error) => {
        initPromise = null;
        throw error;
      });
    }
    try {
      await initPromise;
    } catch (error) {
      console.warn('[mcp] no calculation tools available for this turn:', error);
      return {};
    }
  }

  return toolsCache ?? {};
}

/** Closes every client and clears the cache. For a graceful shutdown or a forced reconnect. */
export async function resetMcpClients(): Promise<void> {
  if (clients) await Promise.allSettled(clients.map((client) => client.close()));
  clients = null;
  toolsCache = null;
  initPromise = null;
}
