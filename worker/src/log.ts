type Level = 'info' | 'warn' | 'error';

/**
 * Structured JSON logs for Workers Logs. Never pass joke content, tokens or
 * email addresses here; identify users with hashUserId().
 */
export function log(level: Level, msg: string, fields: Record<string, unknown> = {}) {
  const line = JSON.stringify({ level, msg, ...fields });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export async function hashUserId(userId: string, salt = ''): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(salt + userId));
  return Array.from(new Uint8Array(digest).slice(0, 8), (b) => b.toString(16).padStart(2, '0')).join('');
}
