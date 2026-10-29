import type {
  Assumption,
  Association,
  AttemptStep,
  DraftRow,
  Joke,
  JokeAttempt,
  LastLocation,
  Profile,
  Reinterpretation,
  SearchResult,
  Setup,
  Topic,
} from '@jokeshovel/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { useUser } from '../auth/AuthProvider';
import type { PendingOp, TableName, Values } from '../lib/outbox/outbox';
import { overlay } from '../lib/overlay';
import { supabase } from '../lib/supabase';
import { useOutbox } from './OutboxProvider';
import {
  newAssociationRow,
  newAssumptionRow,
  newAttemptRow,
  newJokeRow,
  newReinterpretationRow,
  newSetupRow,
  newSummaryRow,
  newTopicRow,
  nextSortOrder,
  type TopicSummary,
} from './rows';

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
        unfinished_attempt_count: r.unfinished_attempt_count ?? 0,
        completed_joke_count: r.completed_joke_count ?? 0,
        setups_with_joke_count: r.setups_with_joke_count ?? 0,
        completion_percent: r.completion_percent,
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

/** One row by id, with unsaved local changes (or a locally created row) on top. */
function useSingle<T extends { id: string; deleted_at?: string | null }>(
  key: string,
  table: TableName,
  id: string,
  build: (op: PendingOp) => T,
) {
  const pending = usePending();
  const query = useQuery({
    queryKey: [key, id],
    queryFn: async () =>
      unwrap(await supabase.from(table).select('*').eq('id', id).maybeSingle()) as unknown as T | null,
  });
  const row = useMemo(() => {
    const [merged] = overlay(query.data ? [query.data] : [], pending, table, (op) => (op.id === id ? build(op) : null));
    return merged && isLive(merged) ? merged : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.data, pending, id]);
  return { ...query, row };
}

/** Rows under one parent (soft-deleted ones are loaded too, so Undo is instant). */
function useChildList<T extends { id: string; deleted_at?: string | null; sort_order?: number; created_at: string }>(
  table: TableName,
  parentColumn: string,
  parentId: string,
  build: (op: PendingOp) => T,
  queryKey: readonly unknown[] = [table, parentId],
) {
  const pending = usePending();
  const query = useQuery({
    queryKey,
    queryFn: async () => unwrap(await supabase.from(table).select('*').eq(parentColumn, parentId)) as unknown as T[],
  });
  const rows = useMemo(
    () =>
      overlay(query.data, pending, table, (op) => (op.values[parentColumn] === parentId ? build(op) : null))
        .filter(isLive)
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.created_at.localeCompare(b.created_at)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [query.data, pending, parentId],
  );
  return { ...query, rows };
}

export function useSetup(setupId: string) {
  const user = useUser();
  const { row, ...rest } = useSingle<Setup>('setup', 'setups', setupId, (op) => newSetupRow(op, user.id));
  return { ...rest, setup: row };
}

export function useAssumptions(setupId: string) {
  const user = useUser();
  const { rows, ...rest } = useChildList<Assumption>('assumptions', 'setup_id', setupId, (op) =>
    newAssumptionRow(op, user.id),
  );
  return { ...rest, assumptions: rows };
}

export function useAttempts(setupId: string) {
  const user = useUser();
  const { rows, ...rest } = useChildList<JokeAttempt>('joke_attempts', 'setup_id', setupId, (op) =>
    newAttemptRow(op, user.id),
  );
  return { ...rest, attempts: rows };
}

/** Every attempt in a topic (setup cards show how many drafts they have). */
export function useTopicAttempts(topicId: string) {
  const user = useUser();
  const { rows, ...rest } = useChildList<JokeAttempt>(
    'joke_attempts',
    'topic_id',
    topicId,
    (op) => newAttemptRow(op, user.id),
    ['joke_attempts', 'topic', topicId],
  );
  return { ...rest, attempts: rows };
}

export function useAttempt(attemptId: string) {
  const user = useUser();
  const { row, ...rest } = useSingle<JokeAttempt>('joke_attempt', 'joke_attempts', attemptId, (op) =>
    newAttemptRow(op, user.id),
  );
  return { ...rest, attempt: row };
}

export function useReinterpretations(attemptId: string) {
  const user = useUser();
  const { rows, ...rest } = useChildList<Reinterpretation>('reinterpretations', 'attempt_id', attemptId, (op) =>
    newReinterpretationRow(op, user.id),
  );
  return { ...rest, reinterpretations: rows };
}

/** Unfinished attempts across all topics, newest first. */
export function useDrafts() {
  const pending = usePending();
  const query = useQuery({
    queryKey: ['drafts'],
    queryFn: async () =>
      unwrap(await supabase.from('drafts_feed').select('*').order('updated_at', { ascending: false })) as DraftRow[],
  });
  // Hide drafts deleted locally but not yet saved.
  const drafts = useMemo(
    () => (query.data ?? []).filter((d) => !pending.get(`joke_attempts:${d.attempt_id}`)?.values.deleted_at),
    [query.data, pending],
  );
  return { ...query, drafts };
}

/** Every joke in the collection, newest first (soft-deleted ones too, for Undo). */
export function useJokes() {
  const pending = usePending();
  const query = useQuery({
    queryKey: ['jokes', 'all'],
    queryFn: async () => unwrap(await supabase.from('jokes').select('*')) as Joke[],
  });
  const jokes = useMemo(
    () =>
      overlay(query.data, pending, 'jokes', () => null)
        .filter(isLive)
        .sort((a, b) => b.completed_at.localeCompare(a.completed_at)),
    [query.data, pending],
  );
  return { ...query, jokes };
}

export function useJoke(jokeId: string) {
  const user = useUser();
  const { row, ...rest } = useSingle<Joke>('joke', 'jokes', jokeId, (op) => newJokeRow(op, user.id));
  return { ...rest, joke: row };
}

/** The completed joke an attempt produced, if any. */
export function useAttemptJoke(attemptId: string) {
  return useQuery({
    queryKey: ['jokes', 'attempt', attemptId],
    queryFn: async () =>
      unwrap(await supabase.from('jokes').select('id, title').eq('attempt_id', attemptId).maybeSingle()),
  });
}

export type CompleteResult = { ok: true; joke: Joke } | { ok: false; message: string };

/**
 * Turns an attempt into a completed joke. Saves any queued edits first so the
 * joke snapshots exactly what's on screen; the server does the rest in one
 * transaction and never creates a second joke for the same attempt.
 */
export function useCompleteAttempt() {
  const box = useOutbox();
  const qc = useQueryClient();
  return useCallback(
    async (attemptId: string, title: string): Promise<CompleteResult> => {
      await box.flushAll();
      if (box.size > 0) {
        return {
          ok: false,
          message: 'You’re offline. Your work is saved on this device; complete the joke once you’re back online.',
        };
      }
      const { data, error } = await supabase.rpc('complete_attempt', { p_attempt_id: attemptId, p_title: title });
      if (error || !data) return { ok: false, message: error?.message ?? 'Couldn’t complete the joke. Try again.' };
      for (const key of ['jokes', 'joke_attempt', 'joke_attempts', 'drafts', 'topic_stats', 'stats']) {
        void qc.invalidateQueries({ queryKey: [key] });
      }
      return { ok: true, joke: data as Joke };
    },
    [box, qc],
  );
}

/** Search across jokes, drafts, setups, topics and associations. */
export function useSearch(term: string) {
  const q = term.trim();
  return useQuery({
    queryKey: ['search', q],
    enabled: q.length >= 2,
    staleTime: 0,
    // Keep the last results on screen while the next search runs.
    placeholderData: (previous) => previous,
    queryFn: async () => (unwrap(await supabase.rpc('search_all', { q })) ?? []) as SearchResult[],
  });
}

export interface StatsTimeline {
  setups: { topic_id: string; created_at: string }[];
  attempts: { topic_id: string; status: JokeAttempt['status']; created_at: string }[];
}

/** Raw dates for the stats page's weekly charts and totals. */
export function useStatsTimeline() {
  return useQuery({
    queryKey: ['stats'],
    queryFn: async (): Promise<StatsTimeline> => {
      const [setups, attempts] = await Promise.all([
        supabase.from('setups').select('topic_id, created_at').is('deleted_at', null),
        supabase.from('joke_attempts').select('topic_id, status, created_at').is('deleted_at', null),
      ]);
      return { setups: unwrap(setups) ?? [], attempts: unwrap(attempts) ?? [] };
    },
  });
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
      createAssumption(setupId: string, text: string, existing: readonly Assumption[]) {
        const id = crypto.randomUUID();
        box.insert('assumptions', id, { setup_id: setupId, text: text.trim(), sort_order: nextSortOrder(existing) });
        return id;
      },
      createAttempt(setup: Pick<Setup, 'id' | 'topic_id'>) {
        const id = crypto.randomUUID();
        box.insert('joke_attempts', id, { setup_id: setup.id, topic_id: setup.topic_id, current_step: 'target' });
        box.flushSoon();
        return id;
      },
      createReinterpretation(attemptId: string, text: string, existing: readonly Reinterpretation[]) {
        const id = crypto.randomUUID();
        box.insert('reinterpretations', id, {
          attempt_id: attemptId,
          text: text.trim(),
          sort_order: nextSortOrder(existing),
        });
        return id;
      },
      /** Records the step the user is on, for Resume and the Drafts list. */
      enterStep(attemptId: string, step: AttemptStep) {
        box.update('joke_attempts', attemptId, { current_step: step, last_step_at: new Date().toISOString() });
      },
      softDelete(table: Exclude<TableName, 'profiles'>, id: string) {
        box.update(table, id, { deleted_at: new Date().toISOString() });
        box.flushSoon();
      },
      restore(table: Exclude<TableName, 'profiles'>, id: string) {
        box.update(table, id, { deleted_at: null });
        box.flushSoon();
      },
      setArchived(table: 'topics' | 'setups' | 'jokes', id: string, archived: boolean) {
        // A joke's live status is 'complete'; topics and setups use 'active'.
        const live = table === 'jokes' ? 'complete' : 'active';
        box.update(table, id, {
          status: archived ? 'archived' : live,
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
