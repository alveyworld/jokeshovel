/**
 * The few Google endpoints the Docs Joke Book needs: OAuth (code exchange,
 * refresh, revoke) and the Docs API (create a document, append to it).
 * Rate limits and server errors are retried with exponential backoff.
 */

export const GOOGLE_URLS = {
  authorize: 'https://accounts.google.com/o/oauth2/v2/auth',
  token: 'https://oauth2.googleapis.com/token',
  revoke: 'https://oauth2.googleapis.com/revoke',
  docs: 'https://docs.googleapis.com/v1/documents',
};

/** Only files this app creates. Never full Drive, never Keep (docs/DESIGN.md §8.5). */
export const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

export const JOKE_BOOK_TITLE = 'The Joke Shovel — Joke Book';

export class GoogleError extends Error {
  constructor(
    /** HTTP status, or 0 when Google couldn't be reached at all. */
    readonly status: number,
    /** Google's error code ("invalid_grant") or a short label. */
    readonly reason: string,
  ) {
    super(`Google ${status || 'unreachable'}: ${reason}`);
  }

  /** The grant is gone (revoked, expired, or the user removed access). */
  get needsReconnect(): boolean {
    return this.reason === 'invalid_grant' || this.status === 401;
  }

  get retryable(): boolean {
    return this.status === 0 || this.status === 429 || this.status >= 500;
  }
}

export interface GoogleDeps {
  fetch: typeof fetch;
  sleep: (ms: number) => Promise<void>;
}

export interface GoogleClient {
  clientId: string;
  clientSecret: string;
}

/** Up to 3 retries on 429/5xx/network errors: ~0.5 s, 1 s, 2 s plus jitter. */
const RETRIES = 3;
const backoff = (attempt: number) => 500 * 2 ** attempt + Math.random() * 250;

async function call(deps: GoogleDeps, url: string, init: RequestInit): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    let res: Response | null = null;
    try {
      res = await deps.fetch(url, init);
    } catch {
      res = null;
    }
    if (res && res.status !== 429 && res.status < 500) return res;
    if (attempt >= RETRIES) {
      if (res) return res;
      throw new GoogleError(0, 'network');
    }
    await deps.sleep(backoff(attempt));
  }
}

async function errorFrom(res: Response): Promise<GoogleError> {
  let reason = res.statusText || 'error';
  try {
    const body = (await res.json()) as { error?: string | { status?: string; message?: string } };
    if (typeof body.error === 'string') reason = body.error;
    else if (body.error?.status) reason = body.error.status;
  } catch {
    // Not JSON; keep the status text.
  }
  return new GoogleError(res.status, reason);
}

const form = (fields: Record<string, string>) => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams(fields).toString(),
});

export function authorizeUrl(
  client: GoogleClient,
  p: { redirectUri: string; state: string; challenge: string; loginHint?: string | null },
): string {
  const params = new URLSearchParams({
    client_id: client.clientId,
    redirect_uri: p.redirectUri,
    response_type: 'code',
    scope: DRIVE_FILE_SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    code_challenge: p.challenge,
    code_challenge_method: 'S256',
    state: p.state,
  });
  if (p.loginHint) params.set('login_hint', p.loginHint);
  return `${GOOGLE_URLS.authorize}?${params}`;
}

export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  scope?: string;
}

export async function exchangeCode(
  deps: GoogleDeps,
  client: GoogleClient,
  p: { code: string; verifier: string; redirectUri: string },
): Promise<TokenResponse> {
  const res = await call(
    deps,
    GOOGLE_URLS.token,
    form({
      grant_type: 'authorization_code',
      code: p.code,
      code_verifier: p.verifier,
      redirect_uri: p.redirectUri,
      client_id: client.clientId,
      client_secret: client.clientSecret,
    }),
  );
  if (!res.ok) throw await errorFrom(res);
  return (await res.json()) as TokenResponse;
}

export async function refreshAccessToken(
  deps: GoogleDeps,
  client: GoogleClient,
  refreshToken: string,
): Promise<string> {
  const res = await call(
    deps,
    GOOGLE_URLS.token,
    form({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: client.clientId,
      client_secret: client.clientSecret,
    }),
  );
  if (!res.ok) throw await errorFrom(res);
  return ((await res.json()) as TokenResponse).access_token;
}

/** Best effort: a token that's already invalid counts as revoked. */
export async function revokeToken(deps: GoogleDeps, token: string): Promise<boolean> {
  try {
    const res = await call(deps, GOOGLE_URLS.revoke, form({ token }));
    return res.ok || res.status === 400;
  } catch {
    return false;
  }
}

const bearer = (accessToken: string) => ({
  Authorization: `Bearer ${accessToken}`,
  'Content-Type': 'application/json',
});

export async function createJokeBook(deps: GoogleDeps, accessToken: string): Promise<string> {
  const res = await call(deps, GOOGLE_URLS.docs, {
    method: 'POST',
    headers: bearer(accessToken),
    body: JSON.stringify({ title: JOKE_BOOK_TITLE }),
  });
  if (!res.ok) throw await errorFrom(res);
  return ((await res.json()) as { documentId: string }).documentId;
}

/**
 * Appends a heading (the note title) and the note body at the end of the
 * document. Docs indexes count UTF-16 code units, like JavaScript strings.
 */
export async function appendEntry(
  deps: GoogleDeps,
  accessToken: string,
  documentId: string,
  heading: string,
  body: string,
): Promise<void> {
  const url = `${GOOGLE_URLS.docs}/${encodeURIComponent(documentId)}`;
  const doc = await call(deps, `${url}?fields=body.content(endIndex)`, { headers: bearer(accessToken) });
  if (!doc.ok) throw await errorFrom(doc);
  const content = ((await doc.json()) as { body?: { content?: { endIndex?: number }[] } }).body?.content ?? [];
  const end = content.at(-1)?.endIndex ?? 2;

  // Insert before the document's final newline, so the empty last paragraph
  // stays last and every entry lands in order.
  const at = Math.max(1, end - 1);
  const headingLine = `${heading}\n`;
  const text = `${headingLine}${body}\n`;
  const requests = [
    { insertText: { location: { index: at }, text } },
    {
      updateParagraphStyle: {
        range: { startIndex: at, endIndex: at + headingLine.length },
        paragraphStyle: { namedStyleType: 'HEADING_2' },
        fields: 'namedStyleType',
      },
    },
    {
      updateParagraphStyle: {
        range: { startIndex: at + headingLine.length, endIndex: at + text.length },
        paragraphStyle: { namedStyleType: 'NORMAL_TEXT' },
        fields: 'namedStyleType',
      },
    },
  ];
  const res = await call(deps, `${url}:batchUpdate`, {
    method: 'POST',
    headers: bearer(accessToken),
    body: JSON.stringify({ requests }),
  });
  if (!res.ok) throw await errorFrom(res);
}

export const jokeBookUrl = (documentId: string) =>
  `https://docs.google.com/document/d/${encodeURIComponent(documentId)}/edit`;
