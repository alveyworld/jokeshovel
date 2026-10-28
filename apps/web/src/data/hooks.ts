import type { Association, LastLocation, Profile, Setup, Topic } from '@jokeshovel/shared';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { useUser } from '../auth/AuthProvider';
import type { TableName, Values } from '../lib/outbox/outbox';
import { overlay } from '../lib/overlay';
import { supabase } from '../lib/supabase';
import { useOutbox } from './OutboxProvider';
import { newAssociationRow, newSetupRow, newSummaryRow, newTopicRow, nextSortOrder, type TopicSummary } from './rows';

function unwrap<T>({ data, error }: { data: T; error: { message: string } | null }): T {
  if (error) throw new Error(error.message);
  return data;
}

export function useSaveState() {
  const box = useOutbox();
  return useSyncExternalStore(box.subscribe, box.getSnapshot);
}

/** Unsaved changes, recomputed whenever the outbox changes. */
export function usePending() {
  const box = useOutbox();
  const { version } = useSaveState();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => box.pending(), [box, version]);
}

const isLive = (row: { deleted_at?: string | null }) => !row.deleted_at;

// ---------------------------------------------------------------------------
// Queries (server rows + unsaved local changes)
// ---------------------------------------------------------------------------

export function useTopicSummaries() {
  const pending = usePending();
  const query = useQuery({
    queryKey: ['topic_stats'],
    queryFn: async () => {
      const rows = unwrap(
        await supabase.from('topic_stats').select('*').order('last_activity_at', { ascending: false }),
      );
      return (rows ?? []).map((r): TopicSummary => ({
        id: r.topic_id!,
        title: r.title ?? '',
        description: r.description ?? '',
        status: r.status ?? 'active',
        is_favorite: r.is_favorite ?? false,
        last_activity_at: r.last_activity_at ?? '',
        association_count: r.association_count ?? 0,
        setup_count: r.setup_count ?? 0,
      }));
    },
  });
  const topics = useMemo(
    () => overlay(query.data, pending, 'topics', newSummaryRow).filter(isLive),
    [query.data, pending],
  );
  return { ...query, topics };
}

export function useTopic(topicId: string) {
  const user = useUser();
  const pending = usePending();
  const query = useQuery({
    queryKey: ['topics', topicId],
    queryFn: async () => unwrap(await supabase.from('topics').select('*').eq('id', topicId).maybeSingle()),
  });
  const topic = useMemo(() => {
    const [row] = overlay(query.data ? [query.data] : [], pending, 'topics', (op) =>
      op.id === topicId ? newTopicRow(op, user.id) : null,
    );
    return row && isLive(row) ? (row as Topic) : null;
  }, [query.data, pending, topicId, user.id]);
  return { ...query, topic };
}

export function useAssociations(topicId: string) {
  const user = useUser();
  const pending = usePending();
  const query = useQuery({
    queryKey: ['associations', topicId],
    // Soft-deleted rows are loaded too so Undo can bring them straight back.
    queryFn: async () => unwrap(await supabase.from('associations').select('*').eq('topic_id', topicId)),
  });
  const associations = useMemo(
    () =>
      overlay(query.data, pending, 'associations', (op) =>
        op.values.topic_id === topicId ? newAssociationRow(op, user.id) : null,
      )
        .filter(isLive)
        .sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at)),
    [query.data, pending, topicId, user.id],
  );
  return { ...query, associations };
}

export function useSetups(topicId: string) {
  const user = useUser();
  const pending = usePending();
  const query = useQuery({
    queryKey: ['setups', topicId],
    queryFn: async () => unwrap(await supabase.from('setups').select('*').eq('topic_id', topicId)),
  });
  const setups = useMemo(
    () =>
      overlay(query.data, pending, 'setups', (op) => (op.values.topic_id === topicId ? newSetupRow(op, user.id) : null))
        .filter(isLive)
        // Newest first: new setups get the highest sort_order.
        .sort((a, b) => b.sort_order - a.sort_order || b.created_at.localeCompare(a.created_at)),
    [query.data, pending, topicId, user.id],
  );
  return { ...query, setups };
}

export function useProfile() {
  const user = useUser();
  const pending = usePending();
  const query = useQuery({
    queryKey: ['profile', user.id],
    queryFn: async () => unwrap(await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()),
  });
  const profile = useMemo(() => {
    if (!query.data) return null;
    const op = pending.get(`profiles:${user.id}`);
    return (op ? { ...query.data, ...op.values } : query.data) as Profile;
  }, [query.data, pending, user.id]);
  return { ...query, profile, lastLocation: (profile?.last_location ?? null) as LastLocation | null };
}

// ---------------------------------------------------------------------------
// Mutations (all go through the outbox)
// ---------------------------------------------------------------------------

export function useMutations() {
  const box = useOutbox();
  const user = useUser();

  const update = useCallback((table: TableName, id: string, values: Values) => box.update(table, id, values), [box]);

  return useMemo(
    () => ({
      update,
      createTopic(title: string) {
        const id = crypto.randomUUID();
        box.insert('topics', id, { title: title.trim() });
        return id;
      },
      createAssociation(topicId: string, text: string, existing: readonly Association[]) {
        const id = crypto.randomUUID();
        box.insert('associations', id, { topic_id: topicId, text: text.trim(), sort_order: nextSortOrder(existing) });
        return id;
      },
      createSetup(topicId: string, existing: readonly Setup[], text = '') {
        const id = crypto.randomUUID();
        box.insert('setups', id, { topic_id: topicId, text, sort_order: nextSortOrder(existing) });
        return id;
      },
      softDelete(table: Exclude<TableName, 'profiles'>, id: string) {
        box.update(table, id, { deleted_at: new Date().toISOString() });
        box.flushSoon();
      },
      restore(table: Exclude<TableName, 'profiles'>, id: string) {
        box.update(table, id, { deleted_at: null });
        box.flushSoon();
      },
      setArchived(table: 'topics' | 'setups', id: string, archived: boolean) {
        box.update(table, id, {
          status: archived ? 'archived' : 'active',
          archived_at: archived ? new Date().toISOString() : null,
        });
        box.flushSoon();
      },
      rememberLocation(location: LastLocation) {
        box.update('profiles', user.id, { last_location: location });
      },
    }),
    [box, update, user.id],
  );
}
