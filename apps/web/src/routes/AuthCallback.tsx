import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { takeStoredNext } from '../auth/AuthProvider';
import { safeNext } from '../lib/safeNext';
import { supabase } from '../lib/supabase';

/** Finishes Google sign-in: trades the PKCE code for a session. */
export function AuthCallback() {
  const navigate = useNavigate();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const oauthError = params.get('error_description') ?? params.get('error');
    const next = safeNext(takeStoredNext());
    if (oauthError || !code) {
      navigate(`/signin?error=${encodeURIComponent(oauthError ?? 'Sign-in was cancelled.')}`, { replace: true });
      return;
    }
    void supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
      navigate(error ? `/signin?error=${encodeURIComponent(error.message)}` : next, { replace: true });
    });
  }, [navigate]);

  return (
    <div className="page-center" role="status">
      Signing you in…
    </div>
  );
}
