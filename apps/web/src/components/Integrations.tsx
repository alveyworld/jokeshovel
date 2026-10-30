import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useFeatures, useGoogleConnection } from '../data/publishing';
import { api } from '../lib/api';

/** Messages for /settings?google=… after Google's consent screen. */
const RETURN_MESSAGES: Record<string, { text: string; ok: boolean }> = {
  connected: { text: 'Google is connected. You can add jokes to your Joke Book.', ok: true },
  denied: { text: 'Google wasn’t connected because access was declined.', ok: false },
  expired: { text: 'That took too long or the link was used already. Try connecting again.', ok: false },
  'missing-scope': { text: 'Google didn’t grant access to files. Connect again and allow it.', ok: false },
  error: { text: 'Couldn’t connect Google. Try again.', ok: false },
  unavailable: { text: 'The Joke Book isn’t available on this server.', ok: false },
};

export function Integrations() {
  const features = useFeatures();
  const google = useGoogleConnection(features.docsSync);
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [returned] = useState(() => RETURN_MESSAGES[params.get('google') ?? '']);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Show the result once, then tidy the address so a reload doesn't repeat it.
  useEffect(() => {
    if (params.has('google')) setParams({}, { replace: true });
  }, [params, setParams]);

  const connect = async () => {
    setBusy(true);
    setError(null);
    const res = await api<{ url: string }>('/integrations/google/start?feature=docs');
    if (res.ok) {
      window.location.assign(res.data.url);
      return;
    }
    setBusy(false);
    setError(res.error.message);
  };

  const disconnect = async () => {
    setBusy(true);
    setError(null);
    const res = await api('/integrations/google', { method: 'DELETE' });
    setBusy(false);
    if (!res.ok) setError(res.error.message);
    void qc.invalidateQueries({ queryKey: ['google'] });
  };

  const status = google.data;
  return (
    <section className="card" aria-labelledby="integrations-heading">
      <h2 id="integrations-heading">Integrations</h2>

      <h3>Google Keep</h3>
      <p>
        Publish any finished joke from its joke card. On phones, <strong>Share to Keep</strong> opens Keep with the note
        filled in. On computers, <strong>Copy &amp; open Keep</strong> copies the note and opens Keep for you to paste.
        Nothing to connect: the app never reads your Keep.
      </p>

      {features.docsSync ? (
        <>
          <h3>Google Docs Joke Book</h3>
          <p>
            Adds each joke you publish to one Google Doc, “The Joke Shovel — Joke Book”. The app can only see files it
            creates, never the rest of your Drive.
          </p>
          {returned ? (
            <p className={returned.ok ? 'notice' : 'field__error'} role={returned.ok ? 'status' : 'alert'}>
              {returned.text}
            </p>
          ) : null}
          {error ? (
            <p className="field__error" role="alert">
              {error}
            </p>
          ) : null}
          {google.isPending ? (
            <p role="status">Checking your Google connection…</p>
          ) : status?.connected ? (
            <>
              <p>
                <span className="badge badge--keep">
                  <span aria-hidden="true">✓</span> Connected
                </span>{' '}
                Access: files this app creates (<code>drive.file</code>).
              </p>
              <div className="button-row">
                {status.jokeBookUrl ? (
                  <a className="btn" href={status.jokeBookUrl} target="_blank" rel="noopener noreferrer">
                    Open the Joke Book <span aria-hidden="true">↗</span>
                  </a>
                ) : null}
                <button type="button" className="btn btn--ghost" disabled={busy} onClick={disconnect}>
                  Disconnect Google
                </button>
              </div>
            </>
          ) : (
            <>
              {status?.status === 'revoked' || status?.status === 'error' ? (
                <p className="field__error">Google access expired. Reconnect to keep publishing to the Joke Book.</p>
              ) : null}
              <button type="button" className="btn btn--primary" disabled={busy} onClick={connect}>
                {status?.status ? 'Reconnect Google' : 'Connect Google'}
              </button>
            </>
          )}
        </>
      ) : null}
    </section>
  );
}
