import type { CompanionConfig } from '@/types';

/**
 * The one file a fork edits. Everything a person would want to change without opening a component
 * lives here. Colours, fonts and layout are deliberately not here: they are in `globals.css` and
 * `docs/design.md` explains why.
 */
export const config: CompanionConfig = {
  name: 'Lumen',
  tagline: 'A companion that remembers you',
  description:
    'An AI spiritual companion built on your own database. Your chart is computed once and kept, every reading is remembered, and nothing you write ever leaves for a calculation.',
  siteUrl: 'http://localhost:3000',
  defaultTone: 'warm',
  recallCount: 4,
  supportUrl: 'https://roxyapi.com/contact',
};
