import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { docsFlagOn, missingDocsSecrets, type AppEnv, type DocsEnv } from './env';
import type { GoogleDeps } from './google';
import { log } from './log';
import { restStore, type Store } from './store';

export type ErrorCode =
  | 'UNAUTHENTICATED'
  | 'NOT_FOUND'
  | 'VALIDATION_FAILED'
  | 'FEATURE_DISABLED'
  | 'NOT_CONFIGURED'
  | 'RATE_LIMITED'
  | 'GOOGLE_RECONNECT_REQUIRED'
  | 'JOKE_BOOK_UNREACHABLE'
  | 'GOOGLE_UNAVAILABLE'
  | 'UPSTREAM_ERROR'
  | 'INTERNAL';

/** The JSON error envelope from docs/DESIGN.md §10.6, plus optional extra fields. */
export function errorResponse(
  c: Context<AppEnv>,
  status: ContentfulStatusCode,
  code: ErrorCode,
  message: string,
  extra: Record<string, unknown> = {},
) {
  return c.json({ error: { code, message, requestId: c.get('requestId') }, ...extra }, status);
}

/** Shared plumbing for route modules, built once per app with its test overrides. */
export interface Services {
  google: GoogleDeps;
  store(env: DocsEnv): Store;
  docsOn(c: Context<AppEnv>): boolean;
  /** The configured Docs env, or the error response to return. */
  docsEnv(c: Context<AppEnv>): DocsEnv | Response;
  rateLimit(c: Context<AppEnv>, limiter: RateLimit | undefined): Promise<Response | null>;
  error: typeof errorResponse;
}

export function createServices(opts: {
  fetch: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  store?: (env: DocsEnv) => Store;
}): Services {
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  return {
    google: { fetch: opts.fetch, sleep },
    store: (env) => opts.store?.(env) ?? restStore(env, opts.fetch),
    docsOn: (c) => docsFlagOn(c.env),
    docsEnv(c) {
      if (!docsFlagOn(c.env)) {
        return errorResponse(c, 404, 'FEATURE_DISABLED', 'The Google Docs Joke Book is turned off.');
      }
      const missing = missingDocsSecrets(c.env);
      if (missing.length) {
        log('error', 'docs integration is missing secrets', { requestId: c.get('requestId'), missing });
        return errorResponse(c, 503, 'NOT_CONFIGURED', 'The Joke Book isn’t set up on this server yet.');
      }
      return c.env as DocsEnv;
    },
    async rateLimit(c, limiter) {
      if (!limiter) return null;
      const { success } = await limiter.limit({ key: c.get('user').id });
      return success ? null : errorResponse(c, 429, 'RATE_LIMITED', 'Too many tries. Wait a minute and try again.');
    },
    error: errorResponse,
  };
}
