import { Link, useParams } from 'react-router';
import { JokeCard } from '../components/JokeCard';
import { useJokes } from '../data/hooks';

/** The topic's completed jokes; archived ones stay on the Jokes tab. */
export function TopicJokes() {
  const { topicId = '' } = useParams();
  const { jokes, isPending } = useJokes();
  const mine = jokes.filter((j) => j.topic_id === topicId);
  const live = mine.filter((j) => j.status === 'complete');
  const archived = mine.length - live.length;

  return (
    <section className="workspace" aria-labelledby="topic-jokes-heading">
      <h2 id="topic-jokes-heading" className="visually-hidden">
        Jokes
      </h2>
      {isPending ? (
        <p role="status">Loading…</p>
      ) : live.length ? (
        <ul className="card-list" aria-label={`${live.length} ${live.length === 1 ? 'joke' : 'jokes'}`}>
          {live.map((j) => (
            <li key={j.id}>
              <JokeCard joke={j} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty">
          No finished jokes from this topic yet. Pick a setup from <Link to="../setups">Setups</Link> and mine it.
        </p>
      )}
      {archived ? (
        <p className="field__hint">
          Plus {archived} archived {archived === 1 ? 'joke' : 'jokes'}, under <Link to="/jokes">Jokes</Link> › Archived.
        </p>
      ) : null}
    </section>
  );
}
