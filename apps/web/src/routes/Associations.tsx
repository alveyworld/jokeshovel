import { ASSOCIATION_PROMPTS, LIMITS, type Association } from '@jokeshovel/shared';
import { useRef, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router';
import { AutosaveField } from '../components/AutosaveField';
import { ToggleButton } from '../components/ToggleButton';
import { useToast } from '../components/Toasts';
import { useAssociations, useMutations, useSetups } from '../data/hooks';
import { between } from '../data/rows';

export function Associations() {
  const { topicId = '' } = useParams();
  const { associations, isPending } = useAssociations(topicId);
  const { setups } = useSetups(topicId);
  const { createAssociation, createSetup, update, softDelete, restore } = useMutations();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [draft, setDraft] = useState('');
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

  return (
    <section aria-labelledby="assoc-heading" className="workspace">
      <h2 id="assoc-heading" className="visually-hidden">
        Associations
      </h2>
      <p className="workspace__intro">
        List anything this topic makes you think of: people, places, objects, phrases, feelings, opinions. Don’t judge
        them yet. This is raw material, not jokes.
      </p>

      <form className="chip-input" onSubmit={add}>
        <label htmlFor="new-association" className="field__label">
          New association
        </label>
        <div className="inline-form__row">
          <input
            id="new-association"
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
        <p id="new-association-hint" className="field__hint">
          Press Enter to add and keep going.
        </p>
      </form>

      {isPending ? (
        <p role="status">Loading…</p>
      ) : associations.length ? (
        <ol className="item-list" aria-label={`${associations.length} associations`}>
          {associations.map((a, i) => (
            <li key={a.id} className="item">
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
    </section>
  );
}
