import { del, get, set } from 'idb-keyval';
import type { OutboxStorage, PendingOp } from './outbox';

/** Persists the outbox in IndexedDB, one key per signed-in user. */
export function idbStorage(userId: string): OutboxStorage {
  const key = `jokeshovel:outbox:${userId}`;
  return {
    async load() {
      try {
        return ((await get(key)) as PendingOp[] | undefined) ?? [];
      } catch {
        return [];
      }
    },
    async save(ops) {
      try {
        if (ops.length) await set(key, ops);
        else await del(key);
      } catch {
        // Private mode or storage blocked: edits still save while online.
      }
    },
    async clear() {
      try {
        await del(key);
      } catch {
        // ignore
      }
    },
  };
}
