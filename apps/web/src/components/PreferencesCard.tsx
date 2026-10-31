import { useId, useState, type ReactNode } from 'react';
import { usePreferences } from '../data/preferences';
import type { Theme } from '../lib/preferences';
import { ShortcutHelp } from './ShortcutHelp';

const THEMES: [Theme, string][] = [
  ['system', 'Match device'],
  ['light', 'Light'],
  ['dark', 'Dark'],
];

function Check({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: ReactNode;
  checked: boolean;
  onChange(v: boolean): void;
}) {
  const id = useId();
  return (
    <div className="check">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-describedby={`${id}-hint`}
      />
      <label htmlFor={id}>{label}</label>
      <p id={`${id}-hint`} className="field__hint">
        {hint}
      </p>
    </div>
  );
}

/** Theme, Expert mode, motion and shortcuts (docs/DESIGN.md §5.3 Preferences). */
export function PreferencesCard() {
  const { prefs, setPreference } = usePreferences();
  const [helpOpen, setHelpOpen] = useState(false);

  return (
    <section className="card" aria-labelledby="preferences-heading">
      <h2 id="preferences-heading">Preferences</h2>

      <fieldset className="plain-fieldset">
        <legend className="field__label">Theme</legend>
        <div className="segmented">
          {THEMES.map(([value, label]) => (
            <label key={value} className={`segmented__option ${prefs.theme === value ? 'is-selected' : ''}`}>
              <input
                type="radio"
                name="theme"
                value={value}
                checked={prefs.theme === value}
                onChange={() => setPreference('theme', value)}
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <Check
        label="Expert mode"
        hint={<>Hides the explanations and tips on each screen.</>}
        checked={prefs.expertMode}
        onChange={(v) => setPreference('expertMode', v)}
      />

      <Check
        label="Reduce motion"
        hint={<>Turns off animations, even if your device doesn’t ask for that.</>}
        checked={prefs.reducedMotion}
        onChange={(v) => setPreference('reducedMotion', v)}
      />

      <Check
        label="Single-key shortcuts"
        hint={<>N, /, [, ] and ?. They never fire while you’re typing. ⌘K and ⌘Z always work.</>}
        checked={prefs.shortcuts}
        onChange={(v) => setPreference('shortcuts', v)}
      />
      <p>
        <button type="button" className="btn btn--small btn--ghost" onClick={() => setHelpOpen(true)}>
          Show keyboard shortcuts
        </button>
      </p>
      {helpOpen ? <ShortcutHelp singleKeys={prefs.shortcuts} onClose={() => setHelpOpen(false)} /> : null}
    </section>
  );
}
