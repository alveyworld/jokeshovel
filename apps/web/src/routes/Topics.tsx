import { useState } from 'react';
import { Link } from 'react-router';
import { NewTopicForm } from '../components/NewTopicForm';
import { StatChips } from '../components/StatChips';
import { useTopicSummaries } from '../data/hooks';
import type { TopicSummary } from '../data/rows';

type Filter = 'active' | 'favorites' | 'archived';
type Sort = 'recent' | 'az' | 'setups';

const SORTS: Record<Sort, (a: TopicSummary, b: TopicSummary) => number> = {
  recent: (a, b) => b.last_activity_at.localeCompare(a.last_activity_at),
  az: (a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }),
  setups: (a, b) => b.setup_count - a.setup_count,
};

export function Topics() {
  const { topics, isPending, error } = useTopicSummaries();
  const [filter, setFilter] = useState<Filter>('active');
  const [sort, setSort] = useState<Sort>('recent');

  const shown = topics
    .filter((t) =>
      filter === 'archived'
        ? t.status === 'archived'
        : t.status === 'active' && (filter !== 'favorites' || t.is_favorite),
    )
    .sort(SORTS[sort]);

  return (
    <div className="page">
      <h1 className="page__title">Topics</h1>
      <section className="card" aria-label="Start a new topic">
        <NewTopicForm />
      </section>

      <div className="toolbar">
        <fieldset className="segmented">
          <legend className="visually-hidden">Show</legend>
          {(['active', 'favorites', 'archived'] as Filter[]).map((f) => (
            <label key={f} className={`segmented__option ${filter === f ? 'is-selected' : ''}`}>
              <input type="radio" name="topic-filter" value={f} checked={filter === f} onChange={() => setFilter(f)} />
              {f[0].toUpperCase() + f.slice(1)}
            </label>
          ))}
        </fieldset>
        <label className="toolbar__sort">
          <span>Sort</span>
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            <option value="recent">Recent activity</option>
            <option value="az">A–Z</option>
            <option value="setups">Most setups</option>
          </select>
        </label>
      </div>

      {error ? (
        <p className="field__error" role="alert">
          Couldn’t load topics: {error.message}
        </p>
      ) : isPending ? (
        <p role="status">Loading…</p>
      ) : shown.length ? (
        <ul className="card-list" aria-label={`${shown.length} topics`}>
          {shown.map((t) => (
            <li key={t.id}>
              <Link to={`/topics/${t.id}`} className="card card--link">
                <span className="card__title">
                  {t.is_favorite ? <span aria-label="Favorite">★ </span> : null}
                  {t.title || 'Untitled topic'}
                </span>
                {t.description ? <span className="card__desc">{t.description}</span> : null}
                <StatChips topic={t} />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty">
          {filter === 'archived'
            ? 'No archived topics.'
            : filter === 'favorites'
              ? 'No favorite topics yet. Tap the star on a topic to add it here.'
              : 'No topics yet. Name one above to start digging.'}
        </p>
      )}
    </div>
  );
}
