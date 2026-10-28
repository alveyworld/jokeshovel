import type { OutboxSnapshot } from '../lib/outbox/outbox';

const LABELS: Record<OutboxSnapshot['state'], string> = {
  saved: 'Saved',
  saving: 'Saving…',
  offline: 'Offline — saved on this device',
  error: 'Couldn’t save',
};

const ICONS: Record<OutboxSnapshot['state'], string> = { saved: '✓', saving: '…', offline: '⚠', error: '⚠' };

/**
 * Always-visible save status. Screen readers hear problems at once, and
 * "All changes saved" only when saving recovers, not after every keystroke:
 * the polite region's text doesn't change between "saving" and "saved".
 */
export function SaveIndicator({ snapshot, onRetry }: { snapshot: OutboxSnapshot; onRetry(): void }) {
  const { state } = snapshot;
  const problem = state === 'offline' || state === 'error';

  return (
    <div className={`save-indicator save-indicator--${state}`}>
      <span aria-hidden="true" className="save-indicator__icon">
        {ICONS[state]}
      </span>
      <span className="save-indicator__label">{LABELS[state]}</span>
      {problem ? (
        <button type="button" className="btn btn--small btn--ghost" onClick={onRetry}>
          Retry
        </button>
      ) : null}
      <span className="visually-hidden" role="status">
        {problem ? '' : 'All changes saved'}
      </span>
      <span className="visually-hidden" role="alert">
        {problem ? LABELS[state] : ''}
      </span>
    </div>
  );
}
