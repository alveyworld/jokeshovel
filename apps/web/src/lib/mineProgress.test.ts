import { describe, expect, it } from 'vitest';
import { stepStatuses, type MineProgress } from './mineProgress';

const empty: MineProgress = {
  hasTarget: false,
  connector: '',
  reinterpretationCount: 0,
  hasChoice: false,
  secondStory: '',
  punch: '',
  completed: false,
};

describe('stepStatuses', () => {
  it('starts with the current step and everything else to do', () => {
    expect(stepStatuses(empty, 'target')).toEqual({
      target: 'current',
      connector: 'todo',
      reinterpretations: 'todo',
      choose: 'todo',
      second_story: 'todo',
      punch: 'todo',
      review: 'todo',
    });
  });

  it('marks finished steps done', () => {
    const s = stepStatuses({ ...empty, hasTarget: true, connector: 'my flight' }, 'reinterpretations');
    expect(s.target).toBe('done');
    expect(s.connector).toBe('done');
    expect(s.reinterpretations).toBe('current');
  });

  it('marks earlier unfinished steps as skipped when the user jumped ahead', () => {
    const s = stepStatuses({ ...empty, punch: 'So I flew it myself.' }, 'connector');
    expect(s.target).toBe('skipped');
    expect(s.connector).toBe('current');
    expect(s.choose).toBe('skipped');
    expect(s.punch).toBe('done');
  });

  it('ignores whitespace-only text', () => {
    expect(stepStatuses({ ...empty, connector: '   ' }, 'target').connector).toBe('todo');
  });
});
