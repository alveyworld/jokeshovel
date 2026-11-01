import { useState } from 'react';
import { Link } from 'react-router';
import { NewTopicForm } from '../components/NewTopicForm';
import { StatChips } from '../components/StatChips';
import { SwipeRow } from '../components/SwipeRow';
import { useToast } from '../components/Toasts';
import { useMutations, useTopicSummaries } from '../data/hooks';
import { useTags } from '../data/tags';
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
  const [tagId, setTagId] = useState('');
  const { tags, topicTags } = useTags();
  const { update, setArchived, softDelete, restore } = useMutations();
  const { showToast } = useToast();

  /** Swipe actions; the topic's own page has the same buttons. */
  const swipeActions = (t: TopicSummary) => [
    {
      label: t.is_favorite ? 'Unfavorite' : 'Favorite',
      onClick: () => update('topics', t.id, { is_favorite: !t.is_favorite }),
    },
    {
      label: t.status === 'archived' ? 'Restore' : 'Archive',
      onClick: () => setArchived('topics', t.id, t.status !== 'archived'),
    },
    {
      label: 'Delete',
      tone: 'danger' as const,
      onClick: () => {
        softDelete('topics', t.id);
        showToast({
          message: `Deleted “${t.title || 'Untitled topic'}”.`,
          actionLabel: 'Undo',
          onAction: () => restore('topics', t.id),
        });
      },
    },
  ];

  const shown = topics
    .filter((t) => !tagId || topicTags(t.id).some((tag) => tag.id === tagId))
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
        {tags.length ? (
          <label className="toolbar__sort">
            <span>Tag</span>
            <select value={tagId} onChange={(e) => setTagId(e.target.value)}>
              <option value="">Any</option>
              {tags.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
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
              <SwipeRow actions={swipeActions(t)}>
                <Link to={`/topics/${t.id}`} className="card card--link">
                  <span className="card__title">
                    {t.is_favorite ? <span aria-label="Favorite">★ </span> : null}
                    {t.title || 'Untitled topic'}
                  </span>
                  {t.description ? <span className="card__desc">{t.description}</span> : null}
                  {topicTags(t.id).length ? (
                    <span className="card__tags">
                      {topicTags(t.id)
                        .map((tag) => tag.name)
                        .join(' · ')}
                    </span>
                  ) : null}
                  <StatChips topic={t} />
                </Link>
              </SwipeRow>
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty">
          {tagId
            ? 'No topics here with that tag.'
            : filter === 'archived'
              ? 'No archived topics.'
              : filter === 'favorites'
                ? 'No favorite topics yet. Tap the star on a topic to add it here.'
                : 'No topics yet. Name one above to start digging.'}
        </p>
      )}
    </div>
  );
}
