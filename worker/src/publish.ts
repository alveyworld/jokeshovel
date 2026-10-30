import { formatNoteBody, isTimeZone, parseInclude, type Publication } from '@jokeshovel/shared';
import type { Hono } from 'hono';
import { importTokenKey, open } from './crypto';
import type { AppEnv } from './env';
import { GoogleError, appendEntry, createJokeBook, jokeBookUrl, refreshAccessToken } from './google';
import { log } from './log';
import type { ErrorCode, Services } from './services';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** publish: 100 a day per user (the per-minute limit is the PUBLISH_LIMITER binding). */
const DAILY_LIMIT = 100;

interface PublishInput {
  title: string;
  include: ReturnType<typeof parseInclude>;
  clientRequestId: string;
  timeZone: string;
  recreateBook: boolean;
}

function parseInput(body: unknown): PublishInput | string {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const title = typeof b.title === 'string' ? b.title.trim() : '';
  if (!title || title.length > 200) return 'A title of 1–200 characters is required.';
  if (typeof b.client_request_id !== 'string' || !UUID.test(b.client_request_id)) {
    return 'client_request_id must be a UUID.';
  }
  return {
    title,
    include: parseInclude(b.include),
    clientRequestId: b.client_request_id.toLowerCase(),
    timeZone: isTimeZone(b.time_zone) ? b.time_zone : 'UTC',
    recreateBook: b.recreate_book === true,
  };
}

/** A failed publish: what the user sees, and the HTTP status. */
interface Failure {
  status: 409 | 502 | 503;
  code: ErrorCode;
  message: string;
}

const FAILURES = {
  reconnect: {
    status: 409,
    code: 'GOOGLE_RECONNECT_REQUIRED',
    message: 'Google access expired. Reconnect to publish.',
  },
  notConnected: {
    status: 409,
    code: 'GOOGLE_RECONNECT_REQUIRED',
    message: 'Connect Google in Settings to publish to your Joke Book.',
  },
  bookMissing: {
    status: 409,
    code: 'JOKE_BOOK_UNREACHABLE',
    message: 'We couldn’t reach your Joke Book doc. Create a new one?',
  },
  busy: { status: 503, code: 'GOOGLE_UNAVAILABLE', message: 'Google is busy right now. Try again in a minute.' },
  rejected: { status: 502, code: 'UPSTREAM_ERROR', message: 'Google turned down the request. Try again later.' },
} satisfies Record<string, Failure>;

export function registerPublish(app: Hono<AppEnv>, svc: Services) {
  /**
   * Publishes a joke to the Google Docs Joke Book (docs/DESIGN.md §9.3).
   * Idempotent on client_request_id: a retry of a finished publish returns
   * it, and a retry of a failed one tries again on the same row.
   */
  app.post('/jokes/:id/publish', async (c) => {
    const env = svc.docsEnv(c);
    if (env instanceof Response) return env;
    const requestId = c.get('requestId');
    const user = c.get('user');
    const jokeId = c.req.param('id');
    if (!UUID.test(jokeId)) return svc.error(c, 404, 'NOT_FOUND', 'Joke not found.');

    const input = parseInput(await c.req.json().catch(() => null));
    if (typeof input === 'string') return svc.error(c, 400, 'VALIDATION_FAILED', input);

    const store = svc.store(env);
    const existing = await store.findPublication(user.id, input.clientRequestId);
    if (existing && existing.joke_id !== jokeId) {
      return svc.error(c, 400, 'VALIDATION_FAILED', 'That request id belongs to another joke.');
    }
    if (existing?.status === 'succeeded') return c.json({ publication: existing });

    const limited = await svc.rateLimit(c, env.PUBLISH_LIMITER);
    if (limited) return limited;
    if (!existing) {
      const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      if ((await store.countDocsPublishesSince(user.id, since)) >= DAILY_LIMIT) {
        return svc.error(c, 429, 'RATE_LIMITED', 'That’s 100 Joke Book entries today. Try again tomorrow.');
      }
    }

    // Read as the caller: RLS guarantees it's their joke.
    const joke = await store.getJoke(user.token, jokeId);
    if (!joke) return svc.error(c, 404, 'NOT_FOUND', 'Joke not found.');
    const body = formatNoteBody(joke, {
      topicTitle: joke.topic_title,
      appBaseUrl: env.APP_BASE_URL,
      include: input.include,
      timeZone: input.timeZone,
    });

    const fields = {
      title: input.title,
      body,
      include_options: { ...input.include },
      error_code: null,
      error_message: null,
    };
    let publication: Publication = existing
      ? await store.updatePublication(existing.id, {
          ...fields,
          status: 'pending',
          attempt_count: existing.attempt_count + 1,
          requested_at: new Date().toISOString(),
        })
      : await store.insertPublication({
          ...fields,
          user_id: user.id,
          joke_id: jokeId,
          client_request_id: input.clientRequestId,
          destination: 'google_docs',
          method: 'docs_api',
          status: 'pending',
        });

    const fail = async (failure: Failure) => {
      publication = await store.updatePublication(publication.id, {
        status: 'failed',
        error_code: failure.code,
        error_message: failure.message,
        completed_at: new Date().toISOString(),
      });
      log('warn', 'docs publish failed', { requestId, code: failure.code });
      return svc.error(c, failure.status, failure.code, failure.message, { publication });
    };

    const connection = await store.getConnection(user.id);
    if (!connection) return fail(FAILURES.notConnected);
    if (connection.status !== 'active') return fail(FAILURES.reconnect);
    const refreshToken = await open(
      await importTokenKey(env.TOKEN_ENCRYPTION_KEY),
      connection.refresh_token_ciphertext,
    );
    if (!refreshToken) {
      // Encrypted with a key that has since been rotated: the user reconnects.
      await store.updateConnection(user.id, { status: 'error', last_error: 'token could not be decrypted' });
      return fail(FAILURES.reconnect);
    }

    let accessToken: string;
    try {
      accessToken = await refreshAccessToken(
        svc.google,
        { clientId: env.GOOGLE_INTEGRATION_CLIENT_ID, clientSecret: env.GOOGLE_INTEGRATION_CLIENT_SECRET },
        refreshToken,
      );
    } catch (err) {
      if (err instanceof GoogleError && err.needsReconnect) {
        await store.updateConnection(user.id, { status: 'revoked', last_error: err.reason });
        return fail(FAILURES.reconnect);
      }
      return fail(err instanceof GoogleError && !err.retryable ? FAILURES.rejected : FAILURES.busy);
    }

    let documentId = input.recreateBook ? null : connection.joke_book_file_id;
    const existingBook = documentId;
    try {
      if (!documentId) {
        documentId = await createJokeBook(svc.google, accessToken);
        await store.updateConnection(user.id, { joke_book_file_id: documentId });
      }
      // Republishing appends a new entry marked "(revised)" (§9.3).
      const revised = await store.hasDocsEntry(jokeId, publication.id);
      await appendEntry(svc.google, accessToken, documentId, revised ? `${input.title} (revised)` : input.title, body);
    } catch (err) {
      if (!(err instanceof GoogleError)) throw err;
      if (err.needsReconnect) {
        await store.updateConnection(user.id, { status: 'revoked', last_error: err.reason });
        return fail(FAILURES.reconnect);
      }
      if ((err.status === 403 || err.status === 404) && existingBook && existingBook === documentId) {
        return fail(FAILURES.bookMissing);
      }
      return fail(err.retryable ? FAILURES.busy : FAILURES.rejected);
    }

    publication = await store.updatePublication(publication.id, {
      status: 'succeeded',
      external_id: documentId,
      external_url: jokeBookUrl(documentId),
      completed_at: new Date().toISOString(),
    });
    log('info', 'docs publish succeeded', { requestId, attempt: publication.attempt_count });
    return c.json({ publication });
  });
}
