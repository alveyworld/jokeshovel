import type { Tag } from '@jokeshovel/shared';
import { TAG_MAX, cleanTagName } from '@jokeshovel/shared';
import { useState } from 'react';
import { useTagActions, useTags } from '../data/tags';
import { useToast } from './Toasts';

function TagRow({ tag, uses }: { tag: Tag; uses: number }) {
  const { renameTag, deleteTag } = useTagActions();
  const { showToast } = useToast();
  const [name, setName] = useState(tag.name);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rename = async () => {
    const clean = cleanTagName(name);
    if (!clean || clean === tag.name) {
      setName(tag.name);
      return;
    }
    const result = await renameTag(tag.id, clean);
    if (result.ok) setError(null);
    else {
      setError(result.message);
      setName(tag.name);
    }
  };

  const remove = async () => {
    const result = await deleteTag(tag.id);
    showToast(result.ok ? { message: `Deleted the tag “${tag.name}”.` } : { message: result.message, tone: 'error' });
  };

  return (
    <li className="tag-row">
      <label className="visually-hidden" htmlFor={`tag-${tag.id}`}>
        Rename “{tag.name}”
      </label>
      <input
        id={`tag-${tag.id}`}
        type="text"
        value={name}
        maxLength={TAG_MAX}
        onChange={(e) => setName(e.target.value)}
        onBlur={rename}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') setName(tag.name);
        }}
      />
      <span className="tag-row__uses">
        {uses} {uses === 1 ? 'use' : 'uses'}
      </span>
      {confirming ? (
        <span className="button-row">
          <button type="button" className="btn btn--small btn--danger" onClick={remove}>
            Delete “{tag.name}”
          </button>
          <button type="button" className="btn btn--small btn--ghost" onClick={() => setConfirming(false)}>
            Keep
          </button>
        </span>
      ) : (
        <button type="button" className="btn btn--small btn--ghost" onClick={() => setConfirming(true)}>
          Delete<span className="visually-hidden"> “{tag.name}”</span>
        </button>
      )}
      {error ? (
        <p className="field__error" role="alert">
          {error}
        </p>
      ) : null}
    </li>
  );
}

/** Rename or delete tags (deleting removes them from every joke and topic). */
export function TagManager() {
  const { tags, uses, isPending } = useTags();
  return (
    <section className="card" aria-labelledby="tags-heading">
      <h2 id="tags-heading">Tags</h2>
      {isPending ? (
        <p role="status">Loading…</p>
      ) : tags.length ? (
        <>
          <p className="field__hint help">Rename a tag here and it changes everywhere.</p>
          <ul className="tag-rows">
            {tags.map((t) => (
              <TagRow key={`${t.id}:${t.name}`} tag={t} uses={uses(t.id)} />
            ))}
          </ul>
        </>
      ) : (
        <p className="field__hint">No tags yet. Add them on a joke card or a topic.</p>
      )}
    </section>
  );
}
