import type { Thing, WithContext } from 'schema-dts';

/** Renders one structured data block. Built by `src/lib/seo.ts`, never inline in a page. */
export function JsonLd({ data }: { data: WithContext<Thing> }) {
  return (
    <script
      type="application/ld+json"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: structured data is built in seo.ts from typed, first-party values and never from user input.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
