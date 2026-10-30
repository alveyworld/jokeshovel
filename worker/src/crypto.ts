/**
 * AES-256-GCM sealing for Google refresh tokens and OAuth state, plus PKCE.
 * Sealed values are "<iv>.<ciphertext>" in base64url; GCM authenticates them,
 * so a tampered value fails to open.
 */

const enc = new TextEncoder();
const dec = new TextDecoder();

export function base64url(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  for (const b of view) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromBase64url(text: string): Uint8Array {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

/** TOKEN_ENCRYPTION_KEY: 32 random bytes, base64 (`openssl rand -base64 32`). */
export async function importTokenKey(base64Key: string): Promise<CryptoKey> {
  const raw = fromBase64url(base64Key.trim());
  if (raw.length !== 32) throw new Error('TOKEN_ENCRYPTION_KEY must be 32 bytes, base64-encoded');
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

/** Any secret string becomes an AES key by hashing it (used for OAuth state). */
export async function deriveKey(secret: string): Promise<CryptoKey> {
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(`jokeshovel-oauth-state:${secret}`));
  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export async function seal(key: CryptoKey, plaintext: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plaintext));
  return `${base64url(iv)}.${base64url(ciphertext)}`;
}

/** Returns null for anything that wasn't sealed with this key. */
export async function open(key: CryptoKey, sealed: string): Promise<string | null> {
  const [iv, data] = sealed.split('.');
  if (!iv || !data) return null;
  try {
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64url(iv) }, key, fromBase64url(data));
    return dec.decode(plaintext);
  } catch {
    return null;
  }
}

export interface PkcePair {
  verifier: string;
  challenge: string;
}

export async function pkcePair(): Promise<PkcePair> {
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)));
  const challenge = base64url(await crypto.subtle.digest('SHA-256', enc.encode(verifier)));
  return { verifier, challenge };
}
