import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Outbox, memoryStorage, type ExecResult, type PendingOp } from './outbox';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

function recorder(results: ExecResult[] = []) {
  const calls: PendingOp[] = [];
  const executor = vi.fn(async (op: PendingOp) => {
    calls.push(structuredClone(op));
    return results.shift() ?? { ok: true as const };
  });
  return { calls, executor };
}

describe('Outbox', () => {
  it('debounces and coalesces edits to the same row', async () => {
    const { calls, executor } = recorder();
    const box = new Outbox(memoryStorage(), executor, { debounceMs: 800 });
    box.update('setups', 's1', { text: 'M' });
    box.update('setups', 's1', { text: 'My' });
    box.update('setups', 's1', { notes: 'n' });
    expect(box.getSnapshot().state).toBe('saving');
    await vi.advanceTimersByTimeAsync(799);
    expect(executor).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ kind: 'update', values: { text: 'My', notes: 'n' } });
    expect(box.getSnapshot()).toMatchObject({ state: 'saved', pending: 0 });
  });

  it('keeps an insert as an insert when later edits are merged in, and preserves order', async () => {
    const { calls, executor } = recorder();
    const box = new Outbox(memoryStorage(), executor, { debounceMs: 10 });
    box.insert('topics', 't1', { title: 'Air' });
    box.insert('setups', 's1', { topic_id: 't1', text: '' });
    box.update('topics', 't1', { title: 'Airports' });
    await vi.advanceTimersByTimeAsync(10);
    expect(calls.map((c) => [c.key, c.kind, c.values])).toEqual([
      ['topics:t1', 'insert', { title: 'Airports' }],
      ['setups:s1', 'insert', { topic_id: 't1', text: '' }],
    ]);
  });

  it('persists every change so a reload can replay it', async () => {
    const storage = memoryStorage();
    const box = new Outbox(storage, null, { debounceMs: 10 });
    box.update('topics', 't1', { title: 'Airports' });
    await vi.advanceTimersByTimeAsync(0);
    expect(storage.ops).toHaveLength(1);

    const { calls, executor } = recorder();
    const reloaded = new Outbox(storage, executor, { debounceMs: 10 });
    await reloaded.init();
    await vi.advanceTimersByTimeAsync(0);
    expect(calls[0]).toMatchObject({ key: 'topics:t1', values: { title: 'Airports' } });
    await vi.advanceTimersByTimeAsync(0);
    expect(storage.ops).toEqual([]);
  });

  it('backs off on retryable failures, shows offline, then succeeds with merged newer edits', async () => {
    const { calls, executor } = recorder([{ ok: false, retryable: true, message: 'Failed to fetch' }]);
    const box = new Outbox(memoryStorage(), executor, { debounceMs: 10, retryDelaysMs: [1000] });
    box.update('setups', 's1', { text: 'one' });
    await vi.advanceTimersByTimeAsync(10);
    expect(box.getSnapshot().state).toBe('offline');
    box.update('setups', 's1', { text: 'two' });
    await vi.advanceTimersByTimeAsync(999);
    expect(calls).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(calls).toHaveLength(2);
    expect(calls[1].values).toEqual({ text: 'two' });
    expect(box.getSnapshot().state).toBe('saved');
  });

  it('does not lose an edit made while the same row is in flight', async () => {
    let release!: (r: ExecResult) => void;
    const calls: PendingOp[] = [];
    const executor = vi.fn((op: PendingOp) => {
      calls.push(structuredClone(op));
      if (calls.length === 1) return new Promise<ExecResult>((r) => (release = r));
      return Promise.resolve({ ok: true } as ExecResult);
    });
    const box = new Outbox(memoryStorage(), executor, { debounceMs: 10 });
    box.update('setups', 's1', { text: 'first' });
    await vi.advanceTimersByTimeAsync(10);
    box.update('setups', 's1', { text: 'second' });
    expect(box.pending().get('setups:s1')?.values).toEqual({ text: 'second' });
    release({ ok: true });
    await vi.advanceTimersByTimeAsync(10);
    expect(calls.map((c) => c.values.text)).toEqual(['first', 'second']);
  });

  it('drops permanent failures, reports them, and keeps going', async () => {
    const onPermanentError = vi.fn();
    const { calls, executor } = recorder([{ ok: false, retryable: false, message: 'violates check constraint' }]);
    const box = new Outbox(memoryStorage(), executor, { debounceMs: 10, onPermanentError });
    box.update('topics', 't1', { title: '' });
    box.update('topics', 't2', { title: 'Dentists' });
    await vi.advanceTimersByTimeAsync(10);
    expect(calls).toHaveLength(2);
    expect(onPermanentError).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'topics:t1' }),
      'violates check constraint',
    );
    expect(box.getSnapshot().state).toBe('saved');
  });

  it('reports drained tables and saved ops', async () => {
    const onDrained = vi.fn();
    const onOpSaved = vi.fn();
    const { executor } = recorder();
    const box = new Outbox(memoryStorage(), executor, { debounceMs: 10, onDrained, onOpSaved });
    box.insert('associations', 'a1', { topic_id: 't1', text: 'TSA' });
    box.update('topics', 't1', { title: 'Airports' });
    await vi.advanceTimersByTimeAsync(10);
    expect(onOpSaved).toHaveBeenCalledTimes(2);
    expect(onDrained).toHaveBeenCalledWith(new Set(['associations', 'topics']));
  });

  it('waits for an executor before flushing (signed out)', async () => {
    const box = new Outbox(memoryStorage(), null, { debounceMs: 10 });
    box.update('topics', 't1', { title: 'x' });
    await vi.advanceTimersByTimeAsync(100);
    expect(box.size).toBe(1);
    const { calls, executor } = recorder();
    box.setExecutor(executor);
    await vi.advanceTimersByTimeAsync(0);
    expect(calls).toHaveLength(1);
  });

  it('flushAll writes everything immediately', async () => {
    const { calls, executor } = recorder();
    const box = new Outbox(memoryStorage(), executor, { debounceMs: 10_000 });
    box.update('topics', 't1', { title: 'x' });
    await box.flushAll();
    expect(calls).toHaveLength(1);
  });
});
