import { useQueryClient } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth, useUser } from '../auth/AuthProvider';
import { buildExportFiles, deleteAccount, download } from '../data/account';
import { useOutbox } from '../data/OutboxProvider';
import { useFeatures, useGoogleConnection } from '../data/publishing';
import { api } from '../lib/api';

const PHRASE = 'delete my account';
/** Matches delete_account(): a sign-in within 5 minutes (with a little slack for clocks). */
const RECENT_SECONDS = 270;

/** When this session last signed in (the newest `amr` timestamp in its token), in epoch seconds. */
function signedInAt(accessToken: string | undefined): number | null {
  try {
    const part = accessToken?.split('.')[1];
    if (!part) return null;
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const claims = JSON.parse(atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4))) as {
      amr?: { timestamp?: number }[];
    };
    const times = (claims.amr ?? []).map((a) => a.timestamp ?? 0);
    return times.length ? Math.max(...times) : null;
  } catch {
    return null;
  }
}

/** Export, Trash and account deletion (docs/DESIGN.md §5.3 Data, FR-A4, ORG-3). */
export function DataCard() {
  const user = useUser();
  const { session, signOut, signInWithGoogle } = useAuth();
  const box = useOutbox();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const features = useFeatures();
  const google = useGoogleConnection(features.docsSync);
  const id = useId();
  const [exporting, setExporting] = useState<'json' | 'md' | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [phrase, setPhrase] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<{ message: string; reauth?: boolean } | null>(null);

  const exportAs = async (kind: 'json' | 'md') => {
    setExporting(kind);
    setExportError(null);
    try {
      // Include edits still waiting to save.
      await box.flushAll();
      const files = await buildExportFiles(user.email ?? null);
      if (kind === 'json') download(`jokeshovel-${files.date}.json`, files.json, 'application/json');
      else download(`jokeshovel-${files.date}.md`, files.markdown, 'text/markdown');
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'The export failed. Try again.');
    } finally {
      setExporting(null);
    }
  };

  const reauthenticate = async () => {
    if (user.app_metadata.provider === 'google') {
      const err = await signInWithGoogle('/settings');
      if (err) setProblem({ message: err });
      return;
    }
    await signOut('local');
    navigate('/signin?next=/settings', { replace: true });
  };

  const removeAccount = async () => {
    setBusy(true);
    setProblem(null);
    // Ask for a fresh sign-in before changing anything (the database checks again).
    const at = signedInAt(session?.access_token);
    if (at === null || at < Date.now() / 1000 - RECENT_SECONDS) {
      setBusy(false);
      setProblem({ message: 'For your safety, sign in again, then come back here to finish.', reauth: true });
      return;
    }
    // Revoke the Google Docs grant first, while we still can (best effort).
    if (features.docsSync && google.data?.connected) await api('/integrations/google', { method: 'DELETE' });
    const result = await deleteAccount(phrase.trim().toLowerCase());
    if (!result.ok) {
      setBusy(false);
      setProblem(
        result.reauth
          ? { message: 'For your safety, sign in again, then come back here to finish.', reauth: true }
          : { message: result.message },
      );
      return;
    }
    await box.clear();
    qc.clear();
    await signOut('local').catch(() => undefined);
    // A full load: nothing of the old session survives in memory, and it can't be
    // cancelled by this page unmounting when the session ends.
    window.location.replace('/signin?deleted=1');
  };

  return (
    <section className="card" aria-labelledby="data-heading">
      <h2 id="data-heading">Your data</h2>

      <h3>Export</h3>
      <p>
        Download everything you’ve written. The Markdown file is easy to read and print; the JSON file is a complete
        copy for safekeeping.
      </p>
      <div className="button-row">
        <button type="button" className="btn" disabled={Boolean(exporting)} onClick={() => exportAs('md')}>
          {exporting === 'md' ? 'Preparing…' : 'Download Markdown'}
        </button>
        <button type="button" className="btn" disabled={Boolean(exporting)} onClick={() => exportAs('json')}>
          {exporting === 'json' ? 'Preparing…' : 'Download JSON'}
        </button>
      </div>
      {exportError ? (
        <p className="field__error" role="alert">
          {exportError}
        </p>
      ) : null}

      <h3>Trash</h3>
      <p>
        Deleted work waits 30 days before it’s gone for good. <Link to="/trash">Open the Trash</Link>
      </p>

      <h3>Delete account</h3>
      {deleting ? (
        <div className="danger-zone">
          <p>
            This deletes your account and everything in it: topics, setups, drafts, jokes, tags and publish history.{' '}
            <strong>It can’t be undone.</strong> Download an export first if you want a copy. Notes already in Google
            Keep or Docs stay there.
          </p>
          <div className="field">
            <label htmlFor={`${id}-phrase`} className="field__label">
              Type <strong>{PHRASE}</strong> to confirm
            </label>
            <input
              id={`${id}-phrase`}
              type="text"
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          {problem ? (
            <div className="field__error" role="alert">
              {problem.message}{' '}
              {problem.reauth ? (
                <button type="button" className="btn btn--small" onClick={reauthenticate}>
                  Sign in again
                </button>
              ) : null}
            </div>
          ) : null}
          <div className="button-row">
            <button
              type="button"
              className="btn btn--danger"
              disabled={busy || phrase.trim().toLowerCase() !== PHRASE}
              onClick={removeAccount}
            >
              {busy ? 'Deleting…' : 'Delete my account'}
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => {
                setDeleting(false);
                setPhrase('');
                setProblem(null);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="btn btn--ghost btn--danger" onClick={() => setDeleting(true)}>
          Delete account…
        </button>
      )}
    </section>
  );
}
