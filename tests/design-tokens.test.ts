import { globSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The palette, and the one declared width.
 *
 * A half finished recolour is invisible until somebody opens the product in the other theme, so
 * every token is asserted in both blocks. The width is asserted because a per page wrapper drifts
 * from the header within a month of somebody adding one.
 */

const css = readFileSync(join(process.cwd(), 'src', 'app', 'globals.css'), 'utf8');

const TOKENS = [
  'background',
  'foreground',
  'card',
  'card-foreground',
  'popover',
  'popover-foreground',
  'primary',
  'primary-foreground',
  'secondary',
  'secondary-foreground',
  'muted',
  'muted-foreground',
  'accent',
  'accent-foreground',
  'destructive',
  'border',
  'input',
  'ring',
];

function block(selector: string): string {
  const match = css.match(new RegExp(`\\n${selector.replace('.', '\\.')} \\{([\\s\\S]*?)\\n\\}`));
  if (!match) throw new Error(`No ${selector} block in globals.css`);
  return match[1];
}

describe('the palette is complete in both themes', () => {
  const light = block(':root');
  const dark = block('.dark');

  for (const token of TOKENS) {
    it(`${token} is declared in light`, () => {
      expect(light).toMatch(new RegExp(`--${token}:\\s*#[0-9A-Fa-f]{6};`));
    });

    it(`${token} is declared in dark`, () => {
      expect(dark).toMatch(new RegExp(`--${token}:\\s*#[0-9A-Fa-f]{6};`));
    });
  }

  it('declares the layout variables the conversation screen subtracts', () => {
    expect(light).toContain('--header-h:');
    expect(light).toContain('--radius:');
  });
});

describe('the social card uses the light palette it cannot read', () => {
  const card = readFileSync(join(process.cwd(), 'src', 'app', 'opengraph-image.tsx'), 'utf8');
  const light = block(':root');

  for (const token of ['background', 'foreground', 'muted-foreground', 'accent']) {
    it(`the card still uses the ${token} value from the stylesheet`, () => {
      const value = light.match(new RegExp(`--${token}:\\s*(#[0-9A-Fa-f]{6});`))?.[1];
      expect(value).toBeDefined();
      expect(card).toContain(value as string);
    });
  }
});

describe('the measure is declared once', () => {
  it('globals.css declares .site-container', () => {
    expect(css).toContain('.site-container {');
    expect(css).toMatch(/\.site-container \{[\s\S]*?max-w-\w+/);
  });

  it('nothing under src declares its own page width', () => {
    const files = globSync('src/**/*.tsx', { cwd: process.cwd() });
    const offenders = files.filter((file) => {
      if (file.includes('components/ui/')) return false;
      const source = readFileSync(join(process.cwd(), file), 'utf8');
      // A narrower measure INSIDE a section is fine and expected; a max-w-5xl or wider is the
      // container being redeclared.
      return /max-w-(5xl|6xl|7xl|screen)/.test(source);
    });
    expect(offenders).toEqual([]);
  });
});
