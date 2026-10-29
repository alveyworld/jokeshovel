import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useUser } from '../auth/AuthProvider';
import { useToast } from '../components/Toasts';
import { idbStorage } from '../lib/outbox/idbStorage';
import { Outbox, type PendingOp } from '../lib/outbox/outbox';
import { supabaseExecutor } from '../lib/outbox/supabaseExecutor';
import { supabase } from '../lib/supabase';
import { LIST_BUILDERS, LIST_PARENT, SINGLE_BUILDERS, SINGLE_KEY, newSummaryRow, type TopicSummary } from './rows';

const OutboxContext = createContext<Outbox | null>(null);

type Row = { id: string; [key: string]: unknown };

/** Writes a saved op into the React Query cache so the UI doesn't flicker while it refetches. */
function applyToCache(qc: QueryClient, op: PendingOp, userId: string) {
  const mergeInto = (list: unknown) =>
    Array.isArray(list) ? (list as Row[]).map((row) => (row.id === op.id ? { ...row, ...op.values } : row)) : list;

  // Single-row caches, e.g. ['joke_attempt', id].
  if (op.table in SINGLE_KEY) {
    const table = op.table as keyof typeof SINGLE_KEY;
    qc.setQueryData([SINGLE_KEY[table], op.id], (old: Row | null | undefined) =>
      old ? { ...old, ...op.values } : op.kind === 'insert' ? SINGLE_BUILDERS[table](op, userId) : old,
    );
  }

  // Lists keyed by their parent, e.g. ['assumptions', setupId].
  if (op.table in LIST_PARENT) {
    const table = op.table as keyof typeof LIST_PARENT;
    qc.setQueriesData({ queryKey: [table] }, mergeInto);
    const parentId = op.values[LIST_PARENT[table]] as string | undefined;
    if (op.kind === 'insert') {
      const row = LIST_BUILDERS[table](op, userId);
      const append = (list: Row[] | undefined) =>
        list && !list.some((r) => r.id === op.id) ? [...list, row as unknown as Row] : list;
      if (parentId) qc.setQueryData([table, parentId], append);
      // Attempts are also listed per topic (setup cards show their drafts).
      const topicId = op.values.topic_id as string | undefined;
      if (table === 'joke_attempts' && topicId) qc.setQueryData(['joke_attempts', 'topic', topicId], append);
    }
  }

  if (op.table === 'topics') {
    qc.setQueryData(['topic_stats'], (list: TopicSummary[] | undefined) => {
      if (!list) return list;
      if (list.some((row) => row.id === op.id)) return mergeInto(list) as TopicSummary[];
      return op.kind === 'insert' ? [newSummaryRow(op), ...list] : list;
    });
  }

  if (op.table === 'profiles') {
    qc.setQueryData(['profile', op.id], (old: Row | null | undefined) => (old ? { ...old, ...op.values } : old));
  }
}

export function OutboxProvider({ children }: { children: ReactNode }) {
  const user = useUser();
  const qc = useQueryClient();
  const { showToast } = useToast();

  const outbox = useMemo(
    () =>
      new Outbox(idbStorage(user.id), null, {
        onOpSaved: (op) => applyToCache(qc, op, user.id),
        onDrained: (tables) => {
          void qc.invalidateQueries({ queryKey: ['topic_stats'] });
          void qc.invalidateQueries({ queryKey: ['drafts'] });
          if (tables.has('setups') || tables.has('joke_attempts')) void qc.invalidateQueries({ queryKey: ['stats'] });
          for (const table of tables) {
            if (table === 'profiles') continue;
            void qc.invalidateQueries({ queryKey: [table] });
            if (table in SINGLE_KEY)
              void qc.invalidateQueries({ queryKey: [SINGLE_KEY[table as keyof typeof SINGLE_KEY]] });
          }
        },
        onPermanentError: (_op, message) => {
          showToast({ message: `Couldn't save a change: ${message}`, tone: 'error' });
          void qc.invalidateQueries();
        },
      }),
    [user.id, qc, showToast],
  );

  useEffect(() => {
    outbox.setExecutor(supabaseExecutor(supabase as unknown as SupabaseClient));
    void outbox.init();

    const flush = () => outbox.flushSoon();
    const onHidden = () => {
      if (document.visibilityState === 'hidden') outbox.flushSoon();
    };
    const onOnline = () => outbox.retryNow();
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onHidden);
    window.addEventListener('online', onOnline);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onHidden);
      window.removeEventListener('online', onOnline);
      outbox.pause();
    };
  }, [outbox]);

  return <OutboxContext.Provider value={outbox}>{children}</OutboxContext.Provider>;
}

export function useOutbox(): Outbox {
  const box = useContext(OutboxContext);
  if (!box) throw new Error('useOutbox must be used inside <OutboxProvider>');
  return box;
}
