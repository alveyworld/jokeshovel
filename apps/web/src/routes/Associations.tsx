import { ASSOCIATION_PROMPTS, LIMITS, type Association } from '@jokeshovel/shared';
import { useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { AutosaveField } from '../components/AutosaveField';
import { SameTitleDialog } from '../components/SameTitleDialog';
import { ToggleButton } from '../components/ToggleButton';
import { useToast } from '../components/Toasts';
import { useAssociations, useMutations, useSetups, useTopicSummaries, useTopicsFromAssociations } from '../data/hooks';
import { between, type TopicSummary } from '../data/rows';
import { sameTitle, topicTitleFromText } from '../lib/text';

export function Associations() {
  const { topicId = '' } = useParams();
  const { associations, isPending } = useAssociations(topicId);
  const { setups } = useSetups(topicId);
  const { topics } = useTopicSummaries();
  const { byAssociation } = useTopicsFromAssociations();
  const { createAssociation, createSetup, createTopicFromAssociation, update, softDelete, restore } = useMutations();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [draft, setDraft] = useState('');
  const [clash, setClash] = useState<{ association: Association; title: string; existing: TopicSummary } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const prompt = ASSOCIATION_PROMPTS[associations.length % ASSOCIATION_PROMPTS.length];
  const starred = associations.filter((a) => a.is_starred);

  const add = (e: FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    createAssociation(topicId, draft, associations);
    setDraft('');
    inputRef.current?.focus();
  };

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= associations.length) return;
    // Place the item just past its neighbour.
    const neighbour = associations[target];
    const beyond = associations[target + direction];
    const sortOrder =
      direction === -1
        ? between(beyond?.sort_order, neighbour.sort_order)
        : between(neighbour.sort_order, beyond?.sort_order);
    update('associations', associations[index].id, { sort_order: sortOrder });
  };

  const remove = (a: Association) => {
    softDelete('associations', a.id);
    showToast({ message: `Deleted “${a.text}”.`, actionLabel: 'Undo', onAction: () => restore('associations', a.id) });
    inputRef.current?.focus();
  };

  const startSetup = () => {
    const id = createSetup(topicId, setups);
    navigate(`/topics/${topicId}/setups`, { state: { focusSetupId: id } });
  };

  // ASSOC-5: dig into an association as a topic of its own. The association
  // stays here, and each links to the other.

  // Topics made on this screen, so a second tap that lands before the screen
  // updates opens the same topic instead of making another.
  const made = useRef(new Map<string, string>());
  const openTopic = (id: string) => navigate(`/topics/${id}/associations`);
  const createTopicFrom = (a: Association, title: string) => {
    setClash(null);
    const id = made.current.get(a.id) ?? createTopicFromAssociation(a.id, title);
    made.current.set(a.id, id);
    openTopic(id);
  };
  const makeTopic = (a: Association) => {
    const linked = byAssociation.get(a.id)?.id ?? made.current.get(a.id);
    if (linked) return openTopic(linked);
    const title = topicTitleFromText(a.text, LIMITS.topicTitle);
    if (!title) return;
    const existing = topics.find((t) => t.status === 'active' && sameTitle(t.title, title));
    if (existing) setClash({ association: a, title, existing });
    else createTopicFrom(a, title);
  };

  return (
    <section aria-labelledby="assoc-heading" className="workspace">
      <h2 id="assoc-heading" className="visually-hidden">
        Associations
      </h2>
      <p className="workspace__intro">
        List anything this topic makes you think of: people, places, objects, phrases, feelings, opinions. Don’t judge
        them yet. This is raw material, not jokes. If one deserves a dig of its own, use{' '}
        <span aria-hidden="true">{MAKE_ICON}</span>
        <span className="visually-hidden">Make it a topic</span> to turn it into a topic.
      </p>

      <form className="chip-input" onSubmit={add}>
        <label htmlFor="new-association" className="field__label">
          New association
        </label>
        <div className="inline-form__row">
          <input
            id="new-association"
            data-shortcut="new"
            ref={inputRef}
            type="text"
            value={draft}
            maxLength={LIMITS.association}
            placeholder={prompt}
            autoComplete="off"
            autoFocus
            aria-describedby="new-association-hint"
            onChange={(e) => setDraft(e.target.value)}
          />
          <button type="submit" className="btn btn--primary">
            Add
          </button>
        </div>
        <p id="new-association-hint" className="field__hint help">
          Press Enter to add and keep going.
        </p>
      </form>

      {isPending ? (
        <p role="status">Loading…</p>
      ) : associations.length ? (
        <ol className="item-list" aria-label={`${associations.length} associations`}>
          {associations.map((a, i) => (
            <li key={a.id} className="item item--association">
              <AutosaveField
                table="associations"
                rowId={a.id}
                field="text"
                value={a.text}
                label={`Association ${i + 1}`}
                hideLabel
                maxLength={LIMITS.association}
                className="item__field"
                validate={(v) => (v.trim() ? null : 'Type something, or delete this association.')}
              />
              <div className="item__actions">
                <ToggleButton
                  pressed={a.is_starred}
                  onToggle={() => update('associations', a.id, { is_starred: !a.is_starred })}
                  label={`Star “${a.text}”`}
                  icon={['★', '☆']}
                />
                <TopicLink association={a} topic={byAssociation.get(a.id)} onMake={makeTopic} />
                <div className="item__move">
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`Move “${a.text}” up`}
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                  >
                    <span aria-hidden="true">↑</span>
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`Move “${a.text}” down`}
                    disabled={i === associations.length - 1}
                    onClick={() => move(i, 1)}
                  >
                    <span aria-hidden="true">↓</span>
                  </button>
                </div>
                <button
                  type="button"
                  className="icon-btn icon-btn--danger"
                  aria-label={`Delete “${a.text}”`}
                  onClick={() => remove(a)}
                >
                  <span aria-hidden="true">🗑</span>
                </button>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="empty">Nothing here yet. Start with whatever comes to mind first.</p>
      )}

      {associations.length >= 3 ? (
        <div className="card card--nudge">
          <p>
            {starred.length
              ? `You’ve starred ${starred.length}. Ready to turn them into a setup?`
              : 'Star the associations that feel promising, then try writing a setup.'}
          </p>
          <button type="button" className="btn" onClick={startSetup}>
            Write a setup
          </button>
        </div>
      ) : null}

      {clash ? (
        <SameTitleDialog
          title={clash.existing.title}
          onOpenExisting={() => {
            setClash(null);
            openTopic(clash.existing.id);
          }}
          onCreateAnother={() => createTopicFrom(clash.association, clash.title)}
          onClose={() => setClash(null)}
        />
      ) : null}
    </section>
  );
}

// Text presentation, so phones don't swap in colour emoji.
const MAKE_ICON = '\u2934\uFE0E'; // ⤴
const OPEN_ICON = '\u2197\uFE0E'; // ↗

/** "Make it a topic", or a link to the topic this association already became. */
function TopicLink({
  association,
  topic,
  onMake,
}: {
  association: Association;
  topic: { id: string; title: string } | undefined;
  onMake(a: Association): void;
}) {
  if (topic) {
    const label = `Open topic “${topic.title || 'Untitled topic'}”`;
    return (
      <Link
        to={`/topics/${topic.id}/associations`}
        className="icon-btn icon-btn--narrow icon-btn--linked"
        aria-label={label}
        title={label}
      >
        <span aria-hidden="true">{OPEN_ICON}</span>
      </Link>
    );
  }
  return (
    <button
      type="button"
      className="icon-btn icon-btn--narrow"
      aria-label={`Make “${association.text}” a topic`}
      title="Make it a topic"
      onClick={() => onMake(association)}
    >
      <span aria-hidden="true">{MAKE_ICON}</span>
    </button>
  );
}
