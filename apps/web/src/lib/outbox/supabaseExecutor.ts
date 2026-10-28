import type { SupabaseClient } from '@supabase/supabase-js';
import type { Executor } from './outbox';

/** Writes one outbox op to Supabase. Inserts are upserts so retries are idempotent. */
export function supabaseExecutor(client: SupabaseClient): Executor {
  return async (op) => {
    const table = client.from(op.table);
    const { error, status } =
      op.kind === 'insert'
        ? await table.upsert({ id: op.id, ...op.values }, { onConflict: 'id' })
        : await table.update(op.values).eq('id', op.id);
    if (!error) return { ok: true };
    const retryable = status === 0 || status === 401 || status === 408 || status === 429 || status >= 500;
    return { ok: false, retryable, message: error.message };
  };
}
