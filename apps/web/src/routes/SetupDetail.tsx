import {
  ASSUMPTION_PROMPTS,
  LIMITS,
  MINE_STEPS,
  type Assumption,
  type JokeAttempt,
  type Setup,
} from '@jokeshovel/shared';
import { useRef, useState } from 'react';
import { Link, NavLink, useNavigate, useParams } from 'react-router';
import { AutosaveField } from '../components/AutosaveField';
import { BrainstormList } from '../components/BrainstormList';
import { useToast } from '../components/Toasts';
import { useAssumptions, useAttempts, useMutations, useSetup, useTopic } from '../data/hooks';
import { useRememberLocation } from '../data/useRememberLocation';
import { excerpt } from '../lib/text';
import { relativeTime } from '../lib/time';

export function SetupDetail() {
  const { setupId = '' } = useParams();
  const { setup, isPending } = useSetup(setupId);
  if (!setup) {
    return isPending ? (
      <p className="page" role="status">
        Loading…
      </p>
    ) : (
      <div className="page">
        <h1 className="page__title">Setup not found</h1>
        <p>It may have been deleted.</p>
      </div>
    );
  }
  return <SetupDetailBody setup={setup} />;
}

function stepLabel(step: JokeAttempt['current_step']) {
  const s = MINE_STEPS.find((m) => m.key === step);
  return s ? `Step ${s.number} · ${s.label}` : 'Review';
}

function SetupDetailBody({ setup }: { setup: Setup }) {
  const { topic } = useTopic(setup.topic_id);
  const { assumptions } = useAssumptions(setup.id);
  const { attempts } = useAttempts(setup.id);
  const { createAssumption, createAttempt, softDelete, restore } = useMutations();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [prompt, setPrompt] = useState<string>(ASSUMPTION_PROMPTS[0].question);
  useRememberLocation(`${topic?.title ?? 'Topic'} › ${excerpt(setup.text, 40) || 'Untitled setup'}`);

  const liveTargets = new Set(assumptions.map((a) => a.id));
  const targetText = (attempt: JokeAttempt) =>
    attempt.target_assumption_id && liveTargets.has(attempt.target_assumption_id)
      ? assumptions.find((a) => a.id === attempt.target_assumption_id)?.text
      : null;

  const removeAssumption = (a: Assumption) => {
    softDelete('assumptions', a.id);
    showToast({ message: `Deleted “${a.text}”.`, actionLabel: 'Undo', onAction: () => restore('assumptions', a.id) });
  };

  const removeAttempt = (attempt: JokeAttempt) => {
    softDelete('joke_attempts', attempt.id);
    showToast({
      message: 'Deleted joke attempt.',
      actionLabel: 'Undo',
      onAction: () => restore('joke_attempts', attempt.id),
    });
  };

  const start = () => {
    const id = createAttempt(setup);
    navigate(`/a/${id}/target`);
  };

  return (
    <div className="page">
      <nav aria-label="Breadcrumb" className="breadcrumb">
        <NavLink to="/topics">Topics</NavLink> <span aria-hidden="true">›</span>{' '}
        <NavLink to={`/topics/${setup.topic_id}/setups`}>{topic?.title || 'Topic'}</NavLink>{' '}
        <span aria-hidden="true">›</span> <span aria-current="page">Setup</span>
      </nav>

      <h1 className="page__title">Mine this setup</h1>
      <AutosaveField
        table="setups"
        rowId={setup.id}
        field="text"
        value={setup.text}
        label="Setup"
        multiline
        rows={2}
        maxLength={LIMITS.setup}
        placeholder="A believable sentence or two that sets the scene…"
      />

      <section className="workspace" aria-labelledby="assumptions-heading">
        <h2 id="assumptions-heading">Assumptions</h2>
        <p className="workspace__intro">
          After hearing your setup, what does the audience take for granted without being told? List as many as you can.
          Each one could be broken by a different joke.
        </p>
        <div className="prompt-chips" role="group" aria-label="Question prompts">
          {ASSUMPTION_PROMPTS.map((p) => (
            <button
              key={p.label}
              type="button"
              className={`chip-btn ${prompt === p.question ? 'is-selected' : ''}`}
              aria-pressed={prompt === p.question}
              onClick={() => {
                setPrompt(p.question);
                inputRef.current?.focus();
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
        <BrainstormList
          table="assumptions"
          items={assumptions}
          maxLength={LIMITS.assumption}
          inputLabel="New assumption"
          placeholder={prompt}
          listLabel={(n) => `${n} assumptions`}
          itemLabel={(i) => `Assumption ${i + 1}`}
          emptyText="No assumptions yet. Use the question prompts above if you’re stuck."
          onAdd={(text) => createAssumption(setup.id, text, assumptions)}
          onDelete={removeAssumption}
          inputRef={inputRef}
        />
      </section>

      <section className="workspace" aria-labelledby="attempts-heading">
        <h2 id="attempts-heading">Joke attempts</h2>
        <p className="workspace__intro">
          Each attempt breaks one assumption. Start another to try a different target on the same setup.
        </p>
        {attempts.length ? (
          <ul className="card-list" aria-label={`${attempts.length} joke attempts`}>
            {attempts.map((attempt, i) => (
              <li key={attempt.id} className="card attempt-card">
                <Link to={`/a/${attempt.id}/${attempt.current_step}`} className="attempt-card__link">
                  <span className="card__title">Attempt {i + 1}</span>
                  <span className="card__desc">
                    {targetText(attempt) ? `Target: ${targetText(attempt)}` : 'No target chosen yet'}
                  </span>
                  <span className="card__meta">
                    {stepLabel(attempt.current_step)} · {relativeTime(attempt.updated_at)}
                  </span>
                </Link>
                <button
                  type="button"
                  className="icon-btn icon-btn--danger"
                  aria-label={`Delete attempt ${i + 1}`}
                  onClick={() => removeAttempt(attempt)}
                >
                  <span aria-hidden="true">🗑</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <button type="button" className="btn btn--primary" onClick={start}>
          {attempts.length ? 'Start another attempt' : 'Start a joke attempt'}
        </button>
        {!assumptions.length ? (
          <p className="field__hint">Tip: list a few assumptions first. You’ll pick one as your target.</p>
        ) : null}
      </section>
    </div>
  );
}
