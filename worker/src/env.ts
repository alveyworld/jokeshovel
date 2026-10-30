export interface Env {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  APP_BASE_URL: string;
  /** Optional salt for hashing user ids in logs. */
  LOG_SALT?: string;
  /** Set by the deploy workflow to the git SHA. */
  APP_VERSION?: string;
  ASSETS?: Fetcher;

  // Google Docs Joke Book (Phase 4). Off unless FEATURE_DOCS_SYNC is "true"
  // and every secret below is set; see docs/RUNBOOK.md.
  FEATURE_DOCS_SYNC?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  GOOGLE_INTEGRATION_CLIENT_ID?: string;
  GOOGLE_INTEGRATION_CLIENT_SECRET?: string;
  /** 32 random bytes, base64. Encrypts Google refresh tokens at rest. */
  TOKEN_ENCRYPTION_KEY?: string;
  /** Any long random string. Encrypts the OAuth state round trip. */
  OAUTH_STATE_SIGNING_KEY?: string;
  /** Workers Rate Limiting bindings (wrangler.toml); absent in tests. */
  PUBLISH_LIMITER?: RateLimit;
  INTEGRATION_LIMITER?: RateLimit;
}

/** The Env once the Docs integration is known to be configured. */
export type DocsEnv = Env &
  Required<
    Pick<
      Env,
      | 'SUPABASE_SERVICE_ROLE_KEY'
      | 'GOOGLE_INTEGRATION_CLIENT_ID'
      | 'GOOGLE_INTEGRATION_CLIENT_SECRET'
      | 'TOKEN_ENCRYPTION_KEY'
      | 'OAUTH_STATE_SIGNING_KEY'
    >
  >;

const DOCS_SECRETS = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'GOOGLE_INTEGRATION_CLIENT_ID',
  'GOOGLE_INTEGRATION_CLIENT_SECRET',
  'TOKEN_ENCRYPTION_KEY',
  'OAUTH_STATE_SIGNING_KEY',
] as const;

export function docsFlagOn(env: Env): boolean {
  return env.FEATURE_DOCS_SYNC === 'true';
}

/** Secrets the Docs integration needs but doesn't have (names only, never values). */
export function missingDocsSecrets(env: Env): string[] {
  return DOCS_SECRETS.filter((name) => !env[name]);
}

export function docsReady(env: Env): env is DocsEnv {
  return docsFlagOn(env) && missingDocsSecrets(env).length === 0;
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
