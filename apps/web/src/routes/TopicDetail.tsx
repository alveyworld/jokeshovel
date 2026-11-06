import { LIMITS } from '@jokeshovel/shared';
import { Link, NavLink, Outlet, useNavigate, useParams } from 'react-router';
import { AutosaveField } from '../components/AutosaveField';
import { StatChips } from '../components/StatChips';
import { TagEditor } from '../components/TagEditor';
import { ToggleButton } from '../components/ToggleButton';
import { useToast } from '../components/Toasts';
import { useAssociation, useAssociations, useMutations, useSetups, useTopic, useTopicSummaries } from '../data/hooks';
import { useTagActions, useTags } from '../data/tags';
import { useRememberLocation } from '../data/useRememberLocation';

export function TopicDetail() {
  const { topicId = '' } = useParams();
  const { topic, isPending } = useTopic(topicId);
  const { topics } = useTopicSummaries();
  const { associations } = useAssociations(topicId);
  const { setups } = useSetups(topicId);
  const { update, softDelete, restore, setArchived } = useMutations();
  const { showToast } = useToast();
  const { tags, topicTags } = useTags();
  const { setTopicTags } = useTagActions();
  const navigate = useNavigate();
  useRememberLocation(topic ? topic.title || 'Untitled topic' : null);

  if (!topic) {
    return isPending ? (
      <p className="page" role="status">
        Loading…
      </p>
    ) : (
      <div className="page">
        <h1 className="page__title">Topic not found</h1>
        <p>It may have been deleted.</p>
      </div>
    );
  }

  // Live counts from what's on screen; the server's topic_stats agrees once saved.
  const summary = topics.find((t) => t.id === topic.id);
  const stats = {
    ...(summary ?? {
      id: topic.id,
      title: topic.title,
      description: topic.description,
      status: topic.status,
      is_favorite: topic.is_favorite,
      last_activity_at: topic.last_activity_at,
      unfinished_attempt_count: 0,
      completed_joke_count: 0,
      setups_with_joke_count: 0,
      completion_percent: null,
      published_to_keep_count: 0,
      published_to_docs_count: 0,
    }),
    association_count: associations.length,
    setup_count: setups.filter((s) => s.status === 'active').length,
  };
  const archived = topic.status === 'archived';

  const remove = () => {
    softDelete('topics', topic.id);
    navigate('/topics');
    showToast({
      message: `Deleted “${topic.title}”.`,
      actionLabel: 'Undo',
      onAction: () => {
        restore('topics', topic.id);
        navigate(`/topics/${topic.id}`);
      },
    });
  };

  return (
    <div className="page">
      <nav aria-label="Breadcrumb" className="breadcrumb">
        <NavLink to="/topics">Topics</NavLink> <span aria-hidden="true">›</span>{' '}
        <span aria-current="page">{topic.title || 'Untitled topic'}</span>
      </nav>

      <header className="topic-head">
        <AutosaveField
          table="topics"
          rowId={topic.id}
          field="title"
          value={topic.title}
          label="Topic title"
          hideLabel
          maxLength={LIMITS.topicTitle}
          className="topic-head__title"
          validate={(v) => (v.trim() ? null : 'A topic needs a title.')}
        />
        {topic.source_association_id ? <TopicOrigin associationId={topic.source_association_id} /> : null}
        <AutosaveField
          table="topics"
          rowId={topic.id}
          field="description"
          value={topic.description}
          label="Description"
          multiline
          rows={2}
          maxLength={LIMITS.topicDescription}
          placeholder="What about it interests you? (optional)"
        />
        <TagEditor tags={topicTags(topic.id)} all={tags} onChange={(names) => setTopicTags(topic.id, names)} />
        <div className="topic-head__meta">
          <StatChips topic={stats} />
          <div className="topic-head__actions">
            <ToggleButton
              pressed={topic.is_favorite}
              onToggle={() => update('topics', topic.id, { is_favorite: !topic.is_favorite })}
              label="Favorite topic"
              icon={['★', '☆']}
            />
            <button type="button" className="btn btn--small" onClick={() => setArchived('topics', topic.id, !archived)}>
              {archived ? 'Restore' : 'Archive'}
            </button>
            <button type="button" className="btn btn--small btn--danger" onClick={remove}>
              Delete
            </button>
          </div>
        </div>
        {archived ? <p className="notice">This topic is archived. It’s hidden from your active list.</p> : null}
      </header>

      <nav className="subtabs" aria-label="Topic sections">
        <NavLink to="associations" className="subtabs__link">
          Associations <span className="subtabs__count">{associations.length}</span>
        </NavLink>
        <NavLink to="setups" className="subtabs__link">
          Setups <span className="subtabs__count">{stats.setup_count}</span>
        </NavLink>
        <NavLink to="jokes" className="subtabs__link">
          Jokes <span className="subtabs__count">{stats.completed_joke_count}</span>
        </NavLink>
      </nav>

      {/* Keyed so moving between topics starts each tab fresh (empty input, focus). */}
      <Outlet key={topic.id} />
    </div>
  );
}

/**
 * "Made from “TSA” in Airports" on a topic made from an association (ASSOC-5).
 * Hidden once that association or its topic is deleted.
 */
function TopicOrigin({ associationId }: { associationId: string }) {
  const { association } = useAssociation(associationId);
  return association ? <OriginLink topicId={association.topic_id} text={association.text} /> : null;
}

function OriginLink({ topicId, text }: { topicId: string; text: string }) {
  const { topic } = useTopic(topicId);
  if (!topic) return null;
  return (
    <p className="topic-head__origin">
      Made from{' '}
      <Link to={`/topics/${topic.id}/associations`}>
        “{text}” in {topic.title || 'Untitled topic'}
      </Link>
    </p>
  );
}
