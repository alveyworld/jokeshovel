import type { IncludeOptions, Publication } from '@jokeshovel/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { api, type ApiError } from '../lib/api';
import { supabase } from '../lib/supabase';

/** Optional features the server has switched on (from /api/me). Off when the Worker can't be reached. */
export function useFeatures() {
  const { data } = useQuery({
    queryKey: ['me'],
    staleTime: 5 * 60_000,
    retry: false,
    queryFn: async () => {
      const res = await api<{ features?: { docsSync?: boolean } }>('/me');
      return { docsSync: res.ok && res.data.features?.docsSync === true };
    },
  });
  return data ?? { docsSync: false };
}

export interface GoogleStatus {
  enabled: boolean;
  connected: boolean;
  status?: 'active' | 'revoked' | 'error' | null;
  scopes?: string[];
  connectedAt?: string | null;
  jokeBookUrl?: string | null;
}

export function useGoogleConnection(enabled: boolean) {
  return useQuery({
    queryKey: ['google'],
    enabled,
    retry: false,
    queryFn: async (): Promise<GoogleStatus> => {
      const res = await api<GoogleStatus>('/integrations/google');
      if (!res.ok) throw new Error(res.error.message);
      return res.data;
    },
  });
}

/** Every publication, newest first. Small enough to load whole: one row per publish. */
export function usePublications() {
  const query = useQuery({
    queryKey: ['publications'],
    queryFn: async () => {
      const { data, error } = await supabase.from('publications').select('*').order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return data as Publication[];
    },
  });
  const publications = useMemo(() => query.data ?? [], [query.data]);
  return { ...query, publications };
}

const KEEP_DONE = new Set(['user_confirmed', 'succeeded']);

/** The joke's most recent publish that's known to be in Keep. */
export function sentToKeep(publications: readonly Publication[], jokeId: string): Publication | null {
  return (
    publications.find((p) => p.joke_id === jokeId && p.destination === 'google_keep' && KEEP_DONE.has(p.status)) ?? null
  );
}

export type DocsResult = { ok: true; publication: Publication } | { ok: false; error: ApiError };

/** Records, confirms and sends publishes. Every action refreshes history and the Keep counts. */
export function usePublishActions() {
  const qc = useQueryClient();
  const refresh = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ['publications'] });
    void qc.invalidateQueries({ queryKey: ['topic_stats'] });
  }, [qc]);

  const start = useCallback(
    async (p: {
      jokeId: string;
      method: 'share_sheet' | 'copy_open';
      title: string;
      body: string;
      include: IncludeOptions;
      clientRequestId: string;
    }) => {
      const { data, error } = await supabase.rpc('start_publication', {
        p_joke_id: p.jokeId,
        p_method: p.method,
        p_title: p.title,
        p_body: p.body,
        p_include: { ...p.include },
        p_client_request_id: p.clientRequestId,
      });
      if (error || !data) throw new Error(error?.message ?? 'Couldn’t record the publish.');
      refresh();
      return data as Publication;
    },
    [refresh],
  );

  const confirm = useCallback(
    async (id: string, saved: boolean) => {
      const { data, error } = await supabase.rpc('confirm_publication', { p_id: id, p_saved: saved });
      if (error || !data) throw new Error(error?.message ?? 'Couldn’t save your answer.');
      refresh();
      return data as Publication;
    },
    [refresh],
  );

  const toDocs = useCallback(
    async (
      jokeId: string,
      p: { title: string; include: IncludeOptions; clientRequestId: string; recreateBook?: boolean },
    ): Promise<DocsResult> => {
      const res = await api<{ publication: Publication }>(`/jokes/${jokeId}/publish`, {
        method: 'POST',
        body: JSON.stringify({
          title: p.title,
          include: p.include,
          client_request_id: p.clientRequestId,
          recreate_book: p.recreateBook === true,
          time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });
      refresh();
      if (res.ok) return { ok: true, publication: res.data.publication };
      if (res.error.code === 'GOOGLE_RECONNECT_REQUIRED') void qc.invalidateQueries({ queryKey: ['google'] });
      return { ok: false, error: res.error };
    },
    [refresh, qc],
  );

  return { start, confirm, toDocs };
}

function subscribeOnline(cb: () => void) {
  window.addEventListener('online', cb);
  window.addEventListener('offline', cb);
  return () => {
    window.removeEventListener('online', cb);
    window.removeEventListener('offline', cb);
  };
}

export function useOnline() {
  return useSyncExternalStore(subscribeOnline, () => navigator.onLine);
}
