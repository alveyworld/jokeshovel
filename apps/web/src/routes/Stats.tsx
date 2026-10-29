import { useState } from 'react';
import { Link } from 'react-router';
import { ColumnChart, type ColumnDatum } from '../components/ColumnChart';
import { useDrafts, useJokes, useStatsTimeline, useTopicSummaries } from '../data/hooks';
import type { TopicSummary } from '../data/rows';
import { countThisWeek, percent, stuckDrafts, weeklyCounts } from '../lib/stats';
import { DraftCard } from './Drafts';

const WEEKS = 12;

type Column =
  | 'title'
  | 'association_count'
  | 'setup_count'
  | 'unfinished_attempt_count'
  | 'completed_joke_count'
  | 'completion_percent';

const COLUMNS: { key: Column; label: string }[] = [
  { key: 'title', label: 'Topic' },
  { key: 'association_count', label: 'Associations' },
  { key: 'setup_count', label: 'Setups' },
  { key: 'unfinished_attempt_count', label: 'Drafts' },
  { key: 'completed_joke_count', label: 'Jokes' },
  { key: 'completion_percent', label: 'Completion' },
];

function toColumns(dates: readonly string[]): ColumnDatum[] {
  return weeklyCounts(dates, WEEKS).map(({ start, count }) => {
    const label = start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    return { label, long: `Week of ${label}`, value: count };
  });
}

const sum = (topics: readonly TopicSummary[], key: keyof TopicSummary) =>
  topics.reduce((n, t) => n + (Number(t[key]) || 0), 0);

export function Stats() {
  const { topics, isPending: topicsPending } = useTopicSummaries();
  const { data: timeline, isPending: timelinePending, error } = useStatsTimeline();
  const { jokes } = useJokes();
  const { drafts } = useDrafts();
  const [sort, setSort] = useState<{ key: Column; desc: boolean }>({ key: 'completed_joke_count', desc: true });

  if (error) {
    return (
      <div className="page">
        <h1 className="page__title">Stats</h1>
        <p className="field__error" role="alert">
          Couldn’t load stats: {error.message}
        </p>
      </div>
    );
  }
  if (topicsPending || timelinePending) {
    return (
      <p className="page" role="status">
        Loading…
      </p>
    );
  }

  // Count only material in topics that still exist, like topic_stats does.
  const live = new Set(topics.map((t) => t.id));
  const setupDates = (timeline?.setups ?? []).filter((s) => live.has(s.topic_id)).map((s) => s.created_at);
  const attemptCount = (timeline?.attempts ?? []).filter((a) => live.has(a.topic_id)).length;
  const jokeDates = jokes.filter((j) => live.has(j.topic_id)).map((j) => j.completed_at);
  const completion = percent(sum(topics, 'setups_with_joke_count'), sum(topics, 'setup_count'));
  const stuck = stuckDrafts(drafts);

  const tiles = [
    { label: 'Associations', value: sum(topics, 'association_count') },
    { label: 'Setups', value: sum(topics, 'setup_count') },
    { label: 'Joke attempts', value: attemptCount },
    { label: 'Completed jokes', value: sum(topics, 'completed_joke_count') },
    { label: 'Completion', value: completion === null ? '—' : `${completion}%` },
  ];

  const rows = [...topics].sort((a, b) => {
    const dir = sort.desc ? -1 : 1;
    if (sort.key === 'title') return dir * a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
    // Topics without a completion % sort after every number, in either direction.
    const av = a[sort.key];
    const bv = b[sort.key];
    if (av === null || bv === null) return av === bv ? 0 : av === null ? 1 : -1;
    return dir * (av - bv) || a.title.localeCompare(b.title);
  });
  const sortBy = (key: Column) =>
    setSort((s) => (s.key === key ? { key, desc: !s.desc } : { key, desc: key !== 'title' }));

  return (
    <div className="page page--wide">
      <h1 className="page__title">
        The Assay <span className="page__subtitle">Stats</span>
      </h1>

      <section aria-labelledby="totals-heading">
        <h2 id="totals-heading" className="section-title">
          From first idea to finished joke
        </h2>
        <dl className="tiles">
          {tiles.map((t) => (
            <div key={t.label} className="tile">
              <dt>{t.label}</dt>
              <dd>{t.value}</dd>
            </div>
          ))}
        </dl>
        <p className="field__hint">Completion is setups that became a finished joke, out of all active setups.</p>
      </section>

      <section aria-labelledby="weekly-heading" className="chart-grid">
        <h2 id="weekly-heading" className="section-title">
          Week by week
        </h2>
        <ColumnChart
          title="Setups written"
          subtitle={`Last ${WEEKS} weeks · ${countThisWeek(setupDates)} this week`}
          data={toColumns(setupDates)}
          unit={['setup', 'setups']}
        />
        <ColumnChart
          title="Jokes completed"
          subtitle={`Last ${WEEKS} weeks · ${countThisWeek(jokeDates)} this week`}
          data={toColumns(jokeDates)}
          unit={['joke', 'jokes']}
        />
      </section>

      <section aria-labelledby="topics-heading">
        <h2 id="topics-heading" className="section-title">
          By topic
        </h2>
        {rows.length ? (
          // Focusable so keyboard users can scroll the table sideways on a phone.
          // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
          <div className="table-scroll" role="region" aria-labelledby="topics-heading" tabIndex={0}>
            <table className="stats-table">
              <thead>
                <tr>
                  {COLUMNS.map((c) => (
                    <th
                      key={c.key}
                      scope="col"
                      aria-sort={sort.key === c.key ? (sort.desc ? 'descending' : 'ascending') : undefined}
                    >
                      <button type="button" className="th-sort" onClick={() => sortBy(c.key)}>
                        {c.label}
                        <span aria-hidden="true">{sort.key === c.key ? (sort.desc ? ' ↓' : ' ↑') : ''}</span>
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => (
                  <tr key={t.id}>
                    <th scope="row">
                      <Link to={`/topics/${t.id}`}>{t.title || 'Untitled topic'}</Link>
                      {t.status === 'archived' ? <span className="chip chip--muted">archived</span> : null}
                    </th>
                    <td>{t.association_count}</td>
                    <td>{t.setup_count}</td>
                    <td>{t.unfinished_attempt_count}</td>
                    <td>{t.completed_joke_count}</td>
                    <td>{t.completion_percent === null ? '—' : `${t.completion_percent}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty">
            Nothing to count yet. <Link to="/topics">Start a topic</Link>.
          </p>
        )}
      </section>

      <section aria-labelledby="stuck-heading">
        <h2 id="stuck-heading" className="section-title">
          Stuck shafts
        </h2>
        {stuck.length ? (
          <>
            <p className="workspace__intro">Drafts you haven’t touched in two weeks or more.</p>
            <ul className="card-list" aria-label={`${stuck.length} stuck drafts`}>
              {stuck.map((d) => (
                <li key={d.attempt_id}>
                  <DraftCard draft={d} />
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="empty">No stuck shafts. Every draft has been touched in the last two weeks.</p>
        )}
      </section>
    </div>
  );
}
