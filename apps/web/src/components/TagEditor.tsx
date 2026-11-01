import { TAG_MAX, cleanTagName, uniqueTagNames, type Tag } from '@jokeshovel/shared';
import { useId, useState, type FormEvent } from 'react';
import type { TagResult } from '../data/tags';

interface Props {
  tags: readonly Tag[];
  /** Every tag the user has, offered as suggestions. */
  all: readonly Tag[];
  onChange(names: string[]): Promise<TagResult>;
  label?: string;
}

/** Tags on a joke or topic (ORG-1): chips you can remove, and a box to add more. */
export function TagEditor({ tags, all, onChange, label = 'Tags' }: Props) {
  const id = useId();
  const [text, setText] = useState('');
  const [pending, setPending] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Alphabetical, like the server returns them, so chips don't jump after saving.
  const names = [...(pending ?? tags.map((t) => t.name))].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' }),
  );
  // One save at a time, so a quick second change can't be overwritten by the first.
  const saving = pending !== null;
  const suggestions = all.filter((t) => !names.some((n) => n.toLowerCase() === t.name.toLowerCase()));

  const save = async (next: string[]) => {
    setError(null);
    setPending(next);
    const result = await onChange(next);
    setPending(null);
    if (!result.ok) setError(result.message);
  };

  const add = (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;
    // "Opener, clean set" adds two tags.
    const added = text.split(',').map(cleanTagName).filter(Boolean);
    if (!added.length) return;
    if (added.some((n) => n.length > TAG_MAX)) {
      setError(`Tags are at most ${TAG_MAX} characters.`);
      return;
    }
    setText('');
    void save(uniqueTagNames([...names, ...added]));
  };

  return (
    <div className="tag-editor">
      <span id={`${id}-label`} className="field__label">
        {label}
      </span>
      {names.length ? (
        <ul className="tag-list" aria-labelledby={`${id}-label`}>
          {names.map((name) => (
            <li key={name.toLowerCase()} className="tag">
              <span>{name}</span>
              <button
                type="button"
                className="tag__remove"
                aria-label={`Remove tag “${name}”`}
                disabled={saving}
                onClick={() => save(names.filter((n) => n !== name))}
              >
                <span aria-hidden="true">×</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="field__hint help">No tags yet. Group jokes by set, theme or anything you like.</p>
      )}
      <form className="inline-form__row" onSubmit={add}>
        <label htmlFor={`${id}-input`} className="visually-hidden">
          Add a tag
        </label>
        <input
          id={`${id}-input`}
          type="text"
          list={`${id}-suggestions`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add a tag, e.g. Opener"
          maxLength={TAG_MAX * 3}
          autoComplete="off"
        />
        <button type="submit" className="btn btn--small" disabled={!text.trim() || saving} aria-label="Add tag">
          Add
        </button>
      </form>
      <datalist id={`${id}-suggestions`}>
        {suggestions.map((t) => (
          <option key={t.id} value={t.name} />
        ))}
      </datalist>
      {/* Tags save straight to the server (not the save queue), so say when they're on their way. */}
      <p className="field__hint tag-editor__status" role="status">
        {saving ? 'Saving tags…' : ''}
      </p>
      {error ? (
        <p className="field__error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
