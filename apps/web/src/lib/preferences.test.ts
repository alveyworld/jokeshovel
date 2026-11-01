import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_PREFERENCES, applyPreferences, cachedPreferences, parsePreferences } from './preferences';

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.removeAttribute('data-expert');
  document.documentElement.removeAttribute('data-reduce-motion');
});

describe('preferences', () => {
  it('fills in defaults and ignores junk', () => {
    expect(parsePreferences(null)).toEqual(DEFAULT_PREFERENCES);
    expect(parsePreferences({ theme: 'purple', expertMode: 'yes', shortcuts: false })).toEqual({
      ...DEFAULT_PREFERENCES,
      shortcuts: false,
    });
  });

  it('sets the attributes the stylesheets use, and caches them on the device', () => {
    const root = document.documentElement;
    applyPreferences({ theme: 'dark', expertMode: true, reducedMotion: true, shortcuts: true });
    expect(root.dataset.theme).toBe('dark');
    expect(root.hasAttribute('data-expert')).toBe(true);
    expect(root.hasAttribute('data-reduce-motion')).toBe(true);
    expect(cachedPreferences().theme).toBe('dark');

    applyPreferences(DEFAULT_PREFERENCES);
    expect(root.hasAttribute('data-theme')).toBe(false);
    expect(root.hasAttribute('data-expert')).toBe(false);
  });
});
