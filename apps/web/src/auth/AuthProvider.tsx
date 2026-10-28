import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';

const NEXT_KEY = 'jokeshovel:next';

interface AuthContextValue {
  session: Session | null;
  loading: boolean;
  signInWithGoogle(next: string): Promise<string | null>;
  signInWithPassword(email: string, password: string): Promise<string | null>;
  signOut(scope: 'local' | 'global'): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setLoading(false);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      loading,
      async signInWithGoogle(next) {
        try {
          sessionStorage.setItem(NEXT_KEY, next);
        } catch {
          // ignore
        }
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          // Login asks only for basic profile scopes; Google integrations are
          // requested separately, later (docs/DESIGN.md §8.5).
          options: { redirectTo: `${window.location.origin}/auth/callback`, scopes: 'openid email profile' },
        });
        return error ? error.message : null;
      },
      async signInWithPassword(email, password) {
        const signIn = await supabase.auth.signInWithPassword({ email, password });
        if (!signIn.error) return null;
        if (!/invalid login credentials/i.test(signIn.error.message)) return signIn.error.message;
        const signUp = await supabase.auth.signUp({ email, password });
        return signUp.error ? signUp.error.message : null;
      },
      async signOut(scope) {
        await supabase.auth.signOut({ scope });
      },
    }),
    [session, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

/** The signed-in user. Only call inside <RequireAuth>. */
export function useUser() {
  const { session } = useAuth();
  if (!session) throw new Error('useUser called without a session');
  return session.user;
}

export function takeStoredNext(): string | null {
  try {
    const next = sessionStorage.getItem(NEXT_KEY);
    sessionStorage.removeItem(NEXT_KEY);
    return next;
  } catch {
    return null;
  }
}
