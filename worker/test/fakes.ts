import type { Publication } from '@jokeshovel/shared';
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from 'jose';
import { vi } from 'vitest';
import type { Env } from '../src/env';
import { GOOGLE_URLS } from '../src/google';
import type { GoogleConnection, JokeWithTopic, Store } from '../src/store';

export const USER_ID = '11111111-1111-4111-8111-111111111111';
export const OTHER_USER = '22222222-2222-4222-8222-222222222222';
export const JOKE_ID = '7f3c0000-0000-4000-8000-000000000001';

export const baseEnv: Env = {
  SUPABASE_URL: 'https://proj.supabase.co',
  SUPABASE_ANON_KEY: 'anon-key',
  APP_BASE_URL: 'https://jokeshovel.example',
};

export const docsEnv: Env = {
  ...baseEnv,
  FEATURE_DOCS_SYNC: 'true',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
  GOOGLE_INTEGRATION_CLIENT_ID: 'client-id.apps.googleusercontent.com',
  GOOGLE_INTEGRATION_CLIENT_SECRET: 'client-secret',
  TOKEN_ENCRYPTION_KEY: btoa(String.fromCharCode(...new Uint8Array(32).map((_, i) => i * 7))),
  OAUTH_STATE_SIGNING_KEY: 'state-secret-state-secret',
};

export async function makeSigner() {
  const pair = await generateKeyPair('ES256');
  const jwk = { ...(await exportJWK(pair.publicKey)), kid: 'k1', alg: 'ES256' };
  const jwks = createLocalJWKSet({ keys: [jwk] });
  const sign = (sub = USER_ID) =>
    new SignJWT({ email: 'bea@example.com', role: 'authenticated' })
      .setProtectedHeader({ alg: 'ES256', kid: 'k1' })
      .setSubject(sub)
      .setIssuer(`${baseEnv.SUPABASE_URL}/auth/v1`)
      .setAudience('authenticated')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(pair.privateKey);
  return { jwks, sign };
}

export function joke(overrides: Partial<JokeWithTopic> = {}): JokeWithTopic {
  return {
    id: JOKE_ID,
    user_id: USER_ID,
    topic_id: 'aaaaaaaa-0000-4000-8000-000000000001',
    topic_title: 'Airports',
    setup_id: null,
    attempt_id: null,
    title: 'Airports — Flight Layover',
    setup_text: 'My flight had a six-hour layover.',
    punch_text: 'So I did loop-de-loops on the tarmac.',
    target_assumption_text: 'I’m a passenger.',
    connector_text: 'my flight',
    reinterpretation_text: 'the flight I’m piloting',
    second_story_text: 'I’m the pilot.',
    notes: '',
    status: 'complete',
    is_favorite: false,
    rating: null,
    completed_at: '2026-10-27T18:00:00Z',
    created_at: '2026-10-27T18:00:00Z',
    updated_at: '2026-10-27T18:00:00Z',
    archived_at: null,
    deleted_at: null,
    ...overrides,
  };
}

/** An in-memory Store. Jokes are visible only to their owner's token. */
export function memoryStore(tokenOwner: (token: string) => string) {
  const jokes = new Map<string, JokeWithTopic>([[JOKE_ID, joke()]]);
  const publications: Publication[] = [];
  const connections = new Map<string, GoogleConnection>();
  let docsCountOverride: number | null = null;
  const now = () => new Date().toISOString();

  const store: Store = {
    async getJoke(token, id) {
      const j = jokes.get(id);
      return j && !j.deleted_at && j.user_id === tokenOwner(token) ? j : null;
    },
    async findPublication(userId, crid) {
      return publications.find((p) => p.user_id === userId && p.client_request_id === crid) ?? null;
    },
    async insertPublication(row) {
      const p = {
        id: crypto.randomUUID(),
        attempt_count: 1,
        completed_at: null,
        external_id: null,
        external_url: null,
        error_code: null,
        error_message: null,
        include_options: {},
        requested_at: now(),
        created_at: now(),
        updated_at: now(),
        status: 'pending',
        ...row,
      } as Publication;
      publications.push(p);
      return p;
    },
    async updatePublication(id, patch) {
      const p = publications.find((x) => x.id === id)!;
      Object.assign(p, patch, { updated_at: now() });
      return { ...p };
    },
    async countDocsPublishesSince(userId) {
      return docsCountOverride ?? publications.filter((p) => p.user_id === userId && p.method === 'docs_api').length;
    },
    async hasDocsEntry(jokeId, exceptId) {
      return publications.some(
        (p) => p.joke_id === jokeId && p.method === 'docs_api' && p.status === 'succeeded' && p.id !== exceptId,
      );
    },
    async getConnection(userId) {
      const c = connections.get(userId);
      return c ? { ...c } : null;
    },
    async upsertConnection(row) {
      const existing = connections.get(row.user_id);
      connections.set(row.user_id, {
        google_sub: null,
        google_email: null,
        granted_scopes: [],
        status: 'active',
        joke_book_file_id: null,
        connected_at: now(),
        updated_at: now(),
        last_error: null,
        ...existing,
        ...row,
      } as GoogleConnection);
    },
    async updateConnection(userId, patch) {
      const c = connections.get(userId);
      if (c) Object.assign(c, patch);
    },
    async deleteConnection(userId) {
      connections.delete(userId);
    },
  };
  return {
    store,
    jokes,
    publications,
    connections,
    setDocsCount: (n: number) => {
      docsCountOverride = n;
    },
  };
}

type Scripted = number | 'ok';

/**
 * A fake Google: OAuth token endpoint, revoke, and a Docs API that keeps each
 * document's inserted text. Script failures per endpoint with `fail`.
 */
export function fakeGoogle() {
  const docs = new Map<string, { text: string; requests: unknown[] }>();
  const revoked: string[] = [];
  const tokenRequests: URLSearchParams[] = [];
  const script: Record<'refresh' | 'exchange' | 'create' | 'get' | 'batch', Scripted[]> = {
    refresh: [],
    exchange: [],
    create: [],
    get: [],
    batch: [],
  };
  let grantedScope = 'https://www.googleapis.com/auth/drive.file';
  let nextDoc = 1;

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  const scripted = (key: keyof typeof script) => {
    const next = script[key].shift();
    return next === undefined || next === 'ok' ? null : next;
  };

  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';

    if (url === GOOGLE_URLS.token) {
      const form = new URLSearchParams(String(init?.body));
      tokenRequests.push(form);
      if (form.get('grant_type') === 'authorization_code') {
        const fail = scripted('exchange');
        if (fail) return json({ error: 'invalid_request' }, fail);
        return json({ access_token: 'access-1', refresh_token: 'refresh-secret-1', scope: grantedScope });
      }
      const fail = scripted('refresh');
      if (fail === 400)
        return json({ error: 'invalid_grant', error_description: 'Token has been expired or revoked.' }, 400);
      if (fail) return json({ error: 'backend_error' }, fail);
      return json({ access_token: 'access-2', expires_in: 3599 });
    }

    if (url === GOOGLE_URLS.revoke) {
      revoked.push(new URLSearchParams(String(init?.body)).get('token') ?? '');
      return new Response('', { status: 200 });
    }

    if (url === GOOGLE_URLS.docs && method === 'POST') {
      const fail = scripted('create');
      if (fail) return json({ error: { status: 'UNAVAILABLE' } }, fail);
      const id = `doc-${nextDoc++}`;
      docs.set(id, { text: '\n', requests: [] });
      return json({ documentId: id, title: JSON.parse(String(init?.body)).title });
    }

    const match = /^https:\/\/docs\.googleapis\.com\/v1\/documents\/([^/?:]+)(:batchUpdate)?/.exec(url);
    if (match) {
      const doc = docs.get(decodeURIComponent(match[1]));
      if (match[2]) {
        const fail = scripted('batch');
        if (fail) return json({ error: { status: 'UNAVAILABLE' } }, fail);
        if (!doc) return json({ error: { status: 'NOT_FOUND' } }, 404);
        const { requests } = JSON.parse(String(init?.body)) as {
          requests: { insertText?: { location: { index: number }; text: string } }[];
        };
        doc.requests.push(...requests);
        for (const r of requests) {
          if (r.insertText) {
            const i = r.insertText.location.index - 1;
            doc.text = doc.text.slice(0, i) + r.insertText.text + doc.text.slice(i);
          }
        }
        return json({ replies: [] });
      }
      const fail = scripted('get');
      if (fail) return json({ error: { status: 'NOT_FOUND' } }, fail);
      if (!doc) return json({ error: { status: 'NOT_FOUND' } }, 404);
      // Body indexes start at 1 (index 0 is the section break).
      return json({ body: { content: [{ endIndex: 1 }, { endIndex: doc.text.length + 1 }] } });
    }

    return json({ error: `unexpected ${method} ${url}` }, 599);
  });

  return {
    fetch,
    docs,
    revoked,
    tokenRequests,
    fail: (key: keyof typeof script, ...results: Scripted[]) => script[key].push(...results),
    grantScope: (scope: string) => {
      grantedScope = scope;
    },
  };
}
