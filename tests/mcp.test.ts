import type { ToolSet } from 'ai';
import { describe, expect, it } from 'vitest';
import {
  COMPANION_TOOLS,
  DEFAULT_PRODUCTS,
  NEVER_EXPOSED,
  resolveProducts,
  selectTools,
  withCompactResults,
} from '@/lib/mcp';

/**
 * The two things about the tool layer that are worth holding still: which domains are connected by
 * default, and that every call asks for the compact response shape.
 *
 * The wrapper is exercised through a stand in tool rather than a live server, because what is being
 * guarded is the argument injection and not the network.
 */

describe('the default domain set', () => {
  it('is lean rather than every domain on the platform', () => {
    expect(DEFAULT_PRODUCTS.length).toBeLessThanOrEqual(5);
  });

  it('leads with Western astrology and always includes location', () => {
    expect(DEFAULT_PRODUCTS[0]).toBe('astrology');
    expect(DEFAULT_PRODUCTS).toContain('location');
  });

  it('every selected tool belongs to a domain that is connected by default', () => {
    const prefixes = { astrology: 'astrology', tarot: 'tarot', location: 'location' };
    for (const tool of COMPANION_TOOLS) {
      const domain = Object.values(prefixes).find((name) => tool.includes(`_${name}_`));
      expect(domain, `${tool} has no connected domain`).toBeDefined();
    }
  });
});

describe('the tool set given to the model', () => {
  const everything = Object.fromEntries(
    [
      ...COMPANION_TOOLS,
      ...NEVER_EXPOSED,
      'post_astrology_astrocartography',
      'get_tarot_cards',
    ].map((name) => [name, { description: name }]),
  ) as unknown as ToolSet;

  it('stays inside the range vendors publish as reliable for tool selection', () => {
    // Anthropic documents degradation past 30 to 50, OpenAI suggests under 20, Google 10 to 20.
    // Sources in docs/companion.md. Twenty is comfortably inside all three.
    expect(COMPANION_TOOLS.length).toBeLessThanOrEqual(20);
  });

  it('gives the model the companion selection and nothing else by default', () => {
    expect(Object.keys(selectTools(everything)).sort()).toEqual([...COMPANION_TOOLS].sort());
  });

  it('opens up to everything the connected domains offer when asked', () => {
    const all = Object.keys(selectTools(everything, 'all'));
    expect(all).toContain('post_astrology_astrocartography');
    expect(all).toContain('get_tarot_cards');
  });

  it('never exposes the natal chart, because the app computes that exactly once', () => {
    for (const raw of [undefined, 'all', 'post_astrology_natal_chart']) {
      expect(Object.keys(selectTools(everything, raw))).not.toContain('post_astrology_natal_chart');
    }
  });

  it('accepts an explicit list', () => {
    expect(
      Object.keys(selectTools(everything, 'post_tarot_daily, get_location_search')).sort(),
    ).toEqual(['get_location_search', 'post_tarot_daily']);
  });
});

describe('resolveProducts', () => {
  it('falls back to the default when nothing is configured', () => {
    expect(resolveProducts(undefined)).toEqual(DEFAULT_PRODUCTS);
    expect(resolveProducts('   ')).toEqual(DEFAULT_PRODUCTS);
  });

  it('trims spaces and drops blanks', () => {
    expect(resolveProducts(' tarot , ,numerology ')).toEqual(['tarot', 'numerology']);
  });

  it('accepts the older suffixed slug form', () => {
    expect(resolveProducts('tarot-api,astrology')).toEqual(['tarot', 'astrology']);
  });
});

describe('every calculation asks for the compact response shape', () => {
  it('injects compact into the arguments the model supplied', async () => {
    const seen: unknown[] = [];
    const tools = withCompactResults({
      post_astrology_transits: {
        description: 'stand in',
        inputSchema: { jsonSchema: { type: 'object' } },
        execute: async (input: unknown) => {
          seen.push(input);
          return 'ok';
        },
      },
    } as unknown as ToolSet);

    await tools.post_astrology_transits.execute?.({ date: '2026-09-01' }, {} as never);

    expect(seen).toEqual([{ date: '2026-09-01', compact: true }]);
  });

  it('leaves a tool with no execute function alone rather than breaking it', () => {
    const tools = withCompactResults({
      inert: { description: 'no execute' },
    } as unknown as ToolSet);
    expect(tools.inert.execute).toBeUndefined();
  });
});
