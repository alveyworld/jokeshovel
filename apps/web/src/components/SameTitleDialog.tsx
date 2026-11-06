import { useEffect, useId, useRef } from 'react';

/**
 * Asked before making a topic from an association when a topic with that
 * title already exists (ASSOC-5, AC-31).
 */
export function SameTitleDialog({
  title,
  onOpenExisting,
  onCreateAnother,
  onClose,
}: {
  title: string;
  onOpenExisting(): void;
  onCreateAnother(): void;
  onClose(): void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const open = useRef<HTMLButtonElement>(null);
  const id = useId();

  useEffect(() => {
    const d = dialog.current;
    if (d && !d.open) d.showModal();
    // Start on the safe choice rather than the Close button.
    open.current?.focus();
    return () => d?.close();
  }, []);

  return (
    <dialog
      ref={dialog}
      className="sheet"
      aria-labelledby={`${id}-heading`}
      aria-describedby={`${id}-body`}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className="sheet__head">
        <h2 id={`${id}-heading`}>You already have this topic</h2>
        <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
          <span aria-hidden="true">×</span>
        </button>
      </div>
      <div className="sheet__body">
        <p id={`${id}-body`}>
          You already have a topic called “{title}”. Open it, or make a new topic from this association anyway?
        </p>
        <div className="sheet__actions">
          <button ref={open} type="button" className="btn btn--primary" onClick={onOpenExisting}>
            Open “{title}”
          </button>
          <button type="button" className="btn" onClick={onCreateAnother}>
            Create another
          </button>
        </div>
      </div>
    </dialog>
  );
}
