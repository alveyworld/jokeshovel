import {
  EXPORT_TABLES,
  buildExport,
  exportToMarkdown,
  serializeExport,
  type ExportTable,
  type RawExportData,
} from '@jokeshovel/shared';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { excerpt } from '../lib/text';

export const TRASH_DAYS = 30;

export type TrashTable = 'topics' | 'setups' | 'joke_attempts' | 'jokes';

export interface TrashItem {
  table: TrashTable;
  id: string;
  kind: string;
  label: string;
  /** Where it lived, e.g. the topic's title. */
  context: string;
  deletedAt: string;
  /** Restoring it alone won't show it: its topic or setup is in the Trash too. */
  parentInTrash: boolean;
}

const KIND: Record<TrashTable, string> = { topics: 'Topic', setups: 'Setup', joke_attempts: 'Draft', jokes: 'Joke' };

/** Days until the nightly purge removes it for good. */
export function daysLeft(deletedAt: string, now = Date.now()): number {
  const age = Math.floor((now - new Date(deletedAt).getTime()) / 86_400_000);
  return Math.max(0, TRASH_DAYS - age);
}

/** Deleted topics, setups, drafts and jokes from the last 30 days, newest first. */
export function useTrash() {
  return useQuery({
    queryKey: ['trash'],
    staleTime: 0,
    queryFn: async (): Promise<TrashItem[]> => {
      const since = new Date(Date.now() - TRASH_DAYS * 86_400_000).toISOString();
      const deleted = { col: 'deleted_at', since };
      const [topics, allTopics, setups, attempts, jokes] = await Promise.all([
        supabase.from('topics').select('id, title, deleted_at').not(deleted.col, 'is', null).gte(deleted.col, since),
        supabase.from('topics').select('id, title, deleted_at'),
        supabase
          .from('setups')
          .select('id, topic_id, text, deleted_at')
          .not(deleted.col, 'is', null)
          .gte(deleted.col, since),
        supabase
          .from('joke_attempts')
          .select('id, topic_id, punch, deleted_at, setups(text, deleted_at)')
          .not(deleted.col, 'is', null)
          .gte(deleted.col, since),
        supabase
          .from('jokes')
          .select('id, topic_id, title, setup_text, deleted_at')
          .not(deleted.col, 'is', null)
          .gte(deleted.col, since),
      ]);
      for (const r of [topics, allTopics, setups, attempts, jokes]) if (r.error) throw new Error(r.error.message);
      const topic = new Map((allTopics.data ?? []).map((t) => [t.id, t]));
      const topicTitle = (id: string) => topic.get(id)?.title || 'Untitled topic';
      const topicGone = (id: string) => Boolean(topic.get(id)?.deleted_at);

      const items: TrashItem[] = [
        ...(topics.data ?? []).map((t) => ({
          table: 'topics' as const,
          id: t.id,
          kind: KIND.topics,
          label: t.title || 'Untitled topic',
          context: 'Everything in it comes back too',
          deletedAt: t.deleted_at!,
          parentInTrash: false,
        })),
        ...(setups.data ?? []).map((s) => ({
          table: 'setups' as const,
          id: s.id,
          kind: KIND.setups,
          label: excerpt(s.text, 90) || 'Untitled setup',
          context: topicTitle(s.topic_id),
          deletedAt: s.deleted_at!,
          parentInTrash: topicGone(s.topic_id),
        })),
        ...(attempts.data ?? []).map((a) => {
          const setup = a.setups as unknown as { text: string; deleted_at: string | null } | null;
          return {
            table: 'joke_attempts' as const,
            id: a.id,
            kind: KIND.joke_attempts,
            label: excerpt(a.punch, 90) || excerpt(setup?.text ?? '', 90) || 'Unfinished joke',
            context: topicTitle(a.topic_id),
            deletedAt: a.deleted_at!,
            parentInTrash: topicGone(a.topic_id) || Boolean(setup?.deleted_at),
          };
        }),
        ...(jokes.data ?? []).map((j) => ({
          table: 'jokes' as const,
          id: j.id,
          kind: KIND.jokes,
          label: j.title || excerpt(j.setup_text, 90) || 'Untitled joke',
          context: topicTitle(j.topic_id),
          deletedAt: j.deleted_at!,
          parentInTrash: topicGone(j.topic_id),
        })),
      ];
      return items.sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
    },
  });
}

export async function deleteForever(table: TrashTable, id: string): Promise<string | null> {
  const { error } = await supabase.from(table).delete().eq('id', id);
  return error?.message ?? null;
}

const PAGE = 1000;

/** Every row of a table, a page at a time (the API caps a request at 1,000 rows). */
async function fetchAll(table: ExportTable): Promise<unknown[]> {
  const rows: unknown[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`Couldn’t read ${table}: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) return rows;
  }
}

export interface ExportFiles {
  json: string;
  markdown: string;
  date: string;
}

/** Everything the user owns, as a JSON file that reads back and a Markdown file. */
export async function buildExportFiles(email: string | null): Promise<ExportFiles> {
  const tables = await Promise.all(EXPORT_TABLES.map((t) => fetchAll(t)));
  const raw = Object.fromEntries(EXPORT_TABLES.map((t, i) => [t, tables[i]])) as unknown as RawExportData;
  const now = new Date().toISOString();
  const file = buildExport(raw, { exportedAt: now, email });
  return { json: serializeExport(file), markdown: exportToMarkdown(file), date: now.slice(0, 10) };
}

/** Saves text as a file through the browser's download. */
export function download(filename: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export type DeleteResult = { ok: true } | { ok: false; reauth: boolean; message: string };

export async function deleteAccount(phrase: string): Promise<DeleteResult> {
  const { error } = await supabase.rpc('delete_account', { p_confirm: phrase });
  if (!error) return { ok: true };
  return { ok: false, reauth: error.hint === 'reauthenticate', message: error.message };
}
