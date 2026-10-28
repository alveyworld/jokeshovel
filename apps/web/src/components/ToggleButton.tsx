interface Props {
  pressed: boolean;
  onToggle(): void;
  label: string;
  icon: [on: string, off: string];
  className?: string;
}

/** An icon toggle with an accessible name and aria-pressed state. */
export function ToggleButton({ pressed, onToggle, label, icon, className }: Props) {
  return (
    <button
      type="button"
      className={`icon-btn ${pressed ? 'icon-btn--on' : ''} ${className ?? ''}`}
      aria-pressed={pressed}
      aria-label={label}
      title={label}
      onClick={onToggle}
    >
      <span aria-hidden="true">{pressed ? icon[0] : icon[1]}</span>
    </button>
  );
}
