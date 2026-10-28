import { useId, useState, type FormEvent, type RefObject } from 'react';
import type { TableName } from '../lib/outbox/outbox';
import { AutosaveField } from './AutosaveField';
import { ToggleButton } from './ToggleButton';

interface Item {
  id: string;
  text: string;
  is_starred?: boolean;
}

interface Props<T extends Item> {
  table: TableName;
  items: readonly T[];
  maxLength: number;
  inputLabel: string;
  placeholder: string;
  /** Accessible name of the list, given its length, e.g. "3 assumptions". */
  listLabel: (count: number) => string;
  /** Accessible name of one item's text field, e.g. "Assumption 2". */
  itemLabel: (index: number) => string;
  emptyText: string;
  onAdd(text: string): void;
  onDelete(item: T): void;
  onToggleStar?(item: T): void;
  inputRef?: RefObject<HTMLInputElement | null>;
  autoFocus?: boolean;
}

/** Rapid-fire list entry: type, press Enter, keep going. Items edit in place and autosave. */
export function BrainstormList<T extends Item>({
  table,
  items,
  maxLength,
  inputLabel,
  placeholder,
  listLabel,
  itemLabel,
  emptyText,
  onAdd,
  onDelete,
  onToggleStar,
  inputRef,
  autoFocus,
}: Props<T>) {
  const id = useId();
  const [draft, setDraft] = useState('');

  const add = (e: FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    onAdd(draft);
    setDraft('');
    inputRef?.current?.focus();
  };

  return (
    <div className="brainstorm">
      <form className="chip-input" onSubmit={add}>
        <label htmlFor={id} className="field__label">
          {inputLabel}
        </label>
        <div className="inline-form__row">
          <input
            id={id}
            ref={inputRef}
            type="text"
            value={draft}
            maxLength={maxLength}
            placeholder={placeholder}
            autoComplete="off"
            autoFocus={autoFocus}
            aria-describedby={`${id}-hint`}
            onChange={(e) => setDraft(e.target.value)}
          />
          <button type="submit" className="btn btn--primary">
            Add
          </button>
        </div>
        <p id={`${id}-hint`} className="field__hint">
          Press Enter to add and keep going.
        </p>
      </form>

      {items.length ? (
        <ol className="item-list" aria-label={listLabel(items.length)}>
          {items.map((item, i) => (
            <li key={item.id} className="item">
              <AutosaveField
                table={table}
                rowId={item.id}
                field="text"
                value={item.text}
                label={itemLabel(i)}
                hideLabel
                maxLength={maxLength}
                className="item__field"
                validate={(v) => (v.trim() ? null : 'Type something, or delete this item.')}
              />
              <div className="item__actions">
                {onToggleStar ? (
                  <ToggleButton
                    pressed={Boolean(item.is_starred)}
                    onToggle={() => onToggleStar(item)}
                    label={`Star “${item.text}”`}
                    icon={['★', '☆']}
                  />
                ) : null}
                <button
                  type="button"
                  className="icon-btn icon-btn--danger"
                  aria-label={`Delete “${item.text}”`}
                  onClick={() => {
                    onDelete(item);
                    inputRef?.current?.focus();
                  }}
                >
                  <span aria-hidden="true">🗑</span>
                </button>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="empty">{emptyText}</p>
      )}
    </div>
  );
}
