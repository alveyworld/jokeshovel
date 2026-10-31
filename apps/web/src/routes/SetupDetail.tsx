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
import { useQueryClient } from '@tanstack/react-query';
import { useOutbox } from '../data/OutboxProvider';
import { useAssumptions, useAttempts, useMutations, useSetup, useSetups, useTopic } from '../data/hooks';
import { supabase } from '../lib/supabase';
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
  const { setups } = useSetups(setup.topic_id);
  const box = useOutbox();
  const qc = useQueryClient();
  const [copying, setCopying] = useState(false);
  const parent = setup.parent_setup_id ? setups.find((s) => s.id === setup.parent_setup_id) : undefined;
  const branches = setups.filter((s) => s.parent_setup_id === setup.id);
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

  /** Branch (new wording, no assumptions) or duplicate (exact copy with assumptions), SET-3. */
  const copy = async (duplicate: boolean) => {
    setCopying(true);
    // Copy what's on screen: save queued edits first.
    if (!(await box.flushAll())) {
      setCopying(false);
      showToast({ message: 'You’re offline. Branch or duplicate once you’re back online.', tone: 'error' });
      return;
    }
    const { data, error } = await supabase.rpc('branch_setup', {
      p_setup_id: setup.id,
      p_copy_assumptions: duplicate,
    });
    setCopying(false);
    if (error || !data) {
      showToast({ message: error?.message ?? 'Couldn’t copy the setup.', tone: 'error' });
      return;
    }
    void qc.invalidateQueries({ queryKey: ['setups'] });
    void qc.invalidateQueries({ queryKey: ['topic_stats'] });
    showToast({
      message: duplicate ? 'Duplicated, with its assumptions.' : 'Branched. Change the wording to try a variation.',
    });
    navigate(`/s/${(data as Setup).id}`);
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
      <div className="setup-lineage">
        {parent ? (
          <p>
            Branch of <Link to={`/s/${parent.id}`}>“{excerpt(parent.text, 60) || 'Untitled setup'}”</Link>
          </p>
        ) : null}
        {branches.length ? (
          <p>
            {branches.length === 1 ? 'Branch' : 'Branches'}:{' '}
            {branches.map((b, i) => (
              <span key={b.id}>
                {i ? ', ' : ''}
                <Link to={`/s/${b.id}`}>“{excerpt(b.text, 40) || 'Untitled setup'}”</Link>
              </span>
            ))}
          </p>
        ) : null}
        <div className="button-row">
          <button type="button" className="btn btn--small" disabled={copying} onClick={() => copy(false)}>
            Branch
          </button>
          <button type="button" className="btn btn--small" disabled={copying} onClick={() => copy(true)}>
            Duplicate
          </button>
        </div>
        <p className="field__hint help">
          Branch to try new wording without losing this one. Duplicate copies it with its assumptions.
        </p>
      </div>

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
          <p className="field__hint help">Tip: list a few assumptions first. You’ll pick one as your target.</p>
        ) : null}
      </section>
    </div>
  );
}
