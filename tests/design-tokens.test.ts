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
  'foreground-soft',
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
  'success',
  'success-ink',
  'warning',
  'warning-ink',
  'destructive',
  'destructive-ink',
  'info',
  'info-ink',
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

/**
 * The components that draw a calculation read their own `--roxy-*` tokens, and every surface,
 * ink, status colour, face and corner they paint comes from one of them. Mapping the whole set
 * onto the palette is what makes a drawn result part of the page rather than a card dropped on
 * it, and a colour written here instead of a reference is the failure worth catching: it looks
 * right in one theme and wrong in the other.
 *
 * Three tokens are absent on purpose and are asserted absent, because setting them would break a
 * derivation the library depends on: `--roxy-accent-ink` and `--roxy-ring` follow the accent, and
 * `--roxy-heat` follows the danger colour.
 */
describe('the drawn calculations follow the palette', () => {
  const light = block(':root');

  const BRIDGE: Record<string, string> = {
    'roxy-bg': 'background',
    'roxy-surface': 'card',
    'roxy-fg': 'card-foreground',
    'roxy-primary': 'card-foreground',
    'roxy-secondary': 'foreground-soft',
    'roxy-ring': 'ring',
    'roxy-muted': 'muted-foreground',
    'roxy-border': 'border',
    'roxy-accent': 'primary',
    'roxy-success': 'success',
    'roxy-success-fg': 'success-ink',
    'roxy-warning': 'warning',
    'roxy-warning-fg': 'warning-ink',
    'roxy-danger': 'destructive',
    'roxy-danger-fg': 'destructive-ink',
    'roxy-info': 'info',
    'roxy-info-fg': 'info-ink',
    'roxy-font-sans': 'font-sans-var',
    'roxy-font-display': 'font-display-var',
  };

  for (const [roxy, app] of Object.entries(BRIDGE)) {
    it(`${roxy} reads the ${app} token rather than a value of its own`, () => {
      expect(light).toMatch(new RegExp(`--${roxy}:[^;]*var\\(--${app}[,)]`));
    });
  }

  for (const derived of ['roxy-accent-ink', 'roxy-heat']) {
    it(`${derived} is left to derive rather than pinned`, () => {
      expect(css).not.toMatch(new RegExp(`--${derived}:`));
    });
  }

  it('never pins a colour of its own anywhere in the stylesheet', () => {
    const pinned = [...css.matchAll(/--roxy-[a-z-]+:\s*([^;]+);/g)].filter(([, value]) =>
      /#[0-9A-Fa-f]{3,8}\b|\brgba?\(|\bhsla?\(|\boklch\(/.test(value),
    );
    expect(pinned.map(([line]) => line.trim())).toEqual([]);
  });

  it('is declared once, because the dark block already moves what it points at', () => {
    expect(block('.dark')).not.toContain('--roxy-');
  });

  it('separates surfaces with a border rather than a shadow, like the rest of the product', () => {
    for (const step of ['sm', 'md', 'lg']) {
      expect(light).toMatch(new RegExp(`--roxy-shadow-${step}:\\s*none;`));
    }
  });

  /**
   * The radius scale is stated twice, once for Tailwind and once for the components, because the
   * theme block is tree shaken and its variables cannot be relied on at runtime. A test between
   * the two is what makes writing a ratio twice safe.
   */
  it('draws its corners from the same radius scale the rest of the product uses', () => {
    const theme = css.match(/@theme inline \{([\s\S]*?)\n\}/)?.[1] ?? '';
    // The library rounds a small mark with the small step, a panel with the medium one, and its
    // outer card with the large one, so those land on the product's small, base and card corners.
    for (const [roxyStep, appStep] of [
      ['sm', 'sm'],
      ['lg', '2xl'],
    ] as const) {
      const ratio = theme.match(
        new RegExp(`--radius-${appStep}:\\s*calc\\(var\\(--radius\\) \\* ([0-9.]+)\\)`),
      )?.[1];
      expect(ratio).toBeDefined();
      expect(light).toContain(`--roxy-radius-${roxyStep}: calc(var(--radius) * ${ratio});`);
    }
    expect(light).toContain('--roxy-radius-md: var(--radius);');
    expect(theme).toContain('--radius-lg: var(--radius);');
  });
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
