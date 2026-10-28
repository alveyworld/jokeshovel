import { Hono, type Context } from 'hono';
import { secureHeaders } from 'hono/secure-headers';
import { bearerToken, verifySupabaseToken, type AuthDeps } from './auth';
import type { AppEnv } from './env';
import { hashUserId, log } from './log';

export type ErrorCode = 'UNAUTHENTICATED' | 'NOT_FOUND' | 'UPSTREAM_ERROR' | 'INTERNAL';

export function errorResponse(c: Context<AppEnv>, status: 401 | 404 | 500 | 502, code: ErrorCode, message: string) {
  return c.json({ error: { code, message, requestId: c.get('requestId') } }, status);
}

export function createApp(deps: AuthDeps = {}) {
  const app = new Hono<AppEnv>().basePath('/api');
  const doFetch = deps.fetch ?? ((input: RequestInfo | URL, init?: RequestInit) => fetch(input, init));

  app.use('*', async (c, next) => {
    const requestId = crypto.randomUUID();
    c.set('requestId', requestId);
    const started = Date.now();
    await next();
    c.header('X-Request-Id', requestId);
    c.header('Cache-Control', 'no-store');
    const user = c.get('user');
    log('info', 'request', {
      requestId,
      method: c.req.method,
      route: c.req.routePath,
      status: c.res.status,
      durationMs: Date.now() - started,
      userIdHash: user ? await hashUserId(user.id, c.env.LOG_SALT) : undefined,
    });
  });

  app.use('*', secureHeaders({ crossOriginResourcePolicy: 'same-origin' }));

  app.get('/health', (c) => c.json({ ok: true, version: c.env.APP_VERSION ?? 'dev' }));

  // Everything below requires a valid Supabase session.
  app.use('*', async (c, next) => {
    const token = bearerToken(c.req.header('Authorization'));
    const user = token ? await verifySupabaseToken(token, c.env, deps) : null;
    if (!user) return errorResponse(c, 401, 'UNAUTHENTICATED', 'Sign in to continue.');
    c.set('user', user);
    await next();
  });

  app.get('/me', async (c) => {
    const user = c.get('user');
    const res = await doFetch(
      `${c.env.SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=id,display_name,timezone,preferences,last_location`,
      {
        headers: {
          apikey: c.env.SUPABASE_ANON_KEY,
          Authorization: `Bearer ${user.token}`,
          Accept: 'application/json',
        },
      },
    );
    if (!res.ok) {
      log('error', 'profile fetch failed', { requestId: c.get('requestId'), status: res.status });
      return errorResponse(c, 502, 'UPSTREAM_ERROR', 'Could not load your profile. Try again.');
    }
    const rows = (await res.json()) as unknown[];
    return c.json({ user: { id: user.id, email: user.email }, profile: rows[0] ?? null });
  });

  app.notFound((c) => errorResponse(c, 404, 'NOT_FOUND', 'No such API route.'));

  app.onError((err, c) => {
    log('error', 'unhandled error', {
      requestId: c.get('requestId'),
      route: c.req.routePath,
      error: err instanceof Error ? err.message : String(err),
    });
    return errorResponse(c, 500, 'INTERNAL', 'Something went wrong on our side.');
  });

  return app;
}
