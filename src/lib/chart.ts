import type { ChartFacts, NatalChartResponse } from '@/types';

/**
 * Turns a canonical aspect name into something a reader recognises.
 *
 * @remarks The canonical values are upper case with underscores because they are meant to be
 * compared in code, and they stay that way in the response. Anything a person reads goes through
 * here, so `SEMI_SEXTILE` never reaches a page as itself.
 */
export function aspectLabel(type: string): string {
  const words = type.toLowerCase().split('_');
  return words[0].charAt(0).toUpperCase() + words[0].slice(1) + (words[1] ? ` ${words[1]}` : '');
}

/**
 * Compresses a stored chart into the handful of facts a conversation can actually use.
 *
 * A natal chart response is large and mostly noise for a chat turn: pasting the whole thing into
 * the prompt costs context, buries the placements that matter, and makes the reply read like a
 * printout. This picks the luminaries, the ascendant, the strongest placements, and the tightest
 * aspects, which is what a person reading a chart out loud would reach for.
 *
 * @remarks Canonical English names are used throughout (`sign`, not `signLocalized`), because these
 * strings are compared and formatted in code. The localized partners exist for display only.
 */
export function chartFacts(natal: NatalChartResponse): ChartFacts {
  const planets = natal.planets ?? [];
  const byName = (name: string) => planets.find((p) => p.name === name);

  const sun = byName('Sun');
  const moon = byName('Moon');

  const placements = planets
    .filter((p) => p.name !== 'Sun' && p.name !== 'Moon')
    .slice(0, 8)
    .map(
      (p) =>
        `${p.name} in ${p.sign} at ${p.degree.toFixed(1)} degrees, house ${p.house}${
          p.isRetrograde ? ', retrograde' : ''
        }`,
    );

  const aspects = [...(natal.aspects ?? [])]
    .sort((a, b) => a.orb - b.orb)
    .slice(0, 6)
    .map(
      (a) => `${a.planet1} ${aspectLabel(a.type)} ${a.planet2}, orb ${a.orb.toFixed(1)} degrees`,
    );

  return {
    sun: sun ? `${sun.sign} at ${sun.degree.toFixed(2)} degrees, house ${sun.house}` : 'unknown',
    moon: moon
      ? `${moon.sign} at ${moon.degree.toFixed(2)} degrees, house ${moon.house}`
      : 'unknown',
    ascendant: `${natal.ascendant.sign} at ${natal.ascendant.degree.toFixed(2)} degrees`,
    placements,
    aspects,
  };
}
