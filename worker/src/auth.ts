import { createRemoteJWKSet, decodeProtectedHeader, jwtVerify, type JWTVerifyGetKey } from 'jose';
import type { AuthUser, Env } from './env';

export interface AuthDeps {
  /** Override the JWKS key resolver (tests). */
  jwks?: JWTVerifyGetKey;
  /** Override fetch (tests). */
  fetch?: typeof fetch;
}

const jwksByUrl = new Map<string, JWTVerifyGetKey>();

function remoteJwks(supabaseUrl: string): JWTVerifyGetKey {
  const url = `${supabaseUrl}/auth/v1/.well-known/jwks.json`;
  let jwks = jwksByUrl.get(url);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(url), { cacheMaxAge: 10 * 60 * 1000 });
    jwksByUrl.set(url, jwks);
  }
  return jwks;
}

/**
 * Verifies a Supabase access token.
 *
 * Projects using asymmetric JWT signing keys (ES256/RS256) are verified
 * locally against the project's JWKS. Tokens signed with the legacy shared
 * secret (HS256) cannot be verified without that secret, so they are checked
 * by asking Supabase Auth who the token belongs to.
 */
export async function verifySupabaseToken(token: string, env: Env, deps: AuthDeps = {}): Promise<AuthUser | null> {
  let alg: string | undefined;
  try {
    alg = decodeProtectedHeader(token).alg;
  } catch {
    return null;
  }

  if (alg === 'HS256') {
    const res = await (deps.fetch ?? fetch)(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const user = (await res.json()) as { id?: string; email?: string };
    return user.id ? { id: user.id, email: user.email ?? null, token } : null;
  }

  try {
    const { payload } = await jwtVerify(token, deps.jwks ?? remoteJwks(env.SUPABASE_URL), {
      issuer: `${env.SUPABASE_URL}/auth/v1`,
      audience: 'authenticated',
    });
    if (typeof payload.sub !== 'string') return null;
    const email = typeof payload.email === 'string' ? payload.email : null;
    return { id: payload.sub, email, token };
  } catch {
    return null;
  }
}

export function bearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const match = /^Bearer\s+(\S+)$/i.exec(header);
  return match ? match[1] : null;
}
