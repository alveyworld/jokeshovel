import { useCallback, useMemo } from 'react';
import { useUser } from '../auth/AuthProvider';
import { cachedPreferences, parsePreferences, type Preferences } from '../lib/preferences';
import { useMutations, useProfile } from './hooks';

/** The user's display preferences, and a setter that autosaves to the profile. */
export function usePreferences() {
  const user = useUser();
  const { profile } = useProfile();
  const { update } = useMutations();
  const raw = profile?.preferences as Record<string, unknown> | null | undefined;
  // Before the profile loads, use this device's copy so nothing flickers.
  const prefs = useMemo(() => (profile ? parsePreferences(raw) : cachedPreferences()), [profile, raw]);
  const setPreference = useCallback(
    <K extends keyof Preferences>(key: K, value: Preferences[K]) => {
      // Keep other keys (e.g. the Publish sheet's remembered sections).
      update('profiles', user.id, { preferences: { ...(raw ?? {}), [key]: value } });
    },
    [update, user.id, raw],
  );
  return { prefs, setPreference };
}
