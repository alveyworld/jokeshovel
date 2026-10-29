import { Link } from 'react-router';
import shovel from '../assets/brand/shovel.png';
import { NewTopicForm } from '../components/NewTopicForm';
import { StatChips } from '../components/StatChips';
import { useDrafts, useJokes, useProfile, useStatsTimeline, useTopicSummaries } from '../data/hooks';
import { countThisWeek } from '../lib/stats';
import { relativeTime } from '../lib/time';
import { DraftCard } from './Drafts';

export function Home() {
  const { topics, isPending } = useTopicSummaries();
  const { lastLocation } = useProfile();
  const { drafts } = useDrafts();
  const { jokes } = useJokes();
  const { data: timeline } = useStatsTimeline();
  const recent = topics.filter((t) => t.status === 'active').slice(0, 3);
  const live = new Set(topics.map((t) => t.id));
  const haul = [
    { label: 'Jokes in all', value: topics.reduce((n, t) => n + t.completed_joke_count, 0) },
    {
      label: 'Setups this week',
      value: countThisWeek((timeline?.setups ?? []).filter((x) => live.has(x.topic_id)).map((x) => x.created_at)),
    },
    {
      label: 'Jokes this week',
      value: countThisWeek(jokes.filter((j) => live.has(j.topic_id)).map((j) => j.completed_at)),
    },
  ];

  return (
    <div className="page">
      <h1 className="page__title">
        The Dig Site <span className="page__subtitle">Home</span>
      </h1>

      {lastLocation ? (
        <section className="card card--resume" aria-labelledby="resume-heading">
          <h2 id="resume-heading" className="card__eyebrow">
            Resume digging
          </h2>
          <p className="card__title">{lastLocation.label}</p>
          <p className="card__meta">Last worked on {relativeTime(lastLocation.at)}</p>
          <Link to={lastLocation.route} className="btn btn--primary">
            Continue <span aria-hidden="true">→</span>
          </Link>
        </section>
      ) : null}

      {drafts.length ? (
        <section aria-labelledby="shafts-heading">
          <div className="section-head">
            <h2 id="shafts-heading">Open shafts</h2>
            <Link to="/drafts">See all ({drafts.length})</Link>
          </div>
          <ul className="card-list">
            {drafts.slice(0, 3).map((d) => (
              <li key={d.attempt_id}>
                <DraftCard draft={d} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {topics.length ? (
        <section aria-labelledby="haul-heading">
          <div className="section-head">
            <h2 id="haul-heading">Your haul</h2>
            <Link to="/stats">See stats</Link>
          </div>
          <dl className="tiles tiles--compact">
            {haul.map((t) => (
              <div key={t.label} className="tile">
                <dt>{t.label}</dt>
                <dd>{t.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      <section aria-labelledby="recent-heading">
        <div className="section-head">
          <h2 id="recent-heading">Recent topics</h2>
          {topics.length ? <Link to="/topics">See all</Link> : null}
        </div>
        {isPending ? (
          <p role="status">Loading…</p>
        ) : recent.length ? (
          <ul className="card-list">
            {recent.map((t) => (
              <li key={t.id}>
                <Link to={`/topics/${t.id}`} className="card card--link">
                  <span className="card__title">{t.title || 'Untitled topic'}</span>
                  <StatChips topic={t} />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="empty">
            <img src={shovel} alt="" className="empty__art" width={37} height={120} />
            <p>
              <strong>Every topic is a dig site.</strong> Pick something you have opinions about and start shoveling.
            </p>
          </div>
        )}
      </section>

      <section className="card" aria-label="Start a new topic">
        <NewTopicForm />
      </section>
    </div>
  );
}
