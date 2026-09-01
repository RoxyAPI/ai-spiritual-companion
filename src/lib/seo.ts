import type { SoftwareApplication, WithContext } from 'schema-dts';
import { config } from '@/config/companion.config';

/**
 * The one structured data block, on the one indexed page.
 *
 * @remarks `satisfies WithContext<T>` is the part that earns its place: an invalid Schema.org
 * property fails the type check here rather than being silently dropped by the engine that reads
 * it. There is nothing else on this product worth describing to a machine, and emitting a Person
 * for somebody who has not signed up would be emitting a lie.
 */
export function softwareApplication() {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: config.name,
    description: config.description,
    url: config.siteUrl,
    applicationCategory: 'LifestyleApplication',
    operatingSystem: 'Web',
    license: 'https://opensource.org/licenses/MIT',
  } satisfies WithContext<SoftwareApplication>;
}
