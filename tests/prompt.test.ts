import { describe, expect, it } from 'vitest';
import { buildSystemPrompt, TONE_PRESETS } from '@/lib/prompt';
import type { PromptContext, TonePreset } from '@/types';

/**
 * The voice, and the two things the voice may never override.
 *
 * A tone preset changes how the companion speaks. It never changes what it knows, and it never
 * removes the boundaries, which is why those live outside the preset map and are asserted under
 * every one of them here.
 */

const TONES: TonePreset[] = ['warm', 'mystical', 'clinical', 'edgy'];

const context: PromptContext = {
  displayName: 'Rosa',
  tone: 'warm',
  birth: {
    date: '1990-01-15',
    time: '14:30:00',
    latitude: 38.7167,
    longitude: -9.1333,
    timezone: 'Europe/Lisbon',
  },
  birthPlace: 'Lisbon, Lisbon, Portugal',
  chart: {
    sun: 'Capricorn at 25.19 degrees, house 10',
    moon: 'Taurus at 3.40 degrees, house 2',
    ascendant: 'Gemini at 12.00 degrees',
    placements: ['Venus in Sagittarius at 4.2 degrees, house 7'],
    aspects: ['Sun trine Moon, orb 0.4 degrees'],
  },
  memories: [{ content: 'Career was the theme last month', createdAt: '2026-08-01T09:00:00Z' }],
  hasTools: true,
  today: '2026-09-01',
};

describe('every tone in the type union has a voice', () => {
  it('has exactly the four documented presets and no orphan', () => {
    expect(Object.keys(TONE_PRESETS).sort()).toEqual([...TONES].sort());
  });

  for (const tone of TONES) {
    it(`${tone} has a paragraph`, () => {
      expect(TONE_PRESETS[tone].length).toBeGreaterThan(40);
    });
  }
});

describe('the boundaries survive every tone', () => {
  for (const tone of TONES) {
    const prompt = buildSystemPrompt({ ...context, tone }, 'Lumen');

    it(`${tone} keeps the not medical, not legal, not financial rule`, () => {
      expect(prompt).toContain('not a doctor, a lawyer, or a financial adviser');
    });

    it(`${tone} keeps the distress rule and sends it to a real service`, () => {
      expect(prompt).toContain('stop reading the chart');
      expect(prompt).toContain('crisis line or emergency service');
    });

    it(`${tone} keeps the guide, not partner, framing`, () => {
      expect(prompt).toContain('not a romantic partner');
    });

    it(`${tone} keeps the grounding rules`, () => {
      expect(prompt).toContain('Ground every single claim in the data above');
    });
  }
});

describe('everything the turn knows reaches the prompt', () => {
  const prompt = buildSystemPrompt(context, 'Lumen');

  it('carries the product name and the person', () => {
    expect(prompt).toContain('You are Lumen');
    expect(prompt).toContain('Rosa');
  });

  it('states the date explicitly rather than leaving the model to infer it', () => {
    expect(prompt).toContain('2026-09-01');
  });

  it('carries the chart facts, not the whole chart', () => {
    expect(prompt).toContain('Capricorn at 25.19 degrees');
    expect(prompt).toContain('Gemini at 12.00 degrees');
  });

  it('carries the recalled memory with its date', () => {
    expect(prompt).toContain('Career was the theme last month');
    expect(prompt).toContain('2026-08-01');
  });

  it('says plainly when there is no memory yet rather than leaving a blank', () => {
    const first = buildSystemPrompt({ ...context, memories: [] }, 'Lumen');
    expect(first).toContain('first conversation');
  });

  it('tells the model to ask for the compact response shape on every calculation', () => {
    expect(prompt).toContain('Always pass compact true');
  });

  it('makes it resolve a place before a calculation that needs one', () => {
    expect(prompt).toContain('IANA timezone');
    expect(prompt).toContain('Never a numeric offset');
  });

  it('refuses to invent anything when no calculation server answered', () => {
    const offline = buildSystemPrompt({ ...context, hasTools: false }, 'Lumen');
    expect(offline).toContain('do not invent a transit, a card, or a date');
    expect(offline).not.toContain('Always pass compact true');
  });
});
