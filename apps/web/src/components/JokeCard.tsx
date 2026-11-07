import type { Joke } from '@jokeshovel/shared';
import { Link } from 'react-router';
import { excerpt } from '../lib/text';
import { relativeTime } from '../lib/time';
import { Stars } from './Rating';

/**
 * A completed joke as a 3×5 index card (COMP-4): the title above the red
 * line, the setup and punch on the rules, and its details on the last lines.
 */
export function JokeCard({
  joke,
  topicTitle,
  inKeep,
  tags = [],
}: {
  joke: Joke;
  topicTitle?: string;
  inKeep?: boolean;
  tags?: readonly string[];
}) {
  return (
    <Link to={`/j/${joke.id}`} className="index-card index-card--link">
      <span className="index-card__head">
        <span className="index-card__title">
          {joke.is_favorite ? (
            <span className="index-card__fav">
              <span aria-hidden="true">♥ </span>
              <span className="visually-hidden">Favorite: </span>
            </span>
          ) : null}
          {joke.title || 'Untitled joke'}
        </span>
        {topicTitle ? <span className="index-card__topic">{topicTitle}</span> : null}
      </span>
      <span className="index-card__lines">
        <span className="index-card__setup">{excerpt(joke.setup_text, 120)}</span>
        <span className="index-card__punch">{excerpt(joke.punch_text, 120)}</span>
        {tags.length ? <span className="index-card__tags">{tags.join(' · ')}</span> : null}
        <span className="index-card__meta">
          <Stars value={joke.rating} />
          {joke.rating ? ' · ' : ''}
          {joke.status === 'archived' ? 'Archived · ' : ''}
          completed {relativeTime(joke.completed_at)}
          {inKeep ? (
            <>
              {' · '}
              <span className="badge badge--keep">
                <span aria-hidden="true">✓</span> In Keep
              </span>
            </>
          ) : null}
        </span>
      </span>
    </Link>
  );
}
