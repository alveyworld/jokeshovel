import type { TopicSummary } from '../data/rows';
import { relativeTime } from '../lib/time';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function StatChips({ topic }: { topic: TopicSummary }) {
  return (
    <ul className="chips" aria-label="Topic stats">
      <li className="chip">{plural(topic.association_count, 'association', 'associations')}</li>
      <li className="chip">{plural(topic.setup_count, 'setup', 'setups')}</li>
      {topic.unfinished_attempt_count ? (
        <li className="chip">{plural(topic.unfinished_attempt_count, 'draft', 'drafts')}</li>
      ) : null}
      {topic.last_activity_at ? (
        <li className="chip chip--muted">active {relativeTime(topic.last_activity_at)}</li>
      ) : null}
    </ul>
  );
}
