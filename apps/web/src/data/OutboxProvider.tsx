import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useUser } from '../auth/AuthProvider';
import { useToast } from '../components/Toasts';
import { idbStorage } from '../lib/outbox/idbStorage';
import { Outbox, type PendingOp } from '../lib/outbox/outbox';
import { supabaseExecutor } from '../lib/outbox/supabaseExecutor';
import { supabase } from '../lib/supabase';
import { newAssociationRow, newSetupRow, newSummaryRow, newTopicRow, type TopicSummary } from './rows';

const OutboxContext = createContext<Outbox | null>(null);

type Row = { id: string };

/** Writes a saved op into the React Query cache so the UI doesn't flicker while it refetches. */
function applyToCache(qc: QueryClient, op: PendingOp, userId: string) {
  const mergeInto = <T extends Row>(list: T[] | undefined) =>
    list?.map((row) => (row.id === op.id ? ({ ...row, ...op.values } as T) : row));

  switch (op.table) {
    case 'topics': {
      qc.setQueryData(['topics', op.id], (old: Row | null | undefined) =>
        old ? { ...old, ...op.values } : op.kind === 'insert' ? newTopicRow(op, userId) : old,
      );
      qc.setQueryData(['topic_stats'], (list: TopicSummary[] | undefined) => {
        if (!list) return list;
        if (list.some((row) => row.id === op.id)) return mergeInto(list);
        return op.kind === 'insert' ? [newSummaryRow(op), ...list] : list;
      });
      break;
    }
    case 'associations':
    case 'setups': {
      qc.setQueriesData({ queryKey: [op.table] }, (list: Row[] | undefined) => mergeInto(list));
      const topicId = op.values.topic_id as string | undefined;
      if (op.kind === 'insert' && topicId) {
        const build = op.table === 'associations' ? newAssociationRow : newSetupRow;
        qc.setQueryData([op.table, topicId], (list: Row[] | undefined) =>
          list && !list.some((row) => row.id === op.id) ? [...list, build(op, userId)] : list,
        );
      }
      break;
    }
    case 'profiles':
      qc.setQueryData(['profile', op.id], (old: Row | null | undefined) => (old ? { ...old, ...op.values } : old));
      break;
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
          for (const table of tables) {
            if (table !== 'profiles') void qc.invalidateQueries({ queryKey: [table] });
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
