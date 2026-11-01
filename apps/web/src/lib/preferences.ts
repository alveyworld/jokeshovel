/**
 * Display preferences (docs/DESIGN.md §5.3, profiles.preferences): theme,
 * Expert mode, reduced motion and keyboard shortcuts. They live on the
 * profile; a copy on this device applies them before the app first draws.
 */

export type Theme = 'system' | 'light' | 'dark';

export interface Preferences {
  theme: Theme;
  /** Hides help text (EXP-1). */
  expertMode: boolean;
  /** Turns off animations even if the device doesn't ask for that. */
  reducedMotion: boolean;
  /** Single-key shortcuts; WCAG 2.1.4 says they must be possible to turn off. */
  shortcuts: boolean;
}

export const DEFAULT_PREFERENCES: Preferences = {
  theme: 'system',
  expertMode: false,
  reducedMotion: false,
  shortcuts: true,
};

const STORAGE_KEY = 'jokeshovel:preferences';

export function parsePreferences(value: unknown): Preferences {
  const v = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  const bool = (key: keyof Preferences) =>
    typeof v[key] === 'boolean' ? (v[key] as boolean) : (DEFAULT_PREFERENCES[key] as boolean);
  return {
    theme: v.theme === 'light' || v.theme === 'dark' ? v.theme : 'system',
    expertMode: bool('expertMode'),
    reducedMotion: bool('reducedMotion'),
    shortcuts: bool('shortcuts'),
  };
}

/** Sets the attributes the stylesheets key off, and remembers them on this device. */
export function applyPreferences(prefs: Preferences, root: HTMLElement = document.documentElement) {
  if (prefs.theme === 'system') root.removeAttribute('data-theme');
  else root.dataset.theme = prefs.theme;
  root.toggleAttribute('data-expert', prefs.expertMode);
  root.toggleAttribute('data-reduce-motion', prefs.reducedMotion);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Private mode or storage full: preferences still apply for this visit.
  }
}

/** The copy on this device, for the first paint before the profile loads. */
export function cachedPreferences(): Preferences {
  try {
    return parsePreferences(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null'));
  } catch {
    return DEFAULT_PREFERENCES;
  }
}
