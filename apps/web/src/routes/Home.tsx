import { Link } from 'react-router';
import shovel from '../assets/brand/shovel.png';
import { NewTopicForm } from '../components/NewTopicForm';
import { StatChips } from '../components/StatChips';
import { useProfile, useTopicSummaries } from '../data/hooks';
import { relativeTime } from '../lib/time';

export function Home() {
  const { topics, isPending } = useTopicSummaries();
  const { lastLocation } = useProfile();
  const recent = topics.filter((t) => t.status === 'active').slice(0, 3);

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
