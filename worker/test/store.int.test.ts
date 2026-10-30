/**
 * restStore against a real local Supabase: the same REST calls the Worker
 * makes in production, with real RLS. Run with `pnpm --filter worker test:int`
 * after `pnpm db:start` (CI passes the keys from `supabase status`).
 */
import { describe, expect, it } from 'vitest';
import type { DocsEnv } from '../src/env';
import { restStore } from '../src/store';

declare const process: { env: Record<string, string | undefined> };

const URL = process.env.SUPABASE_INT_URL;
const ANON = process.env.SUPABASE_INT_ANON_KEY ?? '';
const SERVICE = process.env.SUPABASE_INT_SERVICE_ROLE_KEY ?? '';

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return (await res.json()) as T;
}

/** A fresh confirmed user and their access token. */
async function signUp(): Promise<{ id: string; token: string }> {
  const email = `int-${crypto.randomUUID()}@example.com`;
  const password = 'correct-horse-battery';
  const admin = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json' };
  const user = await json<{ id: string }>(
    await fetch(`${URL}/auth/v1/admin/users`, {
      method: 'POST',
      headers: admin,
      body: JSON.stringify({ email, password, email_confirm: true }),
    }),
  );
  const session = await json<{ access_token: string }>(
    await fetch(`${URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: ANON, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    }),
  );
  return { id: user.id, token: session.access_token };
}

async function asUser<T>(token: string, path: string, body?: unknown): Promise<T> {
  return json<T>(
    await fetch(`${URL}/rest/v1/${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        apikey: ANON,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  );
}

describe.skipIf(!URL)('restStore against local Supabase', () => {
  it('reads jokes as the caller and writes publications and connections with the service role', async () => {
    const env = {
      SUPABASE_URL: URL!,
      SUPABASE_ANON_KEY: ANON,
      SUPABASE_SERVICE_ROLE_KEY: SERVICE,
    } as DocsEnv;
    const store = restStore(env, fetch);
    const alice = await signUp();
    const bob = await signUp();

    // Alice writes and completes a joke.
    const [topic] = await asUser<{ id: string }[]>(alice.token, 'topics', { title: 'Airports' });
    const [setup] = await asUser<{ id: string }[]>(alice.token, 'setups', {
      topic_id: topic.id,
      text: 'My flight had a six-hour layover.',
    });
    const [attempt] = await asUser<{ id: string }[]>(alice.token, 'joke_attempts', {
      setup_id: setup.id,
      punch: 'So I did loop-de-loops on the tarmac.',
    });
    const joke = await asUser<{ id: string }>(alice.token, 'rpc/complete_attempt', {
      p_attempt_id: attempt.id,
      p_title: 'Airports — Flight Layover',
    });

    // Jokes are read with the caller's token: RLS hides Alice's joke from Bob.
    const read = await store.getJoke(alice.token, joke.id);
    expect(read).toMatchObject({
      id: joke.id,
      topic_title: 'Airports',
      setup_text: 'My flight had a six-hour layover.',
    });
    expect(await store.getJoke(bob.token, joke.id)).toBeNull();

    // Publications.
    const crid = crypto.randomUUID();
    const inserted = await store.insertPublication({
      user_id: alice.id,
      joke_id: joke.id,
      client_request_id: crid,
      destination: 'google_docs',
      method: 'docs_api',
      status: 'pending',
      title: 'Airports — Flight Layover — Joke',
      body: 'body',
      include_options: { dateAndLink: true },
    });
    expect(inserted).toMatchObject({ status: 'pending', attempt_count: 1 });
    expect((await store.findPublication(alice.id, crid))?.id).toBe(inserted.id);
    expect(await store.findPublication(bob.id, crid)).toBeNull();
    expect(await store.hasDocsEntry(joke.id, crypto.randomUUID())).toBe(false);

    const updated = await store.updatePublication(inserted.id, {
      status: 'succeeded',
      external_id: 'doc-1',
      completed_at: new Date().toISOString(),
    });
    expect(updated).toMatchObject({ status: 'succeeded', external_id: 'doc-1' });
    expect(await store.hasDocsEntry(joke.id, crypto.randomUUID())).toBe(true);
    expect(await store.hasDocsEntry(joke.id, inserted.id)).toBe(false);
    expect(await store.countDocsPublishesSince(alice.id, new Date(Date.now() - 60_000).toISOString())).toBe(1);

    // The Docs count shows up in Alice's topic stats.
    const [stats] = await asUser<{ published_to_docs_count: number }[]>(
      alice.token,
      `topic_stats?topic_id=eq.${topic.id}&select=published_to_docs_count`,
    );
    expect(stats.published_to_docs_count).toBe(1);

    // Google connections: upsert keeps the Joke Book id, and only the service role can see them.
    await store.upsertConnection({ user_id: alice.id, refresh_token_ciphertext: 'sealed-1', granted_scopes: ['s'] });
    await store.updateConnection(alice.id, { joke_book_file_id: 'doc-1' });
    await store.upsertConnection({ user_id: alice.id, refresh_token_ciphertext: 'sealed-2', status: 'active' });
    expect(await store.getConnection(alice.id)).toMatchObject({
      refresh_token_ciphertext: 'sealed-2',
      joke_book_file_id: 'doc-1',
      status: 'active',
    });
    const direct = await fetch(`${URL}/rest/v1/google_connections?select=*`, {
      headers: { apikey: ANON, Authorization: `Bearer ${alice.token}` },
    });
    expect(direct.ok).toBe(false);

    await store.deleteConnection(alice.id);
    expect(await store.getConnection(alice.id)).toBeNull();
  });
});
