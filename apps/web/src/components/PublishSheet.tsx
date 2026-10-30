import {
  DEFAULT_INCLUDE,
  formatNoteBody,
  keepTitle,
  keywordCandidates,
  noteText,
  parseInclude,
  setupKeywords,
  uniqueTitle,
  type IncludeOptions,
  type Joke,
  type Publication,
} from '@jokeshovel/shared';
import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router';
import { useUser } from '../auth/AuthProvider';
import { useOutbox } from '../data/OutboxProvider';
import { useAssociations, useMutations, useProfile } from '../data/hooks';
import { useFeatures, useGoogleConnection, useOnline, usePublications, usePublishActions } from '../data/publishing';
import { useToast } from './Toasts';

export const KEEP_URL = 'https://keep.google.com/';

const INCLUDE_LABELS: [keyof IncludeOptions, string][] = [
  ['target', 'Target assumption'],
  ['connectorAndReinterpretation', 'Connector and reinterpretation'],
  ['secondStory', 'Second story'],
  ['dateAndLink', 'Date and link back'],
];

type Step = { kind: 'compose' } | { kind: 'confirm'; publication: Publication; via: 'share_sheet' | 'copy_open' };
type Problem = { message: string; action?: 'reconnect' | 'recreate' | 'retry' };

const RETRYABLE = new Set([
  'GOOGLE_UNAVAILABLE',
  'UPSTREAM_ERROR',
  'NETWORK',
  'INTERNAL',
  'HTTP_ERROR',
  'RATE_LIMITED',
]);

/**
 * The Publish sheet (docs/DESIGN.md §5.3 step 13, §9.3): build the note,
 * then send it by share sheet, copy and open, or the Docs Joke Book.
 */
export function PublishSheet({ joke, topicTitle, onClose }: { joke: Joke; topicTitle: string; onClose(): void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();
  const user = useUser();
  const box = useOutbox();
  const { associations } = useAssociations(joke.topic_id);
  const { publications } = usePublications();
  const { profile } = useProfile();
  const { update } = useMutations();
  const features = useFeatures();
  const google = useGoogleConnection(features.docsSync);
  const online = useOnline();
  const actions = usePublishActions();
  const { showToast } = useToast();

  const keywordInput = { setup: joke.setup_text, topic: topicTitle, connector: joke.connector_text, associations };
  const candidates = keywordCandidates(keywordInput);
  const [chosen, setChosen] = useState<string[] | null>(null);
  const picked = chosen ?? setupKeywords(keywordInput);
  // Titles of other jokes' Keep notes, so this one gets a " #2" instead of a duplicate.
  const taken = publications
    .filter((p) => p.joke_id !== joke.id && p.destination === 'google_keep')
    .map((p) => p.title);
  const suggested = uniqueTitle(keepTitle(topicTitle, picked), taken);
  const [manual, setManual] = useState<string | null>(null);
  const title = manual ?? suggested;

  const prefs = (profile?.preferences ?? {}) as Record<string, unknown>;
  const [include, setInclude] = useState<IncludeOptions>(() =>
    prefs.noteInclude ? parseInclude(prefs.noteInclude) : DEFAULT_INCLUDE,
  );
  const body = formatNoteBody(joke, {
    topicTitle,
    appBaseUrl: window.location.origin,
    include,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });

  const [step, setStep] = useState<Step>({ kind: 'compose' });
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);
  const docsRequest = useRef<string | null>(null);

  useEffect(() => {
    const d = dialog.current;
    if (d && !d.open) d.showModal();
    return () => d?.close();
  }, []);

  const canShare =
    typeof navigator.share === 'function' &&
    (typeof navigator.canShare !== 'function' || navigator.canShare({ title, text: body }));
  const disabled = busy || !online || !title.trim();

  const toggle = (word: string) => {
    const set = new Set(picked);
    if (set.has(word)) set.delete(word);
    else set.add(word);
    setChosen(candidates.filter((c) => set.has(c.word)).map((c) => c.word));
  };

  /** Next time, the sheet starts with the same sections ticked. */
  const rememberInclude = () => update('profiles', user.id, { preferences: { ...prefs, noteInclude: include } });

  const record = (method: 'share_sheet' | 'copy_open') => {
    const started = actions.start({
      jokeId: joke.id,
      method,
      title: title.trim(),
      body,
      include,
      clientRequestId: crypto.randomUUID(),
    });
    started.catch(() => undefined); // Awaited below; this just avoids an unhandled rejection.
    return started;
  };

  const abandon = async (started: Promise<Publication>, message?: string) => {
    const p = await started.catch(() => null);
    if (p) await actions.confirm(p.id, false).catch(() => undefined);
    setBusy(false);
    if (message) setProblem({ message });
  };

  const awaitConfirm = async (started: Promise<Publication>, via: 'share_sheet' | 'copy_open') => {
    try {
      setStep({ kind: 'confirm', publication: await started, via });
    } catch {
      setProblem({ message: 'Sent, but we couldn’t record it. Check your connection and publish again.' });
    } finally {
      setBusy(false);
    }
  };

  // The share sheet must open straight from the click: no await before navigator.share.
  const share = async () => {
    setProblem(null);
    const started = record('share_sheet');
    setBusy(true);
    try {
      await navigator.share({ title: title.trim(), text: body });
    } catch (err) {
      const cancelled = err instanceof DOMException && err.name === 'AbortError';
      return abandon(started, cancelled ? undefined : 'Couldn’t open the share sheet. Try Copy & open Keep instead.');
    }
    await awaitConfirm(started, 'share_sheet');
  };

  const copy = async () => {
    setProblem(null);
    const started = record('copy_open');
    setBusy(true);
    try {
      await navigator.clipboard.writeText(noteText(title, body));
    } catch {
      return abandon(started, 'Couldn’t copy. Select the preview text and copy it instead.');
    }
    window.open(KEEP_URL, '_blank', 'noopener');
    await awaitConfirm(started, 'copy_open');
  };

  const answer = async (saved: boolean) => {
    if (step.kind !== 'confirm') return;
    setBusy(true);
    try {
      await actions.confirm(step.publication.id, saved);
      if (saved) rememberInclude();
      showToast({ message: saved ? 'Sent to Keep.' : 'Not marked as sent. You can publish again any time.' });
      onClose();
    } catch (err) {
      setProblem({ message: err instanceof Error ? err.message : 'Couldn’t save your answer.' });
      setBusy(false);
    }
  };

  const toDocs = async (recreateBook = false) => {
    setProblem(null);
    setBusy(true);
    // The Worker publishes what's saved, so save any queued edits first.
    if (!(await box.flushAll())) {
      setBusy(false);
      setProblem({ message: 'Some edits aren’t saved yet. Publish once you’re back online.' });
      return;
    }
    docsRequest.current ??= crypto.randomUUID();
    const result = await actions.toDocs(joke.id, {
      title: title.trim(),
      include,
      clientRequestId: docsRequest.current,
      recreateBook,
    });
    setBusy(false);
    if (result.ok) {
      rememberInclude();
      showToast({ message: 'Added to your Joke Book.' });
      onClose();
      return;
    }
    const { code, message } = result.error;
    setProblem({
      message,
      action:
        code === 'GOOGLE_RECONNECT_REQUIRED'
          ? 'reconnect'
          : code === 'JOKE_BOOK_UNREACHABLE'
            ? 'recreate'
            : RETRYABLE.has(code)
              ? 'retry'
              : undefined,
    });
  };

  return (
    <dialog
      ref={dialog}
      className="sheet"
      aria-labelledby={`${id}-heading`}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className="sheet__head">
        <h2 id={`${id}-heading`}>Publish to Google Keep</h2>
        <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
          <span aria-hidden="true">×</span>
        </button>
      </div>

      {step.kind === 'compose' ? (
        <div className="sheet__body">
          <div className="field">
            <label htmlFor={`${id}-title`} className="field__label">
              Note title
            </label>
            <input
              id={`${id}-title`}
              type="text"
              value={title}
              maxLength={200}
              onChange={(e) => setManual(e.target.value)}
              aria-describedby={`${id}-title-hint`}
            />
            <p id={`${id}-title-hint`} className="field__hint">
              {manual === null ? (
                'Built from the topic and the keywords you pick, so jokes are easy to find in Keep.'
              ) : (
                <>
                  You edited the title, so keywords won’t change it.{' '}
                  <button type="button" className="btn btn--ghost btn--small" onClick={() => setManual(null)}>
                    ↺ Reset to suggestion
                  </button>
                </>
              )}
            </p>
          </div>

          {candidates.length ? (
            <div className="field">
              <span className="field__label" id={`${id}-keywords`}>
                Keywords
              </span>
              <div className="word-chips" role="group" aria-labelledby={`${id}-keywords`}>
                {candidates.map((c) => (
                  <button
                    key={c.word}
                    type="button"
                    className={`chip-btn ${picked.includes(c.word) ? 'is-selected' : ''}`}
                    aria-pressed={picked.includes(c.word)}
                    onClick={() => toggle(c.word)}
                  >
                    {c.word}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <fieldset className="include">
            <legend className="field__label">Include</legend>
            <label className="include__option">
              <input type="checkbox" checked disabled />
              Setup and punch <span className="field__hint">(always)</span>
            </label>
            {INCLUDE_LABELS.map(([key, label]) => (
              <label key={key} className="include__option">
                <input
                  type="checkbox"
                  checked={include[key]}
                  onChange={(e) => setInclude({ ...include, [key]: e.target.checked })}
                />
                {label}
              </label>
            ))}
          </fieldset>

          <section className="note-preview" aria-labelledby={`${id}-preview`}>
            <h3 id={`${id}-preview`} className="field__label">
              Preview
            </h3>
            <div className="note-preview__card">
              <p className="note-preview__title">{title}</p>
              <pre className="note-preview__body">{body}</pre>
            </div>
          </section>

          {!online ? (
            <p className="notice" role="status">
              You’re offline. Publishing will be available when you reconnect.
            </p>
          ) : null}
          {problem ? (
            <div className="field__error" role="alert">
              {problem.message}{' '}
              {problem.action === 'reconnect' ? <Link to="/settings">Reconnect in Settings</Link> : null}
              {problem.action === 'recreate' ? (
                <button type="button" className="btn btn--small" disabled={busy} onClick={() => toDocs(true)}>
                  Create a new Joke Book
                </button>
              ) : null}
              {problem.action === 'retry' ? (
                <button type="button" className="btn btn--small" disabled={busy} onClick={() => toDocs()}>
                  Try again
                </button>
              ) : null}
            </div>
          ) : null}

          <div className="sheet__actions">
            {canShare ? (
              <button type="button" className="btn btn--primary" disabled={disabled} onClick={share}>
                Share to Keep
              </button>
            ) : null}
            <button
              type="button"
              className={`btn ${canShare ? '' : 'btn--primary'}`}
              disabled={disabled}
              onClick={copy}
            >
              Copy &amp; open Keep
            </button>
            {features.docsSync ? (
              google.data?.connected ? (
                <button type="button" className="btn" disabled={disabled} onClick={() => toDocs()}>
                  Add to Joke Book
                </button>
              ) : (
                <Link to="/settings" className="btn btn--ghost">
                  Connect Google for the Joke Book
                </Link>
              )
            ) : null}
          </div>
        </div>
      ) : (
        <div className="sheet__body">
          {step.via === 'copy_open' ? (
            <>
              <p>
                Copied. In Keep, start a new note and paste. The first line is the title; move it into the note’s title
                if you like.
              </p>
              <div className="button-row">
                <a className="btn" href={KEEP_URL} target="_blank" rel="noopener noreferrer">
                  Open Google Keep <span aria-hidden="true">↗</span>
                </a>
                <button
                  type="button"
                  className="btn btn--ghost btn--small"
                  onClick={() => navigator.clipboard.writeText(title.trim()).catch(() => undefined)}
                >
                  Copy title only
                </button>
                <button
                  type="button"
                  className="btn btn--ghost btn--small"
                  onClick={() => navigator.clipboard.writeText(body).catch(() => undefined)}
                >
                  Copy note text only
                </button>
              </div>
            </>
          ) : (
            <p>Keep should have opened with the note filled in. Save it there.</p>
          )}
          <p className="sheet__question" id={`${id}-question`}>
            Did it save in Keep?
          </p>
          {problem ? (
            <p className="field__error" role="alert">
              {problem.message}
            </p>
          ) : null}
          <div className="button-row" role="group" aria-labelledby={`${id}-question`}>
            <button type="button" className="btn btn--primary" disabled={busy} onClick={() => answer(true)}>
              Yes, it’s in Keep
            </button>
            <button type="button" className="btn" disabled={busy} onClick={() => answer(false)}>
              No, it didn’t save
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}
