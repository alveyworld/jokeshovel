import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from 'jose';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';
import type { Env } from '../src/env';

const env: Env = {
  SUPABASE_URL: 'https://proj.supabase.co',
  SUPABASE_ANON_KEY: 'anon-key',
  APP_BASE_URL: 'https://jokeshovel.example',
};
const USER_ID = '11111111-1111-4111-8111-111111111111';

let privateKey: CryptoKey;
let jwks: ReturnType<typeof createLocalJWKSet>;

beforeAll(async () => {
  const pair = await generateKeyPair('ES256');
  privateKey = pair.privateKey;
  const jwk = { ...(await exportJWK(pair.publicKey)), kid: 'k1', alg: 'ES256' };
  jwks = createLocalJWKSet({ keys: [jwk] });
});

function sign(claims: Record<string, unknown> = {}, opts: { iss?: string; aud?: string; exp?: string } = {}) {
  return new SignJWT({ email: 'bea@example.com', role: 'authenticated', ...claims })
    .setProtectedHeader({ alg: 'ES256', kid: 'k1' })
    .setSubject(USER_ID)
    .setIssuer(opts.iss ?? `${env.SUPABASE_URL}/auth/v1`)
    .setAudience(opts.aud ?? 'authenticated')
    .setIssuedAt()
    .setExpirationTime(opts.exp ?? '1h')
    .sign(privateKey);
}

function profileFetch(status = 200) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    void init;
    expect(String(input)).toContain(`/rest/v1/profiles?id=eq.${USER_ID}`);
    return new Response(JSON.stringify([{ id: USER_ID, display_name: 'Bea' }]), { status });
  });
}

describe('GET /api/health', () => {
  it('is public and reports a version', async () => {
    const res = await createApp({ jwks }).request('/api/health', {}, env);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, version: 'dev' });
    expect(res.headers.get('X-Request-Id')).toBeTruthy();
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
  });
});

describe('GET /api/me', () => {
  it('returns 401 without a token', async () => {
    const res = await createApp({ jwks }).request('/api/me', {}, env);
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string; requestId: string } };
    expect(body.error.code).toBe('UNAUTHENTICATED');
    expect(body.error.requestId).toBeTruthy();
  });

  it('returns the user and profile with a valid token, forwarding the token for RLS', async () => {
    const fetch = profileFetch();
    const token = await sign();
    const res = await createApp({ jwks, fetch }).request(
      '/api/me',
      { headers: { Authorization: `Bearer ${token}` } },
      env,
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      user: { id: USER_ID, email: 'bea@example.com' },
      profile: { id: USER_ID, display_name: 'Bea' },
      features: { docsSync: false },
    });
    const headers = fetch.mock.calls[0][1]?.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Bearer ${token}`);
    expect(headers.apikey).toBe('anon-key');
  });

  it.each([
    ['expired', { exp: '-1m' }],
    ['wrong audience', { aud: 'anon' }],
    ['wrong issuer', { iss: 'https://evil.example/auth/v1' }],
  ])('rejects a token with %s', async (_label, opts) => {
    const token = await sign({}, opts);
    const res = await createApp({ jwks, fetch: profileFetch() }).request(
      '/api/me',
      { headers: { Authorization: `Bearer ${token}` } },
      env,
    );
    expect(res.status).toBe(401);
  });

  it('rejects garbage tokens', async () => {
    const res = await createApp({ jwks }).request('/api/me', { headers: { Authorization: 'Bearer not-a-jwt' } }, env);
    expect(res.status).toBe(401);
  });

  it('checks legacy HS256 tokens with Supabase Auth', async () => {
    const hsToken = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(USER_ID)
      .sign(new TextEncoder().encode('legacy-secret-legacy-secret-legacy'));
    const fetch = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith('/auth/v1/user')) {
        return new Response(JSON.stringify({ id: USER_ID, email: 'bea@example.com' }));
      }
      return new Response(JSON.stringify([]));
    });
    const res = await createApp({ jwks, fetch }).request(
      '/api/me',
      { headers: { Authorization: `Bearer ${hsToken}` } },
      env,
    );
    expect(res.status).toBe(200);
    expect(fetch).toHaveBeenCalledWith(`${env.SUPABASE_URL}/auth/v1/user`, expect.anything());
  });

  it('maps a profile fetch failure to 502', async () => {
    const res = await createApp({ jwks, fetch: profileFetch(500) }).request(
      '/api/me',
      { headers: { Authorization: `Bearer ${await sign()}` } },
      env,
    );
    expect(res.status).toBe(502);
  });
});

describe('unknown routes', () => {
  it('returns a JSON 404 for authenticated callers', async () => {
    const res = await createApp({ jwks }).request(
      '/api/nope',
      { headers: { Authorization: `Bearer ${await sign()}` } },
      env,
    );
    expect(res.status).toBe(404);
  });
});
