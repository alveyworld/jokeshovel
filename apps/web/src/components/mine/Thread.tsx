import type { MineStepKey } from '@jokeshovel/shared';
import { useState } from 'react';
import { Link } from 'react-router';

interface Entry {
  step: MineStepKey | null;
  label: string;
  value: string | null | undefined;
}

/** "The thread so far": every decision in the dig, each linking back to its step. */
export function Thread({ attemptId, entries }: { attemptId: string; entries: Entry[] }) {
  // Open by default on wide screens, where it sits beside the step.
  const [open] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.('(min-width: 1024px)').matches);
  return (
    <details className="thread" open={open}>
      <summary>The thread so far</summary>
      <dl>
        {entries.map((e) => (
          <div key={e.label} className="thread__row">
            <dt>{e.step ? <Link to={`/a/${attemptId}/${e.step}`}>{e.label}</Link> : e.label}</dt>
            <dd className={e.value?.trim() ? '' : 'thread__empty'}>{e.value?.trim() || '—'}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
