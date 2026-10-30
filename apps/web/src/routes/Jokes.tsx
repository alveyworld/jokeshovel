import type { Joke } from '@jokeshovel/shared';
import { useState } from 'react';
import { Link } from 'react-router';
import { JokeCard } from '../components/JokeCard';
import { useJokes, useTopicSummaries } from '../data/hooks';
import { sentToKeep, usePublications } from '../data/publishing';

type Show = 'all' | 'favorites' | 'archived';
type Sort = 'newest' | 'rating' | 'topic';
type KeepFilter = 'any' | 'sent' | 'not';

const SHOW_LABELS: Record<Show, string> = { all: 'All', favorites: 'Favorites', archived: 'Archived' };

export function Jokes() {
  const { jokes, isPending, error } = useJokes();
  const { topics } = useTopicSummaries();
  const [show, setShow] = useState<Show>('all');
  const [topicId, setTopicId] = useState('');
  const [minRating, setMinRating] = useState(0);
  const [sort, setSort] = useState<Sort>('newest');
  const [keep, setKeep] = useState<KeepFilter>('any');
  const { publications } = usePublications();
  const inKeep = new Set(jokes.filter((j) => sentToKeep(publications, j.id)).map((j) => j.id));

  const topicTitle = new Map(topics.map((t) => [t.id, t.title || 'Untitled topic']));
  const titleOf = (j: Joke) => topicTitle.get(j.topic_id) ?? '';
  const sorts: Record<Sort, (a: Joke, b: Joke) => number> = {
    newest: (a, b) => b.completed_at.localeCompare(a.completed_at),
    rating: (a, b) => (b.rating ?? 0) - (a.rating ?? 0) || b.completed_at.localeCompare(a.completed_at),
    topic: (a, b) => titleOf(a).localeCompare(titleOf(b), undefined, { sensitivity: 'base' }),
  };

  const shown = jokes
    // Jokes in deleted topics aren't listed (topic_stats has no row for them).
    .filter((j) => topicTitle.has(j.topic_id) || !topics.length)
    .filter((j) => (show === 'archived' ? j.status === 'archived' : j.status === 'complete'))
    .filter((j) => show !== 'favorites' || j.is_favorite)
    .filter((j) => !topicId || j.topic_id === topicId)
    .filter((j) => !minRating || (j.rating ?? 0) >= minRating)
    .filter((j) => keep === 'any' || (keep === 'sent') === inKeep.has(j.id))
    .sort(sorts[sort]);

  const filtered = show !== 'all' || topicId || minRating || keep !== 'any';
  const usedTopics = topics.filter((t) => jokes.some((j) => j.topic_id === t.id));

  return (
    <div className="page">
      <h1 className="page__title">
        Nuggets <span className="page__subtitle">Jokes</span>
      </h1>
      <p className="workspace__intro">
        Every joke you’ve finished. <Link to="/stats">See your stats</Link>
      </p>

      <div className="filters" role="group" aria-label="Filter jokes">
        <fieldset className="segmented">
          <legend className="visually-hidden">Show</legend>
          {(Object.keys(SHOW_LABELS) as Show[]).map((s) => (
            <label key={s} className={`segmented__option ${show === s ? 'is-selected' : ''}`}>
              <input type="radio" name="joke-show" value={s} checked={show === s} onChange={() => setShow(s)} />
              {SHOW_LABELS[s]}
            </label>
          ))}
        </fieldset>
        <label className="toolbar__sort">
          <span>Topic</span>
          <select value={topicId} onChange={(e) => setTopicId(e.target.value)}>
            <option value="">All topics</option>
            {usedTopics.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title || 'Untitled topic'}
              </option>
            ))}
          </select>
        </label>
        <label className="toolbar__sort">
          <span>Rating</span>
          <select value={minRating} onChange={(e) => setMinRating(Number(e.target.value))}>
            <option value={0}>Any</option>
            {[2, 3, 4].map((n) => (
              <option key={n} value={n}>
                {n}+ stars
              </option>
            ))}
            <option value={5}>5 stars</option>
          </select>
        </label>
        <label className="toolbar__sort">
          <span>Keep</span>
          <select value={keep} onChange={(e) => setKeep(e.target.value as KeepFilter)}>
            <option value="any">Any</option>
            <option value="sent">Sent to Keep</option>
            <option value="not">Not yet in Keep</option>
          </select>
        </label>
        <label className="toolbar__sort">
          <span>Sort</span>
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            <option value="newest">Newest</option>
            <option value="rating">Best rated</option>
            <option value="topic">Topic A–Z</option>
          </select>
        </label>
      </div>

      {error ? (
        <p className="field__error" role="alert">
          Couldn’t load jokes: {error.message}
        </p>
      ) : isPending ? (
        <p role="status">Loading…</p>
      ) : shown.length ? (
        <ul className="card-list" aria-label={`${shown.length} ${shown.length === 1 ? 'joke' : 'jokes'}`}>
          {shown.map((j) => (
            <li key={j.id}>
              <JokeCard joke={j} topicTitle={titleOf(j)} inKeep={inKeep.has(j.id)} />
            </li>
          ))}
        </ul>
      ) : jokes.length && filtered ? (
        <p className="empty">
          {show === 'favorites' && !topicId && !minRating && keep === 'any'
            ? 'No favorites yet. Tap the heart on a joke to add it here.'
            : show === 'archived' && !topicId && !minRating && keep === 'any'
              ? 'No archived jokes.'
              : 'No jokes match these filters.'}
        </p>
      ) : (
        <p className="empty">
          No jokes yet. Finish a dig and choose <strong>Mark as complete</strong> on the Review step.
        </p>
      )}
    </div>
  );
}
