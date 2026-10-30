import type { Hono } from 'hono';
import { deriveKey, importTokenKey, open, pkcePair, seal } from './crypto';
import type { AppEnv, DocsEnv } from './env';
import { DRIVE_FILE_SCOPE, authorizeUrl, exchangeCode, jokeBookUrl, revokeToken } from './google';
import { log } from './log';
import type { Services } from './services';

/** OAuth state lives 10 minutes (docs/DESIGN.md §8.5). */
const STATE_TTL_SECONDS = 600;

interface StatePayload {
  /** user id */
  u: string;
  /** feature */
  f: 'docs';
  /** PKCE verifier: sealed inside the state, so it never travels in the clear. */
  v: string;
  /** expiry, epoch seconds */
  e: number;
}

const base = (env: DocsEnv) => env.APP_BASE_URL.replace(/\/+$/, '');
const redirectUri = (env: DocsEnv) => `${base(env)}/api/integrations/google/callback`;
const client = (env: DocsEnv) => ({
  clientId: env.GOOGLE_INTEGRATION_CLIENT_ID,
  clientSecret: env.GOOGLE_INTEGRATION_CLIENT_SECRET,
});

/** The public OAuth callback. Registered before the auth middleware: Google redirects here with no bearer token. */
export function registerCallback(app: Hono<AppEnv>, svc: Services) {
  app.get('/integrations/google/callback', async (c) => {
    const back = (result: string) => c.redirect(`${c.env.APP_BASE_URL.replace(/\/+$/, '')}/settings?google=${result}`);
    const env = svc.docsEnv(c);
    if (env instanceof Response) return back('unavailable');
    const requestId = c.get('requestId');

    if (c.req.query('error')) return back('denied');
    const code = c.req.query('code');
    const sealedState = c.req.query('state');
    if (!code || !sealedState) return back('error');

    const raw = await open(await deriveKey(env.OAUTH_STATE_SIGNING_KEY), sealedState);
    const state = raw ? (JSON.parse(raw) as StatePayload) : null;
    if (!state || state.f !== 'docs' || state.e < Date.now() / 1000) return back('expired');

    let tokens;
    try {
      tokens = await exchangeCode(svc.google, client(env), { code, verifier: state.v, redirectUri: redirectUri(env) });
    } catch (err) {
      log('warn', 'google code exchange failed', {
        requestId,
        error: err instanceof Error ? err.message : String(err),
      });
      return back('error');
    }
    const scopes = (tokens.scope ?? '').split(/\s+/).filter(Boolean);
    if (!scopes.includes(DRIVE_FILE_SCOPE)) return back('missing-scope');
    if (!tokens.refresh_token) return back('error');

    const key = await importTokenKey(env.TOKEN_ENCRYPTION_KEY);
    await svc.store(env).upsertConnection({
      user_id: state.u,
      granted_scopes: scopes,
      refresh_token_ciphertext: await seal(key, tokens.refresh_token),
      status: 'active',
      connected_at: new Date().toISOString(),
      last_error: null,
    });
    log('info', 'google connected', { requestId });
    return back('connected');
  });
}

export function registerIntegrations(app: Hono<AppEnv>, svc: Services) {
  // Connection status for Settings. Never includes tokens.
  app.get('/integrations/google', async (c) => {
    if (!svc.docsOn(c)) return c.json({ enabled: false, connected: false });
    const env = svc.docsEnv(c);
    if (env instanceof Response) return env;
    const row = await svc.store(env).getConnection(c.get('user').id);
    return c.json({
      enabled: true,
      connected: row?.status === 'active',
      status: row?.status ?? null,
      scopes: row?.granted_scopes ?? [],
      connectedAt: row?.connected_at ?? null,
      jokeBookUrl: row?.joke_book_file_id ? jokeBookUrl(row.joke_book_file_id) : null,
    });
  });

  // Returns the Google consent URL as JSON: the browser fetches this with its
  // session token, then navigates (a plain navigation can't carry the token).
  app.get('/integrations/google/start', async (c) => {
    const env = svc.docsEnv(c);
    if (env instanceof Response) return env;
    if (c.req.query('feature') !== 'docs') {
      return svc.error(c, 400, 'VALIDATION_FAILED', 'Only the Docs Joke Book can be connected.');
    }
    const limited = await svc.rateLimit(c, env.INTEGRATION_LIMITER);
    if (limited) return limited;

    const user = c.get('user');
    const { verifier, challenge } = await pkcePair();
    const payload: StatePayload = {
      u: user.id,
      f: 'docs',
      v: verifier,
      e: Math.floor(Date.now() / 1000) + STATE_TTL_SECONDS,
    };
    const state = await seal(await deriveKey(env.OAUTH_STATE_SIGNING_KEY), JSON.stringify(payload));
    const url = authorizeUrl(client(env), { redirectUri: redirectUri(env), state, challenge, loginHint: user.email });
    return c.json({ url });
  });

  // Disconnect: revoke at Google, then forget the token.
  app.delete('/integrations/google', async (c) => {
    const env = svc.docsEnv(c);
    if (env instanceof Response) return env;
    const store = svc.store(env);
    const userId = c.get('user').id;
    const row = await store.getConnection(userId);
    if (row) {
      const token = await open(await importTokenKey(env.TOKEN_ENCRYPTION_KEY), row.refresh_token_ciphertext);
      if (token && !(await revokeToken(svc.google, token))) {
        log('warn', 'google revoke failed', { requestId: c.get('requestId') });
      }
      await store.deleteConnection(userId);
    }
    return c.body(null, 204);
  });
}
