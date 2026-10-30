import { parseInclude, type Publication } from '@jokeshovel/shared';
import { useState } from 'react';
import { usePublications, usePublishActions } from '../data/publishing';
import { useToast } from './Toasts';

const METHOD: Record<Publication['method'], string> = {
  share_sheet: 'Keep · share sheet',
  copy_open: 'Keep · copy and open',
  docs_api: 'Docs Joke Book',
  download: 'Download',
};

/** Status as icon plus words, never colour alone. */
const STATUS: Record<Publication['status'], [icon: string, label: string]> = {
  pending: ['?', 'Not confirmed'],
  user_confirmed: ['✓', 'Saved in Keep'],
  succeeded: ['✓', 'Added'],
  cancelled: ['–', 'Not saved'],
  failed: ['!', 'Failed'],
};

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

/** Each publish of one joke: where, how, whether it landed, and when (AC-25). */
export function PublishHistory({ jokeId, headingId }: { jokeId: string; headingId: string }) {
  const { publications } = usePublications();
  const actions = usePublishActions();
  const { showToast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const mine = publications.filter((p) => p.joke_id === jokeId);

  const confirm = async (p: Publication, saved: boolean) => {
    setBusy(p.id);
    await actions.confirm(p.id, saved).catch(() => showToast({ message: 'Couldn’t save your answer.', tone: 'error' }));
    setBusy(null);
  };

  const retry = async (p: Publication) => {
    setBusy(p.id);
    const result = await actions.toDocs(jokeId, {
      title: p.title,
      include: parseInclude(p.include_options),
      clientRequestId: p.client_request_id,
    });
    setBusy(null);
    showToast(result.ok ? { message: 'Added to your Joke Book.' } : { message: result.error.message, tone: 'error' });
  };

  if (!mine.length) {
    return <p className="field__hint">Not published yet.</p>;
  }
  return (
    <ol className="history" aria-labelledby={headingId}>
      {mine.map((p) => {
        const [icon, label] = STATUS[p.status];
        return (
          <li key={p.id} className="history__item">
            <p className="history__line">
              <strong>{METHOD[p.method]}</strong>{' '}
              <span className={`status status--${p.status}`}>
                <span aria-hidden="true">{icon}</span> {label}
              </span>
            </p>
            <p className="history__meta">
              <time dateTime={p.created_at}>{when(p.created_at)}</time> · “{p.title}”
            </p>
            {p.status === 'pending' && p.destination === 'google_keep' ? (
              <div className="history__actions" role="group" aria-label={`Did “${p.title}” save in Keep?`}>
                <span>Did it save?</span>
                <button
                  type="button"
                  className="btn btn--small"
                  disabled={busy === p.id}
                  onClick={() => confirm(p, true)}
                >
                  It saved
                </button>
                <button
                  type="button"
                  className="btn btn--small btn--ghost"
                  disabled={busy === p.id}
                  onClick={() => confirm(p, false)}
                >
                  It didn’t
                </button>
              </div>
            ) : null}
            {p.status === 'failed' ? (
              <div className="history__actions">
                <span className="history__error">{p.error_message}</span>
                {p.method === 'docs_api' ? (
                  <button type="button" className="btn btn--small" disabled={busy === p.id} onClick={() => retry(p)}>
                    Retry
                  </button>
                ) : null}
              </div>
            ) : null}
            {p.status === 'succeeded' && p.external_url ? (
              <a href={p.external_url} target="_blank" rel="noopener noreferrer">
                Open the Joke Book <span aria-hidden="true">↗</span>
              </a>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
