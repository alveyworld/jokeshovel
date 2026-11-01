import { useEffect, useId, useRef } from 'react';
import { Link } from 'react-router';
import { SHORTCUT_HELP } from '../lib/shortcuts';

/** The "?" help (NAV-3): every shortcut, and whether single keys are on. */
export function ShortcutHelp({ singleKeys, onClose }: { singleKeys: boolean; onClose(): void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();

  useEffect(() => {
    const d = dialog.current;
    if (d && !d.open) d.showModal();
    return () => d?.close();
  }, []);

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
        <h2 id={`${id}-heading`}>Keyboard shortcuts</h2>
        <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
          <span aria-hidden="true">×</span>
        </button>
      </div>
      <div className="sheet__body">
        <table className="shortcut-table">
          <caption className="visually-hidden">Keyboard shortcuts</caption>
          <thead>
            <tr>
              <th scope="col">Keys</th>
              <th scope="col">Does</th>
            </tr>
          </thead>
          <tbody>
            {SHORTCUT_HELP.map((s) => (
              <tr key={s.label} className={!s.modifier && !singleKeys ? 'is-off' : undefined}>
                <th scope="row">
                  {s.keys.map((k, i) => (
                    <span key={k}>
                      {i ? ' or ' : ''}
                      <kbd>{k}</kbd>
                    </span>
                  ))}
                </th>
                <td>
                  {s.label}
                  {!s.modifier && !singleKeys ? ' (off)' : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="field__hint">
          Single-key shortcuts never fire while you’re typing in a field.{' '}
          {singleKeys ? 'You can turn them off' : 'They’re off; turn them on'} in{' '}
          <Link to="/settings" onClick={onClose}>
            Settings
          </Link>
          .
        </p>
      </div>
    </dialog>
  );
}
