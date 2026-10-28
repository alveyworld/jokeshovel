/** Only allow same-origin paths as post-login redirects (no open redirects). */
export function safeNext(next: string | null | undefined, fallback = '/'): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return fallback;
  if (next.startsWith('/signin') || next.startsWith('/auth/')) return fallback;
  return next;
}
