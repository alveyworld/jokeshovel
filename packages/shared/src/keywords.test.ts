import { describe, expect, it } from 'vitest';
import { setupKeywords, suggestTitle } from './keywords';

describe('setupKeywords', () => {
  it('matches the design example (AC-21): flight 4, layover 3, six-hour 1', () => {
    expect(
      setupKeywords({
        setup: 'My flight had a six-hour layover.',
        topic: 'Airports',
        connector: 'my flight',
        associations: [{ text: 'TSA' }, { text: 'layover' }, { text: 'neck pillow' }],
      }),
    ).toEqual(['Flight', 'Layover']);
  });

  it('drops stop words, numbers and words already in the topic', () => {
    expect(setupKeywords({ setup: 'I went to the dentist 3 times this week', topic: 'Dentist' })).toEqual([
      'Times',
      'Week',
    ]);
  });

  it('favours starred associations, even short words', () => {
    expect(
      setupKeywords({
        setup: 'My cousin married a guy named Kevin at the zoo.',
        topic: 'Weddings',
        associations: [{ text: 'zoo', is_starred: true }],
      }),
    ).toEqual(['Cousin', 'Zoo']);
  });

  it('favours mid-sentence capitals (probable names)', () => {
    expect(setupKeywords({ setup: 'We drove to Denver in a van', topic: 'Road trips' })).toEqual(['Drove', 'Denver']);
  });

  it('falls back to the first words when nothing is left', () => {
    expect(setupKeywords({ setup: 'It is what it is', topic: 'Life' })).toEqual(['It', 'Is', 'What', 'It']);
  });
});

describe('suggestTitle', () => {
  it('joins the topic and keywords', () => {
    expect(
      suggestTitle({
        setup: 'My flight had a six-hour layover.',
        topic: 'Airports',
        connector: 'my flight',
        associations: [{ text: 'layover' }],
      }),
    ).toBe('Airports — Flight Layover');
  });

  it('keeps titles to 80 characters', () => {
    const title = suggestTitle({ setup: 'Supercalifragilistic expialidocious', topic: 'x'.repeat(90) });
    expect(title.length).toBeLessThanOrEqual(80);
  });
});
