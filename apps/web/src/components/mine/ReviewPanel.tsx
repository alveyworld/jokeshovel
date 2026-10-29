import { LIMITS, suggestTitle } from '@jokeshovel/shared';
import { useId, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAssociations, useAttemptJoke, useCompleteAttempt, useTopic } from '../../data/hooks';
import { useToast } from '../Toasts';
import type { PanelProps } from './Panels';

/** Step 12: read the joke whole, name it, and mark it complete. */
export function ReviewPanel({ attempt, setup, target, chosen }: PanelProps) {
  const { topic } = useTopic(attempt.topic_id);
  const { associations } = useAssociations(attempt.topic_id);
  const { data: joke } = useAttemptJoke(attempt.id);
  const complete = useCompleteAttempt();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const titleId = useId();
  const [customTitle, setCustomTitle] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setupText = setup?.text.trim() ?? '';
  const punch = attempt.punch.trim();
  const suggested = suggestTitle({
    setup: setupText,
    topic: topic?.title ?? '',
    connector: attempt.connector,
    associations,
  });
  const title = customTitle ?? suggested;
  const missing = !setupText ? 'setup' : !punch ? 'punch' : null;
  const completed = attempt.status === 'completed';

  const onComplete = async () => {
    setBusy(true);
    setError(null);
    const result = await complete(attempt.id, title);
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    showToast({ message: `Nugget! “${result.joke.title || 'Your joke'}” is in your jokes.` });
    navigate(`/j/${result.joke.id}`);
  };

  return (
    <div className="panel">
      <figure className="joke-card joke-card--review">
        <figcaption className="visually-hidden">Your joke</figcaption>
        <p className="joke-card__setup">{setupText || 'No setup yet.'}</p>
        <p className="joke-card__punchline">{punch || 'No punch yet.'}</p>
      </figure>

      <details className="panel__reference">
        <summary>How you dug it</summary>
        <dl className="dig-path">
          <dt>Target</dt>
          <dd>{target?.text || '—'}</dd>
          <dt>Connector</dt>
          <dd>{attempt.connector.trim() || '—'}</dd>
          <dt>Reinterpretation</dt>
          <dd>{chosen?.text || '—'}</dd>
          <dt>Second story</dt>
          <dd>{attempt.second_story.trim() || '—'}</dd>
        </dl>
      </details>

      {completed ? (
        <p className="notice" role="status">
          This joke is complete.{' '}
          {joke ? <Link to={`/j/${joke.id}`}>Open the joke card</Link> : <Link to="/jokes">See your jokes</Link>}
        </p>
      ) : (
        <div className="complete-form">
          <div className="field">
            <label htmlFor={titleId} className="field__label">
              Title
            </label>
            <input
              id={titleId}
              type="text"
              value={title}
              maxLength={LIMITS.jokeTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              aria-describedby={`${titleId}-hint`}
            />
            <p id={`${titleId}-hint`} className="field__hint">
              Suggested from the topic and the setup’s key words. Change it to anything.
              {customTitle !== null && customTitle !== suggested ? (
                <>
                  {' '}
                  <button type="button" className="btn btn--ghost btn--small" onClick={() => setCustomTitle(null)}>
                    Reset to suggestion
                  </button>
                </>
              ) : null}
            </p>
          </div>

          {missing ? (
            <p className="notice" id={`${titleId}-missing`}>
              {missing === 'setup' ? (
                <>
                  Write a setup first: <Link to={`/s/${attempt.setup_id}`}>edit the setup</Link>.
                </>
              ) : (
                <>
                  Write a punch first: <Link to={`/a/${attempt.id}/punch`}>go to the punch</Link>.
                </>
              )}
            </p>
          ) : null}
          {error ? (
            <p className="field__error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="button-row">
            <button
              type="button"
              className="btn btn--primary btn--large"
              disabled={Boolean(missing) || busy}
              aria-describedby={missing ? `${titleId}-missing` : undefined}
              onClick={onComplete}
            >
              {busy ? 'Saving…' : 'Mark as complete'}
            </button>
            <Link to={`/a/${attempt.id}/punch`} className="btn">
              Keep digging
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
