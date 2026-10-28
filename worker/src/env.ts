export interface Env {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  APP_BASE_URL: string;
  /** Optional salt for hashing user ids in logs. */
  LOG_SALT?: string;
  /** Set by the deploy workflow to the git SHA. */
  APP_VERSION?: string;
  ASSETS?: Fetcher;
}

export interface AuthUser {
  id: string;
  email: string | null;
  /** The caller's Supabase access token, forwarded so RLS applies. */
  token: string;
}

export interface AppVariables {
  requestId: string;
  user: AuthUser;
}

export type AppEnv = { Bindings: Env; Variables: AppVariables };
