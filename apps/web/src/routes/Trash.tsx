import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { useToast } from '../components/Toasts';
import { TRASH_DAYS, daysLeft, deleteForever, useTrash, type TrashItem } from '../data/account';
import { useMutations } from '../data/hooks';
import { relativeTime } from '../lib/time';

/** The Trash (ERR-3, FR-S5): deleted work waits 30 days, then the nightly purge removes it. */
export function Trash() {
  const { data: items = [], isPending, error } = useTrash();
  const { restore } = useMutations();
  const { showToast } = useToast();
  const qc = useQueryClient();
  // Hide handled rows at once; the server agrees after the next refetch.
  const [gone, setGone] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState<string | null>(null);
  const shown = items.filter((i) => !gone.has(i.id));

  const hide = (id: string) => setGone((s) => new Set(s).add(id));

  const onRestore = (item: TrashItem) => {
    restore(item.table, item.id);
    hide(item.id);
    showToast({
      message: item.parentInTrash
        ? `Restored “${item.label}”. Its topic or setup is still in the Trash; restore that to see it.`
        : `Restored “${item.label}”.`,
    });
  };

  const onDelete = async (item: TrashItem) => {
    setConfirming(null);
    hide(item.id);
    const err = await deleteForever(item.table, item.id);
    void qc.invalidateQueries({ queryKey: ['trash'] });
    if (err) showToast({ message: `Couldn’t delete it: ${err}`, tone: 'error' });
    else showToast({ message: `Deleted “${item.label}” for good.` });
  };

  return (
    <div className="page">
      <nav aria-label="Breadcrumb" className="breadcrumb">
        <Link to="/settings">Settings</Link> <span aria-hidden="true">›</span> <span aria-current="page">Trash</span>
      </nav>
      <h1 className="page__title">
        Spoil heap <span className="page__subtitle">Trash</span>
      </h1>
      <p className="workspace__intro">
        Deleted topics, setups, drafts and jokes stay here for {TRASH_DAYS} days, then they’re gone for good. Restoring
        a topic brings back everything in it.
      </p>

      {error ? (
        <p className="field__error" role="alert">
          Couldn’t load the Trash: {error.message}
        </p>
      ) : isPending ? (
        <p role="status">Loading…</p>
      ) : shown.length ? (
        <ul className="card-list" aria-label={`${shown.length} ${shown.length === 1 ? 'item' : 'items'} in the Trash`}>
          {shown.map((item) => {
            const days = daysLeft(item.deletedAt);
            return (
              <li key={`${item.table}:${item.id}`} className="card trash-item">
                <span className="card__eyebrow">
                  {item.kind} · {item.context}
                </span>
                <span className="card__title">{item.label}</span>
                <span className="card__meta">
                  Deleted {relativeTime(item.deletedAt)} · gone for good{' '}
                  {days === 0 ? 'tonight' : `in ${days} ${days === 1 ? 'day' : 'days'}`}
                </span>
                <div className="button-row">
                  <button type="button" className="btn btn--small" onClick={() => onRestore(item)}>
                    Restore<span className="visually-hidden"> “{item.label}”</span>
                  </button>
                  {confirming === item.id ? (
                    <>
                      <button type="button" className="btn btn--small btn--danger" onClick={() => onDelete(item)}>
                        Yes, delete for good
                      </button>
                      <button type="button" className="btn btn--small btn--ghost" onClick={() => setConfirming(null)}>
                        Keep it
                      </button>
                    </>
                  ) : (
                    <button type="button" className="btn btn--small btn--ghost" onClick={() => setConfirming(item.id)}>
                      Delete for good<span className="visually-hidden"> “{item.label}”</span>
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="empty">The Trash is empty.</p>
      )}
    </div>
  );
}
