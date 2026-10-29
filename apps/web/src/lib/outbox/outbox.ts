/**
 * The outbox makes every edit durable before it reaches the network.
 *
 * - Edits are queued immediately (and persisted to IndexedDB), so closing the
 *   tab or losing the connection never loses work.
 * - A row's creation keeps its place in the queue, so a child row is never
 *   written before its parent. Edits to a row are coalesced into one update
 *   that moves to the back of the queue, so an edit that points at a row
 *   created later (e.g. choosing a new assumption as the target) is written
 *   after that row exists.
 * - Flushing is debounced and strictly sequential. Retryable failures (offline,
 *   5xx, 429, expired token) back off and retry; permanent failures (e.g. a
 *   constraint violation) are dropped and reported so the queue never jams.
 */

export type TableName =
  'profiles' | 'topics' | 'associations' | 'setups' | 'assumptions' | 'joke_attempts' | 'reinterpretations' | 'jokes';
export type OpKind = 'insert' | 'update';
export type Values = Record<string, unknown>;

export interface PendingOp {
  key: string;
  table: TableName;
  id: string;
  kind: OpKind;
  values: Values;
  queuedAt: string;
}

export interface OutboxStorage {
  load(): Promise<PendingOp[]>;
  save(ops: PendingOp[]): Promise<void>;
  clear(): Promise<void>;
}

export type ExecResult = { ok: true } | { ok: false; retryable: boolean; message: string };
export type Executor = (op: PendingOp) => Promise<ExecResult>;

export type SaveState = 'saved' | 'saving' | 'offline' | 'error';

export interface OutboxSnapshot {
  state: SaveState;
  pending: number;
  lastSavedAt: string | null;
  lastError: string | null;
  /** Increments on every change; use it to recompute derived data. */
  version: number;
}

export interface OutboxOptions {
  debounceMs?: number;
  /**
   * How long a saved change stays in pending(). A fetch that started before
   * the save can return after it; keeping the change in the overlay stops that
   * stale response from hiding it until the follow-up refetch arrives.
   */
  recentMs?: number;
  retryDelaysMs?: number[];
  now?: () => Date;
  /** Called after an op is written, before it leaves the pending set. */
  onOpSaved?: (op: PendingOp) => void;
  onPermanentError?: (op: PendingOp, message: string) => void;
  /** Called when the queue empties after writing ops to these tables. */
  onDrained?: (tables: Set<TableName>) => void;
}

const DEFAULT_RETRY_DELAYS = [1000, 2000, 5000, 10000, 30000];

function merge(older: PendingOp, newer: PendingOp): PendingOp {
  return {
    ...older,
    kind: older.kind === 'insert' || newer.kind === 'insert' ? 'insert' : 'update',
    values: { ...older.values, ...newer.values },
  };
}

export class Outbox {
  private queue: PendingOp[] = [];
  private inflight: PendingOp | null = null;
  private executor: Executor | null;
  private listeners = new Set<() => void>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private retryIndex = 0;
  private waitingRetry = false;
  private flushing = false;
  private lastSavedAt: string | null = null;
  private lastError: string | null = null;
  private drainedTables = new Set<TableName>();
  private saveChain: Promise<void> = Promise.resolve();
  private version = 0;
  private snapshot: OutboxSnapshot;
  private readonly debounceMs: number;
  private readonly recentMs: number;
  private recent = new Map<string, { op: PendingOp; at: number }>();
  private readonly retryDelaysMs: number[];
  private readonly now: () => Date;

  constructor(
    private storage: OutboxStorage,
    executor: Executor | null,
    private options: OutboxOptions = {},
  ) {
    this.executor = executor;
    this.debounceMs = options.debounceMs ?? 800;
    this.recentMs = options.recentMs ?? 15_000;
    this.retryDelaysMs = options.retryDelaysMs ?? DEFAULT_RETRY_DELAYS;
    this.now = options.now ?? (() => new Date());
    this.snapshot = this.buildSnapshot();
  }

  /** Restores ops left over from an earlier session and starts replaying them. */
  async init(): Promise<void> {
    const stored = await this.storage.load();
    // Anything already queued in this session is newer than what was stored.
    const current = this.queue;
    this.queue = [];
    for (const op of [...stored, ...current]) this.enqueue(op, false);
    this.changed();
    if (this.queue.length) this.schedule(0);
  }

  insert(table: TableName, id: string, values: Values) {
    this.enqueue(this.makeOp(table, id, 'insert', values));
  }

  update(table: TableName, id: string, values: Values) {
    this.enqueue(this.makeOp(table, id, 'update', values));
  }

  /** Flush as soon as possible (e.g. on blur or when the page is hidden). */
  flushSoon() {
    if (!this.waitingRetry) this.schedule(0);
  }

  /** Retry immediately, skipping any backoff (e.g. the user tapped Retry or came back online). */
  retryNow() {
    this.waitingRetry = false;
    this.retryIndex = 0;
    this.lastError = null;
    this.changed();
    this.schedule(0);
  }

  /** Resolves once the queue is empty or a retryable failure stops the flush. */
  async flushAll(): Promise<void> {
    this.waitingRetry = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    await this.flush();
  }

  setExecutor(executor: Executor | null) {
    this.executor = executor;
    if (executor && this.queue.length) this.schedule(0);
  }

  /**
   * Every change the screen should show on top of fetched rows, merged per row:
   * recently saved first, then in flight, then queued.
   */
  pending(): Map<string, PendingOp> {
    const map = new Map<string, PendingOp>();
    const cutoff = this.now().getTime() - this.recentMs;
    for (const [key, entry] of this.recent) {
      if (entry.at < cutoff) this.recent.delete(key);
    }
    const recent = [...this.recent.values()].map((e) => e.op);
    for (const op of [...recent, ...(this.inflight ? [this.inflight] : []), ...this.queue]) {
      const existing = map.get(op.key);
      map.set(op.key, existing ? merge(existing, op) : op);
    }
    return map;
  }

  get size() {
    return this.queue.length + (this.inflight ? 1 : 0);
  }

  async clear() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.queue = [];
    this.inflight = null;
    this.recent.clear();
    this.waitingRetry = false;
    this.lastError = null;
    await this.saveChain;
    await this.storage.clear();
    this.changed();
  }

  /** Stops writing (e.g. on unmount). Queued ops stay stored for next time. */
  pause() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.executor = null;
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): OutboxSnapshot => this.snapshot;

  // -------------------------------------------------------------------------

  private makeOp(table: TableName, id: string, kind: OpKind, values: Values): PendingOp {
    return { key: `${table}:${id}`, table, id, kind, values, queuedAt: this.now().toISOString() };
  }

  private enqueue(op: PendingOp, notify = true) {
    if (op.kind === 'update') {
      // Fold any queued update for this row into this one and move it to the back.
      const index = this.queue.findIndex((q) => q.key === op.key && q.kind === 'update');
      const merged = index >= 0 ? merge(this.queue.splice(index, 1)[0], op) : op;
      this.queue.push(merged);
    } else {
      const index = this.queue.findIndex((q) => q.key === op.key);
      if (index >= 0) this.queue[index] = merge(this.queue[index], op);
      else this.queue.push(op);
    }
    if (!notify) return;
    this.persist();
    this.changed();
    if (!this.waitingRetry) this.schedule(this.debounceMs);
  }

  private schedule(delay: number) {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, delay);
  }

  private async flush() {
    if (this.flushing || !this.executor) return;
    this.flushing = true;
    try {
      while (this.queue.length && this.executor) {
        const op = this.queue.shift()!;
        this.inflight = op;
        this.changed();
        let result: ExecResult;
        try {
          result = await this.executor(op);
        } catch (err) {
          result = { ok: false, retryable: true, message: err instanceof Error ? err.message : String(err) };
        }
        this.inflight = null;

        if (result.ok) {
          this.retryIndex = 0;
          this.lastError = null;
          this.lastSavedAt = this.now().toISOString();
          const previous = this.recent.get(op.key);
          this.recent.set(op.key, { op: previous ? merge(previous.op, op) : op, at: this.now().getTime() });
          this.drainedTables.add(op.table);
          this.options.onOpSaved?.(op);
          this.persist();
          continue;
        }

        if (result.retryable) {
          // Put it back at the front. Newer edits to the same row stay queued
          // where they are, so they still follow anything they refer to.
          this.queue.unshift(op);
          this.waitingRetry = true;
          const delay = this.retryDelaysMs[Math.min(this.retryIndex, this.retryDelaysMs.length - 1)];
          this.retryIndex += 1;
          this.persist();
          this.changed();
          this.timer = setTimeout(() => {
            this.timer = null;
            this.waitingRetry = false;
            void this.flush();
          }, delay);
          return;
        }

        this.lastError = result.message;
        this.options.onPermanentError?.(op, result.message);
        this.persist();
      }

      if (!this.queue.length && this.drainedTables.size) {
        const tables = this.drainedTables;
        this.drainedTables = new Set();
        this.options.onDrained?.(tables);
      }
    } finally {
      this.flushing = false;
      this.changed();
    }
  }

  private persist() {
    const ops = this.inflight ? [this.inflight, ...this.queue] : [...this.queue];
    this.saveChain = this.saveChain.then(() => this.storage.save(ops)).catch(() => undefined);
  }

  private buildSnapshot(): OutboxSnapshot {
    let state: SaveState;
    if (this.waitingRetry && this.size) state = 'offline';
    else if (this.size) state = 'saving';
    else if (this.lastError) state = 'error';
    else state = 'saved';
    return {
      state,
      pending: this.size,
      lastSavedAt: this.lastSavedAt,
      lastError: this.lastError,
      version: this.version,
    };
  }

  private changed() {
    this.version += 1;
    this.snapshot = this.buildSnapshot();
    for (const listener of this.listeners) listener();
  }
}

export function memoryStorage(initial: PendingOp[] = []): OutboxStorage & { ops: PendingOp[] } {
  const store = {
    ops: initial,
    async load() {
      return store.ops;
    },
    async save(ops: PendingOp[]) {
      store.ops = ops;
    },
    async clear() {
      store.ops = [];
    },
  };
  return store;
}
