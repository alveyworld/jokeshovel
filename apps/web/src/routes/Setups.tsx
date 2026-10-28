import { LIMITS, type Setup } from '@jokeshovel/shared';
import { useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { AutosaveField } from '../components/AutosaveField';
import { ToggleButton } from '../components/ToggleButton';
import { useToast } from '../components/Toasts';
import { useAssociations, useMutations, useSetups, useTopicAttempts } from '../data/hooks';

export function Setups() {
  const { topicId = '' } = useParams();
  const { setups, isPending } = useSetups(topicId);
  const { associations } = useAssociations(topicId);
  const { attempts } = useTopicAttempts(topicId);
  const { createSetup, update, softDelete, restore, setArchived } = useMutations();
  const { showToast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const focusId = (location.state as { focusSetupId?: string } | null)?.focusSetupId;
  const focusRef = useRef<HTMLTextAreaElement & HTMLInputElement>(null);
  const starred = associations.filter((a) => a.is_starred);
  const active = setups.filter((s) => s.status === 'active');
  const archived = setups.filter((s) => s.status === 'archived');

  useEffect(() => {
    if (!focusId) return;
    focusRef.current?.focus();
    // Clear the one-time focus request so Back/refresh doesn't repeat it.
    navigate(location.pathname, { replace: true, state: null });
  }, [focusId, location.pathname, navigate]);

  const add = () => {
    const id = createSetup(topicId, setups);
    navigate(location.pathname, { replace: true, state: { focusSetupId: id } });
  };

  const draftCount = (setupId: string) =>
    attempts.filter((a) => a.setup_id === setupId && a.status === 'in_progress').length;

  const remove = (s: Setup) => {
    softDelete('setups', s.id);
    showToast({ message: 'Deleted setup.', actionLabel: 'Undo', onAction: () => restore('setups', s.id) });
  };

  const card = (s: Setup, index: number) => (
    <li key={s.id} className="item item--setup">
      <AutosaveField
        table="setups"
        rowId={s.id}
        field="text"
        value={s.text}
        label={`Setup ${index + 1}`}
        hideLabel
        multiline
        rows={2}
        maxLength={LIMITS.setup}
        placeholder="A believable sentence or two that sets the scene…"
        className="item__field"
        inputRef={s.id === focusId ? focusRef : undefined}
      />
      <div className="item__actions">
        <ToggleButton
          pressed={s.is_favorite}
          onToggle={() => update('setups', s.id, { is_favorite: !s.is_favorite })}
          label={`Favorite setup ${index + 1}`}
          icon={['★', '☆']}
        />
        <button
          type="button"
          className="btn btn--small"
          onClick={() => setArchived('setups', s.id, s.status === 'active')}
        >
          {s.status === 'active' ? 'Archive' : 'Restore'}
        </button>
        <button
          type="button"
          className="icon-btn icon-btn--danger"
          aria-label={`Delete setup ${index + 1}`}
          onClick={() => remove(s)}
        >
          <span aria-hidden="true">🗑</span>
        </button>
      </div>
      <div className="item__footer">
        <Link to={`/s/${s.id}`} className="btn btn--small" aria-label={`Mine this setup — Setup ${index + 1}`}>
          Mine this setup <span aria-hidden="true">›</span>
        </Link>
        {draftCount(s.id) ? (
          <span className="chip">
            {draftCount(s.id)} {draftCount(s.id) === 1 ? 'draft' : 'drafts'}
          </span>
        ) : null}
      </div>
    </li>
  );

  return (
    <section aria-labelledby="setups-heading" className="workspace">
      <h2 id="setups-heading" className="visually-hidden">
        Setups
      </h2>
      <p className="workspace__intro">
        A setup is a sentence or two, usually true or believable, that gets the audience picturing a scene. Write
        several, then choose <strong>Mine this setup</strong> to dig a joke out of one.
      </p>

      <aside className="card card--context" aria-labelledby="starred-heading">
        <h3 id="starred-heading">Starred associations</h3>
        {starred.length ? (
          <ul className="chips">
            {starred.map((a) => (
              <li key={a.id} className="chip chip--gold">
                ★ {a.text}
              </li>
            ))}
          </ul>
        ) : (
          <p className="field__hint">
            None yet. <Link to={`/topics/${topicId}/associations`}>Star some associations</Link> to see them here while
            you write.
          </p>
        )}
      </aside>

      <button type="button" className="btn btn--primary" onClick={add}>
        + New setup
      </button>

      {isPending ? (
        <p role="status">Loading…</p>
      ) : active.length ? (
        <ol className="item-list" aria-label={`${active.length} setups`}>
          {active.map(card)}
        </ol>
      ) : (
        <p className="empty">No setups yet. Look at your associations and write the first one that comes to mind.</p>
      )}

      {archived.length ? (
        <details className="archived">
          <summary>Archived setups ({archived.length})</summary>
          <ol className="item-list">{archived.map(card)}</ol>
        </details>
      ) : null}
    </section>
  );
}
