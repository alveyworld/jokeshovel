import { MINE_STEPS, type MineStepKey } from '@jokeshovel/shared';
import { Link } from 'react-router';
import type { StepStatus } from '../../lib/mineProgress';

const STATUS_TEXT: Record<StepStatus, string> = {
  done: 'done',
  current: 'current step',
  skipped: 'skipped',
  todo: 'not started',
};

/** The Joke Mine steps as links: any step can be visited at any time. */
export function Stepper({ attemptId, statuses }: { attemptId: string; statuses: Record<MineStepKey, StepStatus> }) {
  return (
    <nav aria-label="Joke Mine steps" className="stepper">
      <ol>
        {MINE_STEPS.map((step) => {
          const status = statuses[step.key];
          return (
            <li key={step.key} className={`stepper__item is-${status}`}>
              <Link
                to={`/a/${attemptId}/${step.key}`}
                className="stepper__link"
                aria-current={status === 'current' ? 'step' : undefined}
              >
                <span className="stepper__dot" aria-hidden="true">
                  {status === 'done' ? '✓' : step.number}
                </span>
                <span className="stepper__label">{step.label}</span>
                <span className="visually-hidden">, {STATUS_TEXT[status]}</span>
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
