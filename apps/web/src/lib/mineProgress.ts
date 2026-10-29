import { MINE_STEPS, type MineStepKey } from '@jokeshovel/shared';

export interface MineProgress {
  hasTarget: boolean;
  connector: string;
  reinterpretationCount: number;
  hasChoice: boolean;
  secondStory: string;
  punch: string;
  completed: boolean;
}

export type StepStatus = 'done' | 'current' | 'skipped' | 'todo';

export function stepDone(key: MineStepKey, p: MineProgress): boolean {
  switch (key) {
    case 'target':
      return p.hasTarget;
    case 'connector':
      return p.connector.trim().length > 0;
    case 'reinterpretations':
      return p.reinterpretationCount > 0;
    case 'choose':
      return p.hasChoice;
    case 'second_story':
      return p.secondStory.trim().length > 0;
    case 'punch':
      return p.punch.trim().length > 0;
    case 'review':
      return p.completed;
  }
}

/**
 * Status of every step for the stepper. Steps can be done in any order; a
 * step is "skipped" when a later one has been done but it hasn't.
 */
export function stepStatuses(p: MineProgress, current: MineStepKey): Record<MineStepKey, StepStatus> {
  const done = MINE_STEPS.map((s) => stepDone(s.key, p));
  const lastDone = done.lastIndexOf(true);
  return Object.fromEntries(
    MINE_STEPS.map((s, i) => {
      if (s.key === current) return [s.key, 'current'];
      if (done[i]) return [s.key, 'done'];
      return [s.key, i < lastDone ? 'skipped' : 'todo'];
    }),
  ) as Record<MineStepKey, StepStatus>;
}
