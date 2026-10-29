import { useId } from 'react';

/** 1–5 stars as a radio group, plus "No rating". Arrow keys move between stars. */
export function Rating({
  value,
  onChange,
  label = 'Rating',
}: {
  value: number | null;
  onChange(v: number | null): void;
  label?: string;
}) {
  const id = useId();
  return (
    <fieldset className="rating">
      <legend className="field__label">{label}</legend>
      <div className="rating__options">
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n} className={`rating__star ${value !== null && n <= value ? 'is-on' : ''}`}>
            <input
              type="radio"
              name={id}
              value={n}
              checked={value === n}
              onChange={() => onChange(n)}
              className="visually-hidden"
            />
            <span aria-hidden="true">{value !== null && n <= value ? '★' : '☆'}</span>
            <span className="visually-hidden">
              {n} {n === 1 ? 'star' : 'stars'}
            </span>
          </label>
        ))}
        <label className="rating__clear">
          <input
            type="radio"
            name={id}
            value=""
            checked={value === null}
            onChange={() => onChange(null)}
            className="visually-hidden"
          />
          <span>No rating</span>
        </label>
      </div>
    </fieldset>
  );
}

export function Stars({ value }: { value: number | null }) {
  if (!value) return null;
  return (
    <span className="stars">
      <span aria-hidden="true">{'★'.repeat(value)}</span>
      <span className="visually-hidden">Rated {value} of 5</span>
    </span>
  );
}
