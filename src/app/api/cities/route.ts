import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { roxy } from '@/lib/roxy/client';
import { tryUnwrap } from '@/lib/roxy/guard';
import type { CityChoice } from '@/types';

/**
 * The city autocomplete, proxied so the key stays on the server.
 *
 * Nobody is ever asked for coordinates. This returns the latitude, the longitude, and the IANA
 * timezone alongside the name, and the onboarding form carries all three into the chart silently.
 * Province and country come back too, because they are what separates two places sharing a name.
 */
export async function GET(request: Request) {
  await requireUser();

  const q = new URL(request.url).searchParams.get('q')?.trim() ?? '';
  if (q.length < 3) return NextResponse.json({ cities: [] });

  const result = await tryUnwrap(roxy.location.searchCities({ query: { q, limit: 6 } }));
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 502 });

  const cities: CityChoice[] = result.data.cities.map((c) => ({
    city: c.city,
    province: c.province,
    country: c.country,
    latitude: c.latitude,
    longitude: c.longitude,
    timezone: c.timezone,
  }));

  return NextResponse.json({ cities });
}
