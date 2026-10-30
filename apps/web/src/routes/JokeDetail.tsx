import { LIMITS, type Joke } from '@jokeshovel/shared';
import { useState } from 'react';
import { Link, NavLink, useNavigate, useParams } from 'react-router';
import { AutosaveField } from '../components/AutosaveField';
import { PublishHistory } from '../components/PublishHistory';
import { PublishSheet } from '../components/PublishSheet';
import { Rating } from '../components/Rating';
import { ToggleButton } from '../components/ToggleButton';
import { useToast } from '../components/Toasts';
import { useJoke, useMutations, useTopic } from '../data/hooks';
import { sentToKeep, usePublications } from '../data/publishing';
import { useRememberLocation } from '../data/useRememberLocation';

export function JokeDetail() {
  const { jokeId = '' } = useParams();
  const { joke, isPending } = useJoke(jokeId);
  if (!joke) {
    return isPending ? (
      <p className="page" role="status">
        Loading…
      </p>
    ) : (
      <div className="page">
        <h1 className="page__title">Joke not found</h1>
        <p>It may have been deleted.</p>
        <Link to="/jokes">Back to your jokes</Link>
      </div>
    );
  }
  return <JokeDetailBody joke={joke} />;
}

const required = (what: string) => (v: string) => (v.trim() ? null : `A joke needs a ${what}.`);

function JokeDetailBody({ joke }: { joke: Joke }) {
  const { topic } = useTopic(joke.topic_id);
  const { update, softDelete, restore, setArchived } = useMutations();
  const { showToast } = useToast();
  const navigate = useNavigate();
  useRememberLocation(`Joke · ${joke.title || topic?.title || 'Untitled'}`);
  const archived = joke.status === 'archived';
  const { publications } = usePublications();
  const inKeep = sentToKeep(publications, joke.id);
  const [publishing, setPublishing] = useState(false);

  const remove = () => {
    softDelete('jokes', joke.id);
    navigate('/jokes');
    showToast({
      message: `Deleted “${joke.title || 'joke'}”.`,
      actionLabel: 'Undo',
      onAction: () => {
        restore('jokes', joke.id);
        navigate(`/j/${joke.id}`);
      },
    });
  };

  return (
    <div className="page">
      <nav aria-label="Breadcrumb" className="breadcrumb">
        <NavLink to="/jokes">Jokes</NavLink> <span aria-hidden="true">›</span>{' '}
        <span aria-current="page">{joke.title || 'Untitled joke'}</span>
      </nav>

      <AutosaveField
        table="jokes"
        rowId={joke.id}
        field="title"
        value={joke.title}
        label="Title"
        hideLabel
        maxLength={LIMITS.jokeTitle}
        placeholder="Name this joke"
        className="topic-head__title"
      />
      <p className="card__meta">
        {topic ? <Link to={`/topics/${topic.id}`}>{topic.title}</Link> : null} · Completed{' '}
        {new Date(joke.completed_at).toLocaleDateString(undefined, { dateStyle: 'medium' })}
      </p>
      {archived ? <p className="notice">This joke is archived. It’s hidden from your main list.</p> : null}

      <div className="publish-bar">
        <button type="button" className="btn btn--primary" onClick={() => setPublishing(true)}>
          Publish to Keep
        </button>
        {inKeep ? (
          <span className="badge badge--keep">
            <span aria-hidden="true">✓</span> Sent to Keep ·{' '}
            {new Date(inKeep.completed_at ?? inKeep.created_at).toLocaleDateString(undefined, { dateStyle: 'medium' })}
          </span>
        ) : null}
      </div>
      {publishing ? (
        <PublishSheet joke={joke} topicTitle={topic?.title ?? ''} onClose={() => setPublishing(false)} />
      ) : null}

      <section className="joke-card joke-card--edit" aria-label="The joke">
        <AutosaveField
          table="jokes"
          rowId={joke.id}
          field="setup_text"
          value={joke.setup_text}
          label="Setup"
          multiline
          rows={2}
          maxLength={LIMITS.setup}
          validate={required('setup')}
        />
        <AutosaveField
          table="jokes"
          rowId={joke.id}
          field="punch_text"
          value={joke.punch_text}
          label="Punch"
          multiline
          rows={2}
          maxLength={LIMITS.punch}
          validate={required('punch')}
          className="joke-card__punch"
        />
      </section>

      <div className="joke-tools">
        <ToggleButton
          pressed={joke.is_favorite}
          onToggle={() => update('jokes', joke.id, { is_favorite: !joke.is_favorite })}
          label="Favorite joke"
          icon={['♥', '♡']}
        />
        <Rating value={joke.rating} onChange={(rating) => update('jokes', joke.id, { rating })} />
      </div>

      <AutosaveField
        table="jokes"
        rowId={joke.id}
        field="notes"
        value={joke.notes}
        label="Notes"
        hint="Where it goes in a set, how it landed, ideas for tags."
        multiline
        rows={3}
        maxLength={LIMITS.notes}
      />

      <details className="panel__reference">
        <summary>How you dug it</summary>
        <dl className="dig-path">
          <dt>Target</dt>
          <dd>{joke.target_assumption_text || '—'}</dd>
          <dt>Connector</dt>
          <dd>{joke.connector_text || '—'}</dd>
          <dt>Reinterpretation</dt>
          <dd>{joke.reinterpretation_text || '—'}</dd>
          <dt>Second story</dt>
          <dd>{joke.second_story_text || '—'}</dd>
        </dl>
        {joke.attempt_id ? (
          <p>
            <Link to={`/a/${joke.attempt_id}/review`}>Open the dig</Link> (your edits here don’t change it)
          </p>
        ) : null}
      </details>

      <section className="publish-history" aria-labelledby="publish-history-heading">
        <h2 id="publish-history-heading" className="section-title">
          Publish history
        </h2>
        <PublishHistory jokeId={joke.id} headingId="publish-history-heading" />
      </section>

      <div className="button-row">
        <button type="button" className="btn btn--small" onClick={() => setArchived('jokes', joke.id, !archived)}>
          {archived ? 'Restore' : 'Archive'}
        </button>
        <button type="button" className="btn btn--small btn--danger" onClick={remove}>
          Delete
        </button>
      </div>
    </div>
  );
}
