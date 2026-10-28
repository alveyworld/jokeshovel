import { MINE_STEPS, type DraftRow } from '@jokeshovel/shared';
import { Link } from 'react-router';
import { useDrafts } from '../data/hooks';
import { excerpt } from '../lib/text';
import { relativeTime } from '../lib/time';

export function stepName(step: DraftRow['current_step']) {
  const s = MINE_STEPS.find((m) => m.key === step);
  return s ? `Step ${s.number} · ${s.label}` : 'Review';
}

/** A link card for one unfinished joke attempt. */
export function DraftCard({ draft }: { draft: DraftRow }) {
  return (
    <Link to={`/a/${draft.attempt_id}/${draft.current_step}`} className="card card--link">
      <span className="card__eyebrow">{draft.topic_title}</span>
      <span className="card__title">{excerpt(draft.setup_text ?? '', 80) || 'Untitled setup'}</span>
      {draft.target_text ? <span className="card__desc">Target: {draft.target_text}</span> : null}
      <span className="card__meta">
        {stepName(draft.current_step)} · {relativeTime(draft.updated_at)}
      </span>
    </Link>
  );
}

export function Drafts() {
  const { drafts, isPending, error } = useDrafts();
  return (
    <div className="page">
      <h1 className="page__title">
        Open shafts <span className="page__subtitle">Drafts</span>
      </h1>
      <p className="workspace__intro">Every joke attempt you haven’t finished, most recent first.</p>
      {error ? (
        <p className="field__error" role="alert">
          Couldn’t load drafts: {error.message}
        </p>
      ) : isPending ? (
        <p role="status">Loading…</p>
      ) : drafts.length ? (
        <ul className="card-list" aria-label={`${drafts.length} unfinished joke attempts`}>
          {drafts.map((d) => (
            <li key={d.attempt_id}>
              <DraftCard draft={d} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty">
          No unfinished jokes. Open a setup and choose <strong>Mine this setup</strong> to start one.
        </p>
      )}
    </div>
  );
}
