import { describe, expect, it } from 'vitest';
import { sameTitle, topicTitleFromText } from './text';

describe('topicTitleFromText', () => {
  it('uses short text as it is, tidying spaces', () => {
    expect(topicTitleFromText('  TSA   lines ', 120)).toBe('TSA lines');
  });

  it('keeps text that is exactly the limit', () => {
    const text = 'a'.repeat(120);
    expect(topicTitleFromText(text, 120)).toBe(text);
  });

  it('cuts long text at the last whole word that fits', () => {
    expect(topicTitleFromText('the guy who reclines his seat all the way back', 20)).toBe('the guy who reclines');
    expect(topicTitleFromText('the guy who reclines his seat', 22)).toBe('the guy who reclines');
  });

  it('keeps the last word when the limit falls right after it', () => {
    expect(topicTitleFromText('one two three', 7)).toBe('one two');
  });

  it('drops trailing punctuation left by the cut', () => {
    expect(topicTitleFromText('layovers, delays, and lost bags', 18)).toBe('layovers, delays');
  });

  it('cuts a single very long word at the limit', () => {
    expect(topicTitleFromText('x'.repeat(130), 120)).toHaveLength(120);
  });

  it('never returns more than the limit', () => {
    const text = 'word '.repeat(60);
    expect(topicTitleFromText(text, 120).length).toBeLessThanOrEqual(120);
  });
});

describe('sameTitle', () => {
  it('ignores case and extra spaces', () => {
    expect(sameTitle('TSA  Lines', ' tsa lines')).toBe(true);
    expect(sameTitle('TSA', 'TSA lines')).toBe(false);
  });
});
