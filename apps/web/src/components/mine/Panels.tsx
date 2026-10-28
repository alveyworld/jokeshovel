import { LIMITS, type Assumption, type JokeAttempt, type Reinterpretation, type Setup } from '@jokeshovel/shared';
import { useId, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { useMutations } from '../../data/hooks';
import { wordCount } from '../../lib/text';
import { AutosaveField } from '../AutosaveField';
import { BrainstormList } from '../BrainstormList';
import { useToast } from '../Toasts';
import { WordChips } from './WordChips';

interface PanelProps {
  attempt: JokeAttempt;
  setup: Setup | null;
  assumptions: readonly Assumption[];
  reinterpretations: readonly Reinterpretation[];
  target: Assumption | null;
  chosen: Reinterpretation | null;
}

const quote = (text: string | null | undefined, fallback: string) => (text?.trim() ? `“${text.trim()}”` : fallback);

/** Step 6: pick the assumption the joke will break. */
export function TargetPanel({ attempt, setup, assumptions, target }: PanelProps) {
  const { update, createAssumption } = useMutations();
  const id = useId();
  const [draft, setDraft] = useState('');

  const add = (e: FormEvent) => {
    e.preventDefault();
    if (!draft.trim() || !setup) return;
    const assumptionId = createAssumption(setup.id, draft, assumptions);
    // A new assumption is usually the one you want to target.
    if (!target) update('joke_attempts', attempt.id, { target_assumption_id: assumptionId });
    setDraft('');
  };

  return (
    <div className="panel">
      {assumptions.length ? (
        <fieldset className="radio-cards">
          <legend className="field__label">Which assumption will your joke break?</legend>
          {assumptions.map((a) => (
            <label key={a.id} className={`radio-card ${target?.id === a.id ? 'is-selected' : ''}`}>
              <input
                type="radio"
                name={`target-${attempt.id}`}
                value={a.id}
                checked={target?.id === a.id}
                onChange={() => update('joke_attempts', attempt.id, { target_assumption_id: a.id })}
              />
              <span>{a.text}</span>
            </label>
          ))}
        </fieldset>
      ) : (
        <p className="notice">
          This setup has no assumptions yet. Add one below, or list several on the{' '}
          <Link to={`/s/${attempt.setup_id}`}>setup page</Link>.
        </p>
      )}

      <form className="inline-form" onSubmit={add}>
        <label htmlFor={id} className="field__label">
          Add an assumption
        </label>
        <div className="inline-form__row">
          <input
            id={id}
            type="text"
            value={draft}
            maxLength={LIMITS.assumption}
            placeholder="What else does the audience take for granted?"
            autoComplete="off"
            onChange={(e) => setDraft(e.target.value)}
          />
          <button type="submit" className="btn">
            Add
          </button>
        </div>
      </form>
    </div>
  );
}

/** Step 7: the word or phrase the target depends on. */
export function ConnectorPanel({ attempt, setup, target }: PanelProps) {
  const { update } = useMutations();
  return (
    <div className="panel">
      {target ? (
        <p className="panel__context">
          Target: <strong>{target.text}</strong>
        </p>
      ) : null}
      {setup?.text.trim() ? (
        <div className="field">
          <p className="field__label" id={`words-${attempt.id}`}>
            Tap the words in your setup that create that belief
          </p>
          <WordChips
            setup={setup.text}
            connector={attempt.connector}
            onChange={(connector) => update('joke_attempts', attempt.id, { connector })}
          />
        </div>
      ) : null}
      <AutosaveField
        table="joke_attempts"
        rowId={attempt.id}
        field="connector"
        value={attempt.connector}
        label="Connector"
        maxLength={LIMITS.connector}
        placeholder="e.g. my flight"
      />
      <AutosaveField
        table="joke_attempts"
        rowId={attempt.id}
        field="connector_note"
        value={attempt.connector_note}
        label="Why this connector? (optional)"
        multiline
        rows={2}
        maxLength={LIMITS.connectorNote}
      />
    </div>
  );
}

/** Step 8: brainstorm other readings of the connector. */
export function ReinterpretationsPanel({ attempt, reinterpretations }: PanelProps) {
  const { createReinterpretation, update, softDelete, restore } = useMutations();
  const { showToast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="panel">
      {attempt.connector.trim() ? (
        <p className="panel__question">What else could {quote(attempt.connector, '')} mean?</p>
      ) : (
        <p className="notice">
          Tip: <Link to={`/a/${attempt.id}/connector`}>name the connector</Link> first, so you know what you’re
          reinterpreting.
        </p>
      )}
      <BrainstormList
        table="reinterpretations"
        items={reinterpretations}
        maxLength={LIMITS.reinterpretation}
        inputLabel="New reinterpretation"
        placeholder="Another way to read it…"
        listLabel={(n) => `${n} reinterpretations`}
        itemLabel={(i) => `Reinterpretation ${i + 1}`}
        emptyText="Nothing yet. Aim for quantity: the odd ones are often the funny ones."
        onAdd={(text) => createReinterpretation(attempt.id, text, reinterpretations)}
        onToggleStar={(r) => update('reinterpretations', r.id, { is_starred: !r.is_starred })}
        onDelete={(r) => {
          softDelete('reinterpretations', r.id);
          showToast({
            message: `Deleted “${r.text}”.`,
            actionLabel: 'Undo',
            onAction: () => restore('reinterpretations', r.id),
          });
        }}
        inputRef={inputRef}
        autoFocus
      />
    </div>
  );
}

/** Step 9: pick one reinterpretation; the others stay saved. */
export function ChoosePanel({ attempt, reinterpretations, chosen }: PanelProps) {
  const { update } = useMutations();
  const [changedFrom, setChangedFrom] = useState<string | null>(null);

  if (!reinterpretations.length) {
    return (
      <p className="notice">
        There’s nothing to choose from yet. <Link to={`/a/${attempt.id}/reinterpretations`}>Brainstorm some</Link>{' '}
        first.
      </p>
    );
  }

  const choose = (r: Reinterpretation) => {
    // Later steps were written for the old choice: flag them, never change them.
    if (chosen && chosen.id !== r.id && (attempt.second_story.trim() || attempt.punch.trim())) {
      setChangedFrom(chosen.text);
    }
    update('joke_attempts', attempt.id, { selected_reinterpretation_id: r.id });
  };

  const starredFirst = [...reinterpretations].sort((a, b) => Number(b.is_starred) - Number(a.is_starred));

  return (
    <div className="panel">
      {changedFrom ? (
        <p className="notice" role="status">
          Your second story was written for “{changedFrom}”.{' '}
          <Link to={`/a/${attempt.id}/second_story`}>Review it?</Link>
        </p>
      ) : null}
      <fieldset className="radio-cards">
        <legend className="field__label">Which reading surprises you most?</legend>
        {starredFirst.map((r) => (
          <label key={r.id} className={`radio-card ${chosen?.id === r.id ? 'is-selected' : ''}`}>
            <input
              type="radio"
              name={`choice-${attempt.id}`}
              value={r.id}
              checked={chosen?.id === r.id}
              onChange={() => choose(r)}
            />
            <span>
              {r.is_starred ? <span aria-label="Starred">★ </span> : null}
              {r.text}
            </span>
          </label>
        ))}
      </fieldset>
    </div>
  );
}

/** Step 10: the situation in which the chosen reading is true. */
export function SecondStoryPanel({ attempt, chosen }: PanelProps) {
  return (
    <div className="panel">
      <AutosaveField
        table="joke_attempts"
        rowId={attempt.id}
        field="second_story"
        value={attempt.second_story}
        label="Second story"
        hint={
          chosen
            ? `In what situation would ${quote(chosen.text, '')} be true? Describe it.`
            : 'Choose a reinterpretation first, then describe the situation in which it is true.'
        }
        multiline
        rows={5}
        maxLength={LIMITS.secondStory}
      />
    </div>
  );
}

/** Step 11: reveal the second story, right under the setup. */
export function PunchPanel({ attempt, setup }: PanelProps) {
  const words = wordCount(attempt.punch);
  return (
    <div className="panel">
      <figure className="joke-card">
        <figcaption className="field__label">Setup</figcaption>
        <p className="joke-card__setup">{setup?.text.trim() || 'Your setup is empty.'}</p>
      </figure>
      <AutosaveField
        table="joke_attempts"
        rowId={attempt.id}
        field="punch"
        value={attempt.punch}
        label="Punch"
        hint="Can you reveal the second story in fewer words? Put the surprise last."
        multiline
        rows={3}
        maxLength={LIMITS.punch}
        className="joke-card__punch"
      />
      <p className="field__hint">
        {words} {words === 1 ? 'word' : 'words'}
      </p>
      {attempt.second_story.trim() ? (
        <details className="panel__reference">
          <summary>Your second story</summary>
          <p>{attempt.second_story}</p>
        </details>
      ) : null}
    </div>
  );
}
