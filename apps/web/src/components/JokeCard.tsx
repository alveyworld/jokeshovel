import type { Joke } from '@jokeshovel/shared';
import { Link } from 'react-router';
import { excerpt } from '../lib/text';
import { relativeTime } from '../lib/time';
import { Stars } from './Rating';

/** A link card for one completed joke. */
export function JokeCard({ joke, topicTitle }: { joke: Joke; topicTitle?: string }) {
  return (
    <Link to={`/j/${joke.id}`} className="card card--link joke-row">
      {topicTitle ? <span className="card__eyebrow">{topicTitle}</span> : null}
      <span className="card__title">
        {joke.is_favorite ? (
          <span className="joke-row__fav">
            <span aria-hidden="true">♥ </span>
            <span className="visually-hidden">Favorite: </span>
          </span>
        ) : null}
        {joke.title || 'Untitled joke'}
      </span>
      <span className="card__desc">{excerpt(joke.setup_text, 120)}</span>
      <span className="joke-row__punch">{excerpt(joke.punch_text, 120)}</span>
      <span className="card__meta">
        <Stars value={joke.rating} />
        {joke.rating ? ' · ' : ''}
        {joke.status === 'archived' ? 'Archived · ' : ''}
        completed {relativeTime(joke.completed_at)}
      </span>
    </Link>
  );
}
