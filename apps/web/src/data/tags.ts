import type { JokeTag, Tag, TopicTag } from '@jokeshovel/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useOutbox } from './OutboxProvider';

async function all<T>(table: 'tags' | 'joke_tags' | 'topic_tags'): Promise<T[]> {
  const { data, error } = await supabase.from(table).select('*');
  if (error) throw new Error(error.message);
  return (data ?? []) as T[];
}

/** Every tag and which jokes and topics wear it. Small: a few rows per item. */
export function useTags() {
  const tags = useQuery({ queryKey: ['tags'], queryFn: () => all<Tag>('tags') });
  const jokeTags = useQuery({ queryKey: ['joke_tags'], queryFn: () => all<JokeTag>('joke_tags') });
  const topicTags = useQuery({ queryKey: ['topic_tags'], queryFn: () => all<TopicTag>('topic_tags') });

  return useMemo(() => {
    const list = [...(tags.data ?? [])].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
    );
    const byId = new Map(list.map((t) => [t.id, t]));
    const index = (links: readonly { tag_id: string }[], key: (l: never) => string) => {
      const map = new Map<string, Tag[]>();
      for (const link of links) {
        const tag = byId.get(link.tag_id);
        if (!tag) continue;
        const id = key(link as never);
        map.set(id, [...(map.get(id) ?? []), tag]);
      }
      for (const v of map.values()) v.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
      return map;
    };
    const forJoke = index(jokeTags.data ?? [], (l: JokeTag) => l.joke_id);
    const forTopic = index(topicTags.data ?? [], (l: TopicTag) => l.topic_id);
    const uses = new Map<string, number>();
    for (const l of [...(jokeTags.data ?? []), ...(topicTags.data ?? [])])
      uses.set(l.tag_id, (uses.get(l.tag_id) ?? 0) + 1);
    return {
      tags: list,
      jokeTags: (id: string) => forJoke.get(id) ?? [],
      topicTags: (id: string) => forTopic.get(id) ?? [],
      uses: (id: string) => uses.get(id) ?? 0,
      isPending: tags.isPending,
    };
  }, [tags.data, tags.isPending, jokeTags.data, topicTags.data]);
}

export type TagResult = { ok: true } | { ok: false; message: string };

/** Tag changes go straight to the server (one call each), then refresh. */
export function useTagActions() {
  const qc = useQueryClient();
  const box = useOutbox();
  const refresh = useCallback(() => {
    for (const key of ['tags', 'joke_tags', 'topic_tags']) void qc.invalidateQueries({ queryKey: [key] });
  }, [qc]);
  const run = useCallback(
    async (call: () => PromiseLike<{ error: { message: string; code?: string } | null }>): Promise<TagResult> => {
      // A topic created a moment ago may still be in the save queue: save it first.
      if (!(await box.flushAll())) {
        return { ok: false, message: 'You’re offline. Change tags once you’re back online.' };
      }
      const { error } = await call();
      refresh();
      if (!error) return { ok: true };
      const message =
        error.code === '23505'
          ? 'You already have a tag with that name.'
          : error.code === '23514'
            ? 'Tags are 1–40 characters, up to 20 per item.'
            : error.message;
      return { ok: false, message };
    },
    [refresh, box],
  );
  return {
    setJokeTags: (jokeId: string, names: string[]) =>
      run(() => supabase.rpc('set_joke_tags', { p_joke_id: jokeId, p_names: names })),
    setTopicTags: (topicId: string, names: string[]) =>
      run(() => supabase.rpc('set_topic_tags', { p_topic_id: topicId, p_names: names })),
    renameTag: (id: string, name: string) => run(() => supabase.from('tags').update({ name }).eq('id', id)),
    deleteTag: (id: string) => run(() => supabase.from('tags').delete().eq('id', id)),
  };
}
