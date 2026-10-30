import { formatNoteBody, DEFAULT_INCLUDE } from '@jokeshovel/shared';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { base64url, deriveKey, importTokenKey, open, seal } from '../src/crypto';
import type { Env } from '../src/env';
import { DRIVE_FILE_SCOPE } from '../src/google';
import { JOKE_ID, OTHER_USER, USER_ID, baseEnv, docsEnv, fakeGoogle, makeSigner, memoryStore } from './fakes';

let signer: Awaited<ReturnType<typeof makeSigner>>;
let token: string;
let otherToken: string;

beforeAll(async () => {
  signer = await makeSigner();
  token = await signer.sign(USER_ID);
  otherToken = await signer.sign(OTHER_USER);
});

let google: ReturnType<typeof fakeGoogle>;
let db: ReturnType<typeof memoryStore>;
let sleeps: number[];

beforeEach(() => {
  google = fakeGoogle();
  db = memoryStore((t) => (t === token ? USER_ID : OTHER_USER));
  sleeps = [];
});

function app() {
  return createApp({
    jwks: signer.jwks,
    fetch: google.fetch,
    store: () => db.store,
    sleep: async (ms) => {
      sleeps.push(ms);
    },
  });
}

function call(path: string, init: RequestInit = {}, env: Env = docsEnv, as = token) {
  return app().request(
    path,
    { ...init, headers: { Authorization: `Bearer ${as}`, 'Content-Type': 'application/json', ...init.headers } },
    env,
  );
}

async function connect() {
  const key = await importTokenKey(docsEnv.TOKEN_ENCRYPTION_KEY!);
  await db.store.upsertConnection({
    user_id: USER_ID,
    granted_scopes: [DRIVE_FILE_SCOPE],
    refresh_token_ciphertext: await seal(key, 'refresh-secret-1'),
    status: 'active',
  });
}

const publish = (body: Record<string, unknown>, as = token) =>
  call(`/api/jokes/${JOKE_ID}/publish`, { method: 'POST', body: JSON.stringify(body) }, docsEnv, as);

const request = (overrides: Record<string, unknown> = {}) => ({
  title: 'Airports — Flight Layover — Joke',
  include: { ...DEFAULT_INCLUDE, target: true },
  client_request_id: crypto.randomUUID(),
  time_zone: 'America/Chicago',
  ...overrides,
});

describe('crypto', () => {
  it('round-trips sealed text and rejects tampering or the wrong key', async () => {
    const key = await importTokenKey(docsEnv.TOKEN_ENCRYPTION_KEY!);
    const sealed = await seal(key, 'refresh-secret');
    expect(sealed).not.toContain('refresh-secret');
    expect(await open(key, sealed)).toBe('refresh-secret');
    const [iv, data] = sealed.split('.');
    expect(await open(key, `${iv}.${data.slice(0, -2)}AA`)).toBeNull();
    expect(await open(await deriveKey('other'), sealed)).toBeNull();
    await expect(importTokenKey(base64url(new Uint8Array(16)))).rejects.toThrow('32 bytes');
  });
});

describe('feature flag', () => {
  it('is off by default: Settings hides it and the routes are disabled', async () => {
    const status = await call('/api/integrations/google', {}, baseEnv);
    expect(await status.json()).toEqual({ enabled: false, connected: false });
    const start = await call('/api/integrations/google/start?feature=docs', {}, baseEnv);
    expect(start.status).toBe(404);
    expect(((await start.json()) as { error: { code: string } }).error.code).toBe('FEATURE_DISABLED');
    const off = await call(
      `/api/jokes/${JOKE_ID}/publish`,
      { method: 'POST', body: JSON.stringify(request()) },
      baseEnv,
    );
    expect(off.status).toBe(404);
  });

  it('reports a missing secret as not configured, without naming its value', async () => {
    const env = { ...docsEnv, GOOGLE_INTEGRATION_CLIENT_SECRET: undefined };
    const res = await call('/api/integrations/google/start?feature=docs', {}, env);
    expect(res.status).toBe(503);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('NOT_CONFIGURED');
  });
});

describe('connecting Google (AC-27)', () => {
  it('asks for only the drive.file scope, offline, with PKCE and a sealed state', async () => {
    const res = await call('/api/integrations/google/start?feature=docs');
    expect(res.status).toBe(200);
    const url = new URL(((await res.json()) as { url: string }).url);
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    const p = url.searchParams;
    expect(p.get('scope')).toBe(DRIVE_FILE_SCOPE);
    expect(p.get('access_type')).toBe('offline');
    expect(p.get('prompt')).toBe('consent');
    expect(p.get('code_challenge_method')).toBe('S256');
    expect(p.get('login_hint')).toBe('bea@example.com');
    expect(p.get('redirect_uri')).toBe('https://jokeshovel.example/api/integrations/google/callback');
    expect(p.get('state')).not.toContain(USER_ID);
  });

  it('rejects other features (there is no Keep scope)', async () => {
    expect((await call('/api/integrations/google/start?feature=keep')).status).toBe(400);
  });

  it('finishes on the callback: verifies PKCE, stores the token encrypted, and returns to Settings', async () => {
    const start = await call('/api/integrations/google/start?feature=docs');
    const authUrl = new URL(((await start.json()) as { url: string }).url);
    const state = authUrl.searchParams.get('state')!;

    const res = await app().request(
      `/api/integrations/google/callback?code=auth-code&state=${encodeURIComponent(state)}`,
      {},
      docsEnv,
    );
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('https://jokeshovel.example/settings?google=connected');

    const exchange = google.tokenRequests[0];
    expect(exchange.get('code')).toBe('auth-code');
    const verifier = exchange.get('code_verifier')!;
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
    expect(base64url(digest)).toBe(authUrl.searchParams.get('code_challenge'));

    const row = db.connections.get(USER_ID)!;
    expect(row.status).toBe('active');
    expect(row.granted_scopes).toEqual([DRIVE_FILE_SCOPE]);
    expect(row.refresh_token_ciphertext).not.toContain('refresh-secret-1');
    expect(await open(await importTokenKey(docsEnv.TOKEN_ENCRYPTION_KEY!), row.refresh_token_ciphertext)).toBe(
      'refresh-secret-1',
    );

    const status = (await (await call('/api/integrations/google')).json()) as Record<string, unknown>;
    expect(status).toMatchObject({ enabled: true, connected: true, scopes: [DRIVE_FILE_SCOPE] });
    expect(JSON.stringify(status)).not.toContain(row.refresh_token_ciphertext);
  });

  it('sends the user back with a reason when the callback can’t finish', async () => {
    const back = async (query: string) =>
      (await app().request(`/api/integrations/google/callback?${query}`, {}, docsEnv)).headers.get('Location');
    expect(await back('error=access_denied')).toMatch(/google=denied$/);
    expect(await back('code=c&state=forged.state')).toMatch(/google=expired$/);

    const key = await deriveKey(docsEnv.OAUTH_STATE_SIGNING_KEY!);
    const old = await seal(key, JSON.stringify({ u: USER_ID, f: 'docs', v: 'verifier', e: Date.now() / 1000 - 1 }));
    expect(await back(`code=c&state=${encodeURIComponent(old)}`)).toMatch(/google=expired$/);

    google.grantScope('openid');
    const fresh = await seal(key, JSON.stringify({ u: USER_ID, f: 'docs', v: 'verifier', e: Date.now() / 1000 + 60 }));
    expect(await back(`code=c&state=${encodeURIComponent(fresh)}`)).toMatch(/google=missing-scope$/);
    expect(db.connections.size).toBe(0);
  });

  it('disconnecting revokes the token at Google and deletes the row', async () => {
    await connect();
    const res = await call('/api/integrations/google', { method: 'DELETE' });
    expect(res.status).toBe(204);
    expect(google.revoked).toEqual(['refresh-secret-1']);
    expect(db.connections.size).toBe(0);
  });
});

describe('publishing to the Joke Book', () => {
  it('creates the Joke Book, appends a heading and the note body, and records success', async () => {
    await connect();
    const body = request();
    const res = await publish(body);
    expect(res.status).toBe(200);
    const { publication } = (await res.json()) as { publication: Record<string, unknown> };
    expect(publication).toMatchObject({
      status: 'succeeded',
      destination: 'google_docs',
      method: 'docs_api',
      external_id: 'doc-1',
      external_url: 'https://docs.google.com/document/d/doc-1/edit',
      title: 'Airports — Flight Layover — Joke',
    });

    const expectedBody = formatNoteBody(db.jokes.get(JOKE_ID)!, {
      topicTitle: 'Airports',
      appBaseUrl: docsEnv.APP_BASE_URL,
      include: body.include,
      timeZone: 'America/Chicago',
    });
    expect(publication.body).toBe(expectedBody);
    expect(google.docs.get('doc-1')!.text).toBe(`Airports — Flight Layover — Joke\n${expectedBody}\n\n`);
    expect(db.connections.get(USER_ID)!.joke_book_file_id).toBe('doc-1');

    const [, heading] = google.docs.get('doc-1')!.requests as {
      updateParagraphStyle: { range: { startIndex: number; endIndex: number } };
    }[];
    expect(heading.updateParagraphStyle.range).toEqual({
      startIndex: 1,
      endIndex: 1 + 'Airports — Flight Layover — Joke\n'.length,
    });
  });

  it('is idempotent: retrying a finished publish returns it without calling Google again', async () => {
    await connect();
    const body = request();
    await publish(body);
    const calls = google.fetch.mock.calls.length;
    const again = (await (await publish(body)).json()) as { publication: { id: string } };
    expect(again.publication.id).toBe(db.publications[0].id);
    expect(google.fetch.mock.calls.length).toBe(calls);
    expect(db.publications).toHaveLength(1);
  });

  it('marks a republished joke "(revised)" in the same doc', async () => {
    await connect();
    await publish(request());
    await publish(request({ title: 'Pilot bit — Joke' }));
    expect(google.docs.size).toBe(1);
    expect(google.docs.get('doc-1')!.text).toContain('Pilot bit — Joke (revised)\n');
  });

  it('asks to reconnect when Google says the grant is gone (AC-26)', async () => {
    await connect();
    google.fail('refresh', 400);
    const res = await publish(request());
    expect(res.status).toBe(409);
    const out = (await res.json()) as {
      error: { code: string; message: string };
      publication: Record<string, unknown>;
    };
    expect(out.error).toMatchObject({
      code: 'GOOGLE_RECONNECT_REQUIRED',
      message: 'Google access expired. Reconnect to publish.',
    });
    expect(out.publication).toMatchObject({ status: 'failed', error_code: 'GOOGLE_RECONNECT_REQUIRED' });
    expect(db.connections.get(USER_ID)!.status).toBe('revoked');

    // A revoked connection fails fast, without calling Google.
    const calls = google.fetch.mock.calls.length;
    expect((await publish(request())).status).toBe(409);
    expect(google.fetch.mock.calls.length).toBe(calls);
  });

  it('asks to connect when there is no connection yet', async () => {
    const out = (await (await publish(request())).json()) as { error: { code: string; message: string } };
    expect(out.error.code).toBe('GOOGLE_RECONNECT_REQUIRED');
    expect(out.error.message).toMatch(/Connect Google/);
  });

  it('offers a new Joke Book when the old one is gone, and the retry reuses the same row', async () => {
    await connect();
    await db.store.updateConnection(USER_ID, { joke_book_file_id: 'deleted-doc' });
    const body = request();
    const res = await publish(body);
    expect(res.status).toBe(409);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('JOKE_BOOK_UNREACHABLE');

    const retry = await publish({ ...body, recreate_book: true });
    expect(retry.status).toBe(200);
    const { publication } = (await retry.json()) as { publication: Record<string, unknown> };
    expect(publication).toMatchObject({
      status: 'succeeded',
      external_id: 'doc-1',
      attempt_count: 2,
      error_code: null,
    });
    expect(db.publications).toHaveLength(1);
    expect(db.connections.get(USER_ID)!.joke_book_file_id).toBe('doc-1');
  });

  it('retries a busy Google with backoff, then succeeds', async () => {
    await connect();
    google.fail('batch', 503, 429);
    const res = await publish(request());
    expect(res.status).toBe(200);
    expect(sleeps).toHaveLength(2);
    expect(sleeps[1]).toBeGreaterThan(sleeps[0]);
  });

  it('gives up after three retries and offers Retry', async () => {
    await connect();
    google.fail('batch', 503, 503, 503, 503);
    const res = await publish(request());
    expect(res.status).toBe(503);
    const out = (await res.json()) as { error: { code: string }; publication: { status: string } };
    expect(out.error.code).toBe('GOOGLE_UNAVAILABLE');
    expect(out.publication.status).toBe('failed');
    expect(sleeps).toHaveLength(3);
  });

  it('never publishes someone else’s joke', async () => {
    await connect();
    const res = await publish(request(), otherToken);
    expect(res.status).toBe(404);
    expect(db.publications).toHaveLength(0);
  });

  it('won’t reuse another joke’s request id', async () => {
    await connect();
    const body = request();
    await publish(body);
    db.jokes.set('7f3c0000-0000-4000-8000-000000000002', {
      ...db.jokes.get(JOKE_ID)!,
      id: '7f3c0000-0000-4000-8000-000000000002',
    });
    const res = await call('/api/jokes/7f3c0000-0000-4000-8000-000000000002/publish', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    expect(res.status).toBe(400);
  });

  it('validates input', async () => {
    expect((await publish(request({ title: '  ' }))).status).toBe(400);
    expect((await publish(request({ client_request_id: 'nope' }))).status).toBe(400);
  });

  it('limits publishes per minute and per day', async () => {
    await connect();
    db.setDocsCount(100);
    const daily = await publish(request());
    expect(daily.status).toBe(429);

    db.setDocsCount(0);
    const limiter = { limit: async () => ({ success: false }) } as unknown as RateLimit;
    const res = await call(
      `/api/jokes/${JOKE_ID}/publish`,
      { method: 'POST', body: JSON.stringify(request()) },
      { ...docsEnv, PUBLISH_LIMITER: limiter },
    );
    expect(res.status).toBe(429);
  });
});

describe('/api/me', () => {
  it('reports the Docs feature only when it is on and configured', async () => {
    const meFetch = async () => new Response(JSON.stringify([{ id: USER_ID }]));
    const me = async (env: Env) => {
      const res = await createApp({ jwks: signer.jwks, fetch: meFetch }).request(
        '/api/me',
        { headers: { Authorization: `Bearer ${token}` } },
        env,
      );
      return ((await res.json()) as { features: { docsSync: boolean } }).features.docsSync;
    };
    expect(await me(baseEnv)).toBe(false);
    expect(await me(docsEnv)).toBe(true);
    expect(await me({ ...docsEnv, TOKEN_ENCRYPTION_KEY: undefined })).toBe(false);
  });
});
