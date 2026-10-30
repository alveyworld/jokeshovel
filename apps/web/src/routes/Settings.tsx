import { LIMITS } from '@jokeshovel/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useAuth, useUser } from '../auth/AuthProvider';
import { AutosaveField } from '../components/AutosaveField';
import { Integrations } from '../components/Integrations';
import { useOutbox } from '../data/OutboxProvider';
import { useProfile } from '../data/hooks';

export function Settings() {
  const user = useUser();
  const { signOut } = useAuth();
  const { profile } = useProfile();
  const box = useOutbox();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  const doSignOut = async (scope: 'local' | 'global') => {
    setBusy(true);
    // Never sign out with unsaved work without asking.
    if (!(await box.flushAll())) {
      const ok = window.confirm(
        `${box.size} unsaved change${box.size === 1 ? '' : 's'} couldn’t be saved (are you offline?). Sign out anyway and lose them?`,
      );
      if (!ok) {
        setBusy(false);
        return;
      }
    }
    await box.clear();
    qc.clear();
    await signOut(scope);
  };

  return (
    <div className="page">
      <h1 className="page__title">Settings</h1>

      <section className="card" aria-labelledby="account-heading">
        <h2 id="account-heading">Account</h2>
        <p>
          Signed in as <strong>{user.email}</strong>
        </p>
        {profile ? (
          <AutosaveField
            table="profiles"
            rowId={user.id}
            field="display_name"
            value={profile.display_name ?? ''}
            label="Display name"
            maxLength={LIMITS.displayName}
          />
        ) : null}
        <div className="button-row">
          <button type="button" className="btn" disabled={busy} onClick={() => doSignOut('local')}>
            Sign out
          </button>
          <button type="button" className="btn btn--ghost" disabled={busy} onClick={() => doSignOut('global')}>
            Sign out everywhere
          </button>
        </div>
      </section>

      <Integrations />

      <section className="card" aria-labelledby="about-heading">
        <h2 id="about-heading">About the method</h2>
        <p>
          The Joke Shovel follows the joke-writing process taught in Greg Dean’s{' '}
          <cite>Step by Step to Stand-Up Comedy</cite> and its companion workbook. The app guides the steps; the books
          explain them in depth.
        </p>
        <p className="field__hint">Your material is private. We never sell, share or train on it.</p>
      </section>
    </div>
  );
}
