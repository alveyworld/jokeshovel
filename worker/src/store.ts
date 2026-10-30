import type { Database, Joke, Publication } from '@jokeshovel/shared';
import type { DocsEnv } from './env';

type Tables = Database['public']['Tables'];
export type GoogleConnection = Tables['google_connections']['Row'];
export type NewGoogleConnection = Tables['google_connections']['Insert'];
export type GoogleConnectionPatch = Tables['google_connections']['Update'];
export type NewPublication = Tables['publications']['Insert'];
export type PublicationPatch = Tables['publications']['Update'];
export type JokeWithTopic = Joke & { topic_title: string };

/** Everything the Docs integration reads and writes. */
export interface Store {
  /** The caller's joke, read with their own token so RLS decides. */
  getJoke(userToken: string, jokeId: string): Promise<JokeWithTopic | null>;
  findPublication(userId: string, clientRequestId: string): Promise<Publication | null>;
  insertPublication(row: NewPublication): Promise<Publication>;
  updatePublication(id: string, patch: PublicationPatch): Promise<Publication>;
  countDocsPublishesSince(userId: string, sinceIso: string): Promise<number>;
  /** Whether the joke already has a successful Joke Book entry (other than `exceptId`). */
  hasDocsEntry(jokeId: string, exceptId: string): Promise<boolean>;
  getConnection(userId: string): Promise<GoogleConnection | null>;
  upsertConnection(row: NewGoogleConnection): Promise<void>;
  updateConnection(userId: string, patch: GoogleConnectionPatch): Promise<void>;
  deleteConnection(userId: string): Promise<void>;
}

export class RestError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Store backed by Supabase's REST API. Publications and Google connections
 * use the service role (google_connections has no client policies at all);
 * jokes are read as the caller.
 */
export function restStore(env: DocsEnv, doFetch: typeof fetch): Store {
  const q = encodeURIComponent;

  async function rest<T>(path: string, init: RequestInit = {}, userToken?: string): Promise<T> {
    const key = userToken ? env.SUPABASE_ANON_KEY : env.SUPABASE_SERVICE_ROLE_KEY;
    const res = await doFetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
      ...init,
      headers: {
        apikey: key,
        Authorization: `Bearer ${userToken ?? env.SUPABASE_SERVICE_ROLE_KEY}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(init.headers as Record<string, string> | undefined),
      },
    });
    if (!res.ok)
      throw new RestError(res.status, `${init.method ?? 'GET'} ${path.split('?')[0]} failed (${res.status})`);
    if (res.status === 204 || res.headers.get('Content-Length') === '0') return null as T;
    const text = await res.text();
    return (text ? JSON.parse(text) : null) as T;
  }

  const returning = { Prefer: 'return=representation' };

  return {
    async getJoke(userToken, jokeId) {
      const rows = await rest<(Joke & { topics: { title: string } | null })[]>(
        `jokes?id=eq.${q(jokeId)}&deleted_at=is.null&select=*,topics(title)`,
        {},
        userToken,
      );
      if (!rows[0]) return null;
      const { topics, ...joke } = rows[0];
      return { ...joke, topic_title: topics?.title ?? '' };
    },
    async findPublication(userId, clientRequestId) {
      const rows = await rest<Publication[]>(
        `publications?user_id=eq.${q(userId)}&client_request_id=eq.${q(clientRequestId)}&select=*`,
      );
      return rows[0] ?? null;
    },
    async insertPublication(row) {
      const rows = await rest<Publication[]>('publications', {
        method: 'POST',
        body: JSON.stringify(row),
        headers: returning,
      });
      return rows[0];
    },
    async updatePublication(id, patch) {
      const rows = await rest<Publication[]>(`publications?id=eq.${q(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
        headers: returning,
      });
      return rows[0];
    },
    async countDocsPublishesSince(userId, sinceIso) {
      const rows = await rest<unknown[]>(
        `publications?user_id=eq.${q(userId)}&method=eq.docs_api&created_at=gte.${q(sinceIso)}&select=id&limit=1000`,
      );
      return rows.length;
    },
    async hasDocsEntry(jokeId, exceptId) {
      const rows = await rest<unknown[]>(
        `publications?joke_id=eq.${q(jokeId)}&method=eq.docs_api&status=eq.succeeded&id=neq.${q(exceptId)}&select=id&limit=1`,
      );
      return rows.length > 0;
    },
    async getConnection(userId) {
      const rows = await rest<GoogleConnection[]>(`google_connections?user_id=eq.${q(userId)}&select=*`);
      return rows[0] ?? null;
    },
    async upsertConnection(row) {
      await rest('google_connections?on_conflict=user_id', {
        method: 'POST',
        body: JSON.stringify(row),
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      });
    },
    async updateConnection(userId, patch) {
      await rest(`google_connections?user_id=eq.${q(userId)}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
        headers: { Prefer: 'return=minimal' },
      });
    },
    async deleteConnection(userId) {
      await rest(`google_connections?user_id=eq.${q(userId)}`, {
        method: 'DELETE',
        headers: { Prefer: 'return=minimal' },
      });
    },
  };
}
