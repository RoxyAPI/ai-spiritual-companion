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
    const prompt = buildSystemPrompt({ ...context, tone }, 'Mira');

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
  const prompt = buildSystemPrompt(context, 'Mira');

  it('carries the product name and the person', () => {
    expect(prompt).toContain('You are Mira');
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
    const first = buildSystemPrompt({ ...context, memories: [] }, 'Mira');
    expect(first).toContain('first conversation');
    // A greeting must not become the whole reply on turn one.
    expect(first).toContain('Do not spend the reply on the greeting');
  });

  it('tells the model to answer what was asked rather than the sky in general', () => {
    expect(prompt).toContain('Answer the question that was asked');
  });

  it('tells the model to ask for the compact response shape on every calculation', () => {
    expect(prompt).toContain('Always pass compact true');
  });

  it('makes it resolve a place before a calculation that needs one', () => {
    expect(prompt).toContain('IANA timezone');
    expect(prompt).toContain('Never a numeric offset');
  });

  it('refuses to invent anything when no calculation server answered', () => {
    const offline = buildSystemPrompt({ ...context, hasTools: false }, 'Mira');
    expect(offline).toContain('do not invent a transit, a card, or a date');
    expect(offline).not.toContain('Always pass compact true');
  });
});

/**
 * The rules a practitioner would not need telling.
 *
 * Each of these came from a real conversation going wrong, so each is pinned separately: a block
 * quietly dropped from the assembled prompt is invisible until somebody hits the same wall again.
 */
describe('reading for somebody other than the account holder', () => {
  const prompt = buildSystemPrompt(context, 'Mira');

  it('says the kept chart belongs to one person', () => {
    expect(prompt).toContain('the chart you keep is theirs alone');
  });

  it('offers the live readings that do work for a third person', () => {
    expect(prompt).toContain('a compatibility reading between the two of them');
    expect(prompt).toContain('the sky right now against the other person birth details');
  });

  it('makes it use the details of the other person rather than the account holder', () => {
    expect(prompt).toContain('Resolve the other person city first');
    expect(prompt).toContain(
      'Never quietly substitute the details of the person you are talking to',
    );
  });

  it('answers a request to save a second chart honestly and in one sentence', () => {
    expect(prompt).toContain('Keeping a second chart is the one thing this space cannot do');
    expect(prompt).toContain('say so plainly in one sentence');
  });
});

describe('the input rules that stop a confident wrong answer', () => {
  const prompt = buildSystemPrompt(context, 'Mira');

  it('never guesses day against month on an all numeric date', () => {
    expect(prompt).toContain('never guess the order');
    expect(prompt).toContain('naming both readings of it');
    // A date that is already unambiguous must not trigger a needless question.
    expect(prompt).toContain('A number above 12 or a spelled month settles it on its own');
  });

  it('never invents a tool input', () => {
    expect(prompt).toContain('Call a tool only with values the person actually gave you');
  });

  it('reads the sky now as today rather than as the birth date', () => {
    expect(prompt).toContain('The sky right now means today');
    expect(prompt).toContain('It never means their birth date');
  });

  it('treats a when did or when will question as a calculation for that date', () => {
    expect(prompt).toContain('never a date recalled from memory');
  });

  it('retries a failed call corrected rather than identical', () => {
    expect(prompt).toContain('Never send an identical call that has already failed');
  });
});

describe('holding a reading under pressure', () => {
  const prompt = buildSystemPrompt(context, 'Mira');

  it('re-reads the data before answering a challenge', () => {
    expect(prompt).toContain('read the data again before you answer');
  });

  it('shows the check rather than caving', () => {
    expect(prompt).toContain('quote the exact figures');
    expect(prompt).toContain('name the convention you used');
  });

  it('corrects itself in one line when the data does not back it', () => {
    expect(prompt).toContain('correct it in one line');
  });

  it('never fabricates depth or agrees to be liked', () => {
    expect(prompt).toContain('Never invent a deeper layer to end a disagreement');
    expect(prompt).toContain('never agree with somebody only to be liked');
  });
});

describe('answering like a practitioner rather than an assistant', () => {
  const prompt = buildSystemPrompt(context, 'Mira');

  it('leads with the reading and never opens with a hedge', () => {
    expect(prompt).toContain('Lead with the reading');
    expect(prompt).toContain('never refuse to interpret something the data supports');
  });

  it('mirrors the language of the person and translates tool data whole', () => {
    expect(prompt).toContain('Reply in the language the person writes in');
    expect(prompt).toContain('never leave a fragment sitting in the original');
  });

  it('keeps everything inside this turn with no promise of later work', () => {
    expect(prompt).toContain('Everything you say happens in this turn');
    expect(prompt).toContain('never promise a result shortly');
  });

  it('carries on through a trimmed history without apologising', () => {
    expect(prompt).toContain('may have been trimmed to fit');
    expect(prompt).toContain('never apologise for it');
  });

  it('never names its tools or shows a raw data structure', () => {
    expect(prompt).toContain('Never name your tools and never show a raw data structure');
  });

  it('interprets the drawing beside the reply rather than reprinting it', () => {
    expect(prompt).toMatch(/app draws every chart, spread and table you receive/);
    expect(prompt).toMatch(/Never reprint the positions the person can already see/);
  });
});
