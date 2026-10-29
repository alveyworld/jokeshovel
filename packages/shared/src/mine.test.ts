import { describe, expect, it } from 'vitest';
import { isMineStep, selectedWordIndexes, setupWords, toggleConnectorWord } from './mine';

const words = setupWords('My flight had a six-hour layover, and I’m fine.');

describe('setupWords', () => {
  it('keeps hyphens and apostrophes, drops punctuation', () => {
    expect(words).toEqual(['My', 'flight', 'had', 'a', 'six-hour', 'layover', 'and', 'I’m', 'fine']);
  });
});

describe('connector word chips', () => {
  it('adds words in setup order regardless of tap order', () => {
    let connector = toggleConnectorWord(words, '', 1);
    connector = toggleConnectorWord(words, connector, 0);
    expect(connector).toBe('My flight');
  });

  it('removes a word when tapped again', () => {
    expect(toggleConnectorWord(words, 'My flight', 0)).toBe('flight');
  });

  it('reads the selection back from typed text, case-insensitively', () => {
    expect([...selectedWordIndexes(words, 'my FLIGHT')]).toEqual([0, 1]);
  });

  it('matches repeated words to successive occurrences', () => {
    const w = setupWords('the cat and the hat');
    expect([...selectedWordIndexes(w, 'the hat')]).toEqual([0, 4]);
    expect([...selectedWordIndexes(w, 'the the')]).toEqual([0, 3]);
  });

  it('ignores typed words that are not in the setup', () => {
    expect([...selectedWordIndexes(words, 'my plane')]).toEqual([0]);
  });
});

describe('isMineStep', () => {
  it('recognises step keys', () => {
    expect(isMineStep('connector')).toBe(true);
    expect(isMineStep('review')).toBe(true);
    expect(isMineStep('publish')).toBe(false);
    expect(isMineStep(undefined)).toBe(false);
  });
});
