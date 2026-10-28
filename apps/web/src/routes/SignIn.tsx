import { useState, type FormEvent } from 'react';
import { Navigate, useSearchParams } from 'react-router';
import { useAuth } from '../auth/AuthProvider';
import { env } from '../lib/env';
import { safeNext } from '../lib/safeNext';

export function SignIn() {
  const { session, signInWithGoogle, signInWithPassword } = useAuth();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const [error, setError] = useState<string | null>(params.get('error'));
  const [busy, setBusy] = useState(false);

  if (session) return <Navigate to={next} replace />;

  const google = async () => {
    setBusy(true);
    const problem = await signInWithGoogle(next);
    if (problem) {
      setError(problem);
      setBusy(false);
    }
  };

  const devSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    const problem = await signInWithPassword(String(form.get('email')), String(form.get('password')));
    setBusy(false);
    if (problem) setError(problem);
  };

  return (
    <main className="signin" id="main">
      <div className="signin__card">
        <p className="signin__logo" aria-hidden="true">
          ⛏
        </p>
        <h1>The Joke Shovel</h1>
        <p className="signin__tagline">Every topic is a dig site. Keep shoveling and you’ll hit a joke.</p>
        {error ? (
          <p className="field__error" role="alert">
            {error}
          </p>
        ) : null}
        <button type="button" className="btn btn--primary btn--large" onClick={google} disabled={busy}>
          Continue with Google
        </button>
        <p className="signin__fine">We only ask Google for your name and email address.</p>

        {env.devLogin ? (
          <form className="dev-login" onSubmit={devSubmit}>
            <h2>Developer sign-in</h2>
            <p className="field__hint">Local development only. Creates the account if it doesn’t exist.</p>
            <label className="field__label" htmlFor="dev-email">
              Email
            </label>
            <input id="dev-email" name="email" type="email" autoComplete="username" required />
            <label className="field__label" htmlFor="dev-password">
              Password
            </label>
            <input
              id="dev-password"
              name="password"
              type="password"
              autoComplete="current-password"
              minLength={6}
              required
            />
            <button type="submit" className="btn" disabled={busy}>
              Sign in with email
            </button>
          </form>
        ) : null}
      </div>
    </main>
  );
}
