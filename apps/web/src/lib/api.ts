import { supabase } from './supabase';

/** The Worker's JSON error envelope (docs/DESIGN.md §10.6). */
export interface ApiError {
  code: string;
  message: string;
  requestId?: string;
}

export type ApiResult<T> = { ok: true; data: T } | { ok: false; status: number; error: ApiError; data?: T };

/**
 * Calls the Worker's /api with the current session token. Never throws: a
 * network failure (offline, or the Worker isn't running locally) comes back
 * as status 0.
 */
export async function api<T>(path: string, init: RequestInit = {}): Promise<ApiResult<T>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init.headers as Record<string, string> | undefined),
      },
    });
  } catch {
    return {
      ok: false,
      status: 0,
      error: { code: 'NETWORK', message: 'Couldn’t reach the server. Check your connection.' },
    };
  }
  const body = res.status === 204 ? null : await res.json().catch(() => null);
  if (res.ok) return { ok: true, data: body as T };
  const error = (body as { error?: ApiError } | null)?.error ?? {
    code: 'HTTP_ERROR',
    message: `The server answered ${res.status}.`,
  };
  return { ok: false, status: res.status, error, data: body as T };
}
