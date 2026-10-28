import type { PendingOp, TableName } from './outbox/outbox';

/**
 * Shows unsaved edits on top of rows loaded from the server, and adds rows
 * that were created locally but haven't reached the server yet. `newRow`
 * builds a full row from a pending insert, or returns null if the row doesn't
 * belong in this list (e.g. it's under another topic).
 */
export function overlay<T extends { id: string }>(
  rows: readonly T[] | null | undefined,
  pending: Map<string, PendingOp>,
  table: TableName,
  newRow: (op: PendingOp) => T | null,
): T[] {
  const list = rows ?? [];
  const out = list.map((row) => {
    const op = pending.get(`${table}:${row.id}`);
    return op ? ({ ...row, ...op.values } as T) : row;
  });
  const seen = new Set(list.map((row) => row.id));
  for (const op of pending.values()) {
    if (op.table !== table || op.kind !== 'insert' || seen.has(op.id)) continue;
    const row = newRow(op);
    if (row) out.push(row);
  }
  return out;
}
