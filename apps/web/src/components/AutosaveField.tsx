import { useEffect, useId, useRef, useState, type KeyboardEvent, type Ref } from 'react';
import type { TableName } from '../lib/outbox/outbox';
import { useOutbox } from '../data/OutboxProvider';

interface Props {
  table: TableName;
  rowId: string;
  field: string;
  value: string;
  label: string;
  hideLabel?: boolean;
  multiline?: boolean;
  rows?: number;
  maxLength: number;
  placeholder?: string;
  hint?: string;
  className?: string;
  /** Return an error message to block saving (e.g. a required title). */
  validate?: (value: string) => string | null;
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  inputRef?: Ref<HTMLInputElement & HTMLTextAreaElement>;
  autoFocus?: boolean;
}

/**
 * A text field that saves itself: every change goes to the outbox at once
 * (and so survives a closed tab); the outbox writes to the server shortly
 * after typing stops, or immediately on blur.
 */
export function AutosaveField({
  table,
  rowId,
  field,
  value,
  label,
  hideLabel,
  multiline,
  rows = 3,
  maxLength,
  placeholder,
  hint,
  className,
  validate,
  onKeyDown,
  inputRef,
  autoFocus,
}: Props) {
  const box = useOutbox();
  const id = useId();
  const [local, setLocal] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const focused = useRef(false);

  // Follow outside changes (another tab, a refetch) unless the user is typing here.
  useEffect(() => {
    if (!focused.current) setLocal(value);
  }, [value, rowId]);

  const onChange = (next: string) => {
    setLocal(next);
    const problem = validate?.(next) ?? null;
    setError(problem);
    if (!problem) box.update(table, rowId, { [field]: next });
  };

  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(' ') || undefined;
  const common = {
    id,
    value: local,
    maxLength,
    placeholder,
    autoFocus,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': describedBy,
    onFocus: () => {
      focused.current = true;
    },
    onBlur: () => {
      focused.current = false;
      if (error) {
        setLocal(value);
        setError(null);
      }
      box.flushSoon();
    },
    onKeyDown,
  };

  return (
    <div className={`field ${className ?? ''}`}>
      <label htmlFor={id} className={hideLabel ? 'visually-hidden' : 'field__label'}>
        {label}
      </label>
      {multiline ? (
        <textarea {...common} rows={rows} ref={inputRef} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input {...common} type="text" ref={inputRef} onChange={(e) => onChange(e.target.value)} />
      )}
      {hint ? (
        <p id={`${id}-hint`} className="field__hint">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="field__error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
