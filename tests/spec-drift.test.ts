import { describe, expect, it } from 'vitest';
import { DEFAULT_PRODUCTS } from '@/lib/mcp';

/**
 * Upstream drift, checked against the live platform.
 *
 * Two surfaces are checked because the template uses two. The typed client calls two endpoints
 * directly, and the conversation reaches the rest through Remote MCP servers.
 *
 * This suite touches the network, so it runs on a schedule and never in a pull request: a green
 * build must not depend on a third party being reachable. A failure here means the template needs
 * updating, not that a contributor broke something.
 */

const SPEC = 'https://roxyapi.com/api/v2/openapi.json';
const MCP_BASE = 'https://roxyapi.com/mcp';

/** The endpoints the application calls itself, where exactly one call must happen. */
const CALLED = [
  { method: 'get', path: '/location/search', operationId: 'searchCities' },
  { method: 'post', path: '/astrology/natal-chart', operationId: 'generateNatalChart' },
] as const;

interface Spec {
  paths: Record<string, Record<string, { operationId?: string }>>;
}

describe('the endpoints the application calls itself still exist', async () => {
  const response = await fetch(SPEC);
  const spec = (await response.json()) as Spec;

  it('the specification is reachable', () => {
    expect(response.ok).toBe(true);
    expect(Object.keys(spec.paths).length).toBeGreaterThan(0);
  });

  for (const endpoint of CALLED) {
    it(`${endpoint.method.toUpperCase()} ${endpoint.path} is still ${endpoint.operationId}`, () => {
      expect(spec.paths[endpoint.path]?.[endpoint.method]?.operationId).toBe(endpoint.operationId);
    });
  }
});

describe('every domain the conversation connects to is still mounted', async () => {
  // Asking the base path which servers exist is cheaper and more honest than assuming, and it
  // needs no key, so this half of the suite runs anywhere.
  const response = await fetch(MCP_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
  });
  const body = (await response.json()) as { error?: { data?: { servers?: string[] } } };
  const mounted = body.error?.data?.servers ?? [];

  it('the platform lists its servers', () => {
    expect(mounted.length).toBeGreaterThan(0);
  });

  for (const slug of DEFAULT_PRODUCTS) {
    it(`${slug} is still mounted`, () => {
      expect(mounted).toContain(`/mcp/${slug}`);
    });
  }
});
