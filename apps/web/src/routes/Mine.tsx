import { MINE_STEPS, isMineStep, type JokeAttempt, type MineStepKey } from '@jokeshovel/shared';
import { useEffect } from 'react';
import { Link, Navigate, NavLink, useParams } from 'react-router';
import {
  ChoosePanel,
  ConnectorPanel,
  PunchPanel,
  ReinterpretationsPanel,
  SecondStoryPanel,
  TargetPanel,
} from '../components/mine/Panels';
import { ReviewPanel } from '../components/mine/ReviewPanel';
import { Stepper } from '../components/mine/Stepper';
import { Thread } from '../components/mine/Thread';
import { useAssumptions, useAttempt, useMutations, useReinterpretations, useSetup, useTopic } from '../data/hooks';
import { useRememberLocation } from '../data/useRememberLocation';
import { stepStatuses } from '../lib/mineProgress';
import { excerpt } from '../lib/text';

const PANELS = {
  target: TargetPanel,
  connector: ConnectorPanel,
  reinterpretations: ReinterpretationsPanel,
  choose: ChoosePanel,
  second_story: SecondStoryPanel,
  punch: PunchPanel,
  review: ReviewPanel,
} as const;

export function Mine() {
  const { attemptId = '', step } = useParams();
  const { attempt, isPending } = useAttempt(attemptId);

  if (!attempt) {
    return isPending ? (
      <p className="page" role="status">
        Loading…
      </p>
    ) : (
      <div className="page">
        <h1 className="page__title">Joke attempt not found</h1>
        <p>It may have been deleted.</p>
      </div>
    );
  }
  if (!isMineStep(step)) {
    const resume = isMineStep(attempt.current_step) ? attempt.current_step : 'target';
    return <Navigate to={`/a/${attempt.id}/${resume}`} replace />;
  }
  return <MineBody attempt={attempt} step={step} />;
}

function MineBody({ attempt, step }: { attempt: JokeAttempt; step: MineStepKey }) {
  const { setup } = useSetup(attempt.setup_id);
  const { topic } = useTopic(attempt.topic_id);
  const { assumptions } = useAssumptions(attempt.setup_id);
  const { reinterpretations } = useReinterpretations(attempt.id);
  const { enterStep } = useMutations();

  // Remember where the user is, for Resume and the Drafts list.
  useEffect(() => {
    if (attempt.current_step !== step) enterStep(attempt.id, step);
    // Only when the step changes; current_step itself follows this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt.id, step, enterStep]);

  const index = MINE_STEPS.findIndex((s) => s.key === step);
  const def = MINE_STEPS[index];
  const prev = MINE_STEPS[index - 1];
  const next = MINE_STEPS[index + 1];
  useRememberLocation(`${topic?.title ?? 'Topic'} › ${excerpt(setup?.text ?? '', 30) || 'Setup'} · ${def.label}`);

  // A deleted assumption or reinterpretation no longer counts as chosen.
  const target = assumptions.find((a) => a.id === attempt.target_assumption_id) ?? null;
  const chosen = reinterpretations.find((r) => r.id === attempt.selected_reinterpretation_id) ?? null;
  const statuses = stepStatuses(
    {
      hasTarget: Boolean(target),
      connector: attempt.connector,
      reinterpretationCount: reinterpretations.length,
      hasChoice: Boolean(chosen),
      secondStory: attempt.second_story,
      punch: attempt.punch,
      completed: attempt.status === 'completed',
    },
    step,
  );

  const Panel = PANELS[step];

  return (
    <div className="page page--wide">
      <nav aria-label="Breadcrumb" className="breadcrumb">
        <NavLink to="/topics">Topics</NavLink> <span aria-hidden="true">›</span>{' '}
        <NavLink to={`/topics/${attempt.topic_id}/setups`}>{topic?.title || 'Topic'}</NavLink>{' '}
        <span aria-hidden="true">›</span> <NavLink to={`/s/${attempt.setup_id}`}>Setup</NavLink>{' '}
        <span aria-hidden="true">›</span> <span aria-current="page">Joke Mine</span>
      </nav>

      <header className="mine-head">
        <p className="mine-head__eyebrow">Joke Mine · Step {def.number} of 12</p>
        <h1 className="page__title">{def.heading}</h1>
      </header>

      <Stepper attemptId={attempt.id} statuses={statuses} />

      <div className="mine-layout">
        <section className="mine-panel" aria-label={def.label}>
          <p className="workspace__intro">{def.help}</p>
          <Panel
            attempt={attempt}
            setup={setup}
            assumptions={assumptions}
            reinterpretations={reinterpretations}
            target={target}
            chosen={chosen}
          />
        </section>
        <Thread
          attemptId={attempt.id}
          entries={[
            { step: null, label: 'Setup', value: setup?.text },
            { step: 'target', label: 'Target', value: target?.text },
            { step: 'connector', label: 'Connector', value: attempt.connector },
            { step: 'choose', label: 'Reinterpretation', value: chosen?.text },
            { step: 'second_story', label: 'Second story', value: attempt.second_story },
            { step: 'punch', label: 'Punch', value: attempt.punch },
          ]}
        />
      </div>

      <nav className="mine-footer" aria-label="Step navigation">
        {prev ? (
          <Link to={`/a/${attempt.id}/${prev.key}`} className="btn">
            <span aria-hidden="true">‹</span> {prev.label}
          </Link>
        ) : (
          <Link to={`/s/${attempt.setup_id}`} className="btn">
            <span aria-hidden="true">‹</span> Setup
          </Link>
        )}
        {next ? (
          <Link to={`/a/${attempt.id}/${next.key}`} className="btn btn--primary">
            Next: {next.label} <span aria-hidden="true">›</span>
          </Link>
        ) : (
          <Link to={`/s/${attempt.setup_id}`} className="btn">
            Back to the setup <span aria-hidden="true">›</span>
          </Link>
        )}
      </nav>
    </div>
  );
}
