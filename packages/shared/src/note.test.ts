import { describe, expect, it } from 'vitest';
import { keepTitle, keywordCandidates, suggestKeepTitle, uniqueTitle } from './keywords';
import { DEFAULT_INCLUDE, formatNoteBody, formatNoteDate, isTimeZone, noteText, parseInclude } from './note';

const FIXTURE = {
  setup: 'My flight had a six-hour layover.',
  topic: 'Airports',
  connector: 'my flight',
  associations: [{ text: 'layover' }],
};

describe('Keep titles (AC-21)', () => {
  it('suggests "Airports — Flight Layover — Joke" for the design fixture', () => {
    expect(suggestKeepTitle(FIXTURE)).toBe('Airports — Flight Layover — Joke');
  });

  it('offers every candidate as a chip, in setup order, with the design scores', () => {
    expect(keywordCandidates(FIXTURE).map((c) => [c.word, c.score])).toEqual([
      ['Flight', 4],
      ['Six-Hour', 1],
      ['Layover', 3],
    ]);
  });

  it('rebuilds the title from the chosen chips', () => {
    expect(keepTitle('Airports', ['Flight', 'Six-Hour', 'Layover'])).toBe('Airports — Flight Six-Hour Layover — Joke');
    expect(keepTitle('Airports', [])).toBe('Airports — Joke');
    expect(keepTitle('', [])).toBe('Untitled — Joke');
  });

  it('keeps the whole title to 80 characters, " — Joke" included', () => {
    const title = keepTitle('A topic with a really very long name about airports', ['Supercalifragilistic', 'Layover']);
    expect(title.length).toBeLessThanOrEqual(80);
    expect(title.endsWith('… — Joke')).toBe(true);
  });

  it('numbers a title that is already taken, before " — Joke"', () => {
    const taken = ['Airports — Flight Layover — Joke', 'airports — flight layover #2 — joke'];
    expect(uniqueTitle('Airports — Flight Layover — Joke', taken)).toBe('Airports — Flight Layover #3 — Joke');
    expect(uniqueTitle('Airports — Security — Joke', taken)).toBe('Airports — Security — Joke');
    expect(uniqueTitle('Pilot bit', ['Pilot bit'])).toBe('Pilot bit #2');
  });
});

const JOKE = {
  id: '7f3c0000-0000-4000-8000-000000000000',
  setup_text: 'My flight had a six-hour layover.',
  punch_text: 'So I just sat in the cockpit doing loop-de-loops on the tarmac.',
  target_assumption_text: 'I’m a passenger.',
  connector_text: 'my flight',
  reinterpretation_text: 'the flight I’m piloting',
  second_story_text: 'I’m the pilot, stuck waiting with a plane full of fuel.',
  completed_at: '2026-10-27T18:00:00Z',
};
const BASE = { topicTitle: 'Airports', appBaseUrl: 'https://jokeshovel.app/', timeZone: 'America/Chicago' };
const ALL = { target: true, connectorAndReinterpretation: true, secondStory: true, dateAndLink: true };

describe('note body (AC-24)', () => {
  it('matches the design example with every section checked', () => {
    expect(formatNoteBody(JOKE, { ...BASE, include: ALL })).toBe(
      [
        'My flight had a six-hour layover.',
        'So I just sat in the cockpit doing loop-de-loops on the tarmac.',
        '',
        '— How I dug it —',
        'Target assumption: I’m a passenger.',
        'Connector: “my flight”',
        'Reinterpretation: the flight I’m piloting',
        'Second story: I’m the pilot, stuck waiting with a plane full of fuel.',
        '',
        'Topic: Airports · Written Oct 27, 2026',
        'Open in The Joke Shovel: https://jokeshovel.app/j/7f3c0000-0000-4000-8000-000000000000',
      ].join('\n'),
    );
  });

  it('defaults to the setup, punch, date and link only', () => {
    const body = formatNoteBody(JOKE, { ...BASE, include: DEFAULT_INCLUDE });
    expect(body).not.toContain('How I dug it');
    expect(body.split('\n\n')).toHaveLength(2);
    expect(body).toContain('Open in The Joke Shovel:');
  });

  it('includes exactly the checked sections, in the documented order', () => {
    const body = formatNoteBody(JOKE, { ...BASE, include: { ...DEFAULT_INCLUDE, secondStory: true, target: true } });
    const dig = body.split('\n\n')[1].split('\n');
    expect(dig).toEqual([
      '— How I dug it —',
      'Target assumption: I’m a passenger.',
      expect.stringMatching(/^Second story:/),
    ]);
  });

  it('leaves out empty sections, and the heading when nothing is left', () => {
    const bare = {
      ...JOKE,
      target_assumption_text: '',
      connector_text: ' ',
      reinterpretation_text: '',
      second_story_text: '',
    };
    expect(formatNoteBody(bare, { ...BASE, include: ALL })).not.toContain('How I dug it');
  });

  it('can leave out the date and link', () => {
    const body = formatNoteBody(JOKE, { ...BASE, include: { ...DEFAULT_INCLUDE, dateAndLink: false } });
    expect(body).toBe(`${JOKE.setup_text}\n${JOKE.punch_text}`);
  });

  it('dates the note in the writer’s time zone', () => {
    expect(formatNoteDate('2026-10-28T03:00:00Z', 'America/Los_Angeles')).toBe('Oct 27, 2026');
    expect(formatNoteDate('2026-10-28T03:00:00Z', 'Not/AZone')).toBe('Oct 28, 2026');
    expect(isTimeZone('Europe/London')).toBe(true);
    expect(isTimeZone('Not/AZone')).toBe(false);
  });

  it('puts the title above the body for copying', () => {
    expect(noteText(' T ', 'B')).toBe('T\n\nB');
  });

  it('reads include options from untrusted input', () => {
    expect(parseInclude({ target: true, secondStory: 'yes' })).toEqual({ ...DEFAULT_INCLUDE, target: true });
    expect(parseInclude(null)).toEqual(DEFAULT_INCLUDE);
  });
});
