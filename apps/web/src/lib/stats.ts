/** Helpers for the stats page: weekly buckets, axis ticks and stuck drafts. */

/** Midnight on the Monday of the week containing `d`, in local time. */
export function startOfWeek(d: Date): Date {
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return start;
}

export interface WeekBucket {
  start: Date;
  count: number;
}

/**
 * Counts dates per week for the `weeks` weeks ending with the current one,
 * oldest first. Dates before the first week or in the future are ignored.
 */
export function weeklyCounts(dates: readonly string[], weeks: number, now = new Date()): WeekBucket[] {
  const current = startOfWeek(now);
  const buckets: WeekBucket[] = Array.from({ length: weeks }, (_, i) => {
    const start = new Date(current);
    // setDate keeps local midnight across daylight-saving changes.
    start.setDate(current.getDate() - 7 * (weeks - 1 - i));
    return { start, count: 0 };
  });
  const end = new Date(current);
  end.setDate(current.getDate() + 7);
  for (const iso of dates) {
    const t = new Date(iso).getTime();
    if (Number.isNaN(t) || t >= end.getTime()) continue;
    for (let i = buckets.length - 1; i >= 0; i--) {
      if (t >= buckets[i].start.getTime()) {
        buckets[i].count++;
        break;
      }
    }
  }
  return buckets;
}

/** How many of `dates` fall in the current week. */
export function countThisWeek(dates: readonly string[], now = new Date()): number {
  return weeklyCounts(dates, 1, now)[0].count;
}

/**
 * Evenly spaced whole-number ticks from 0 to just above `max`: at most five,
 * stepping by 1, 2 or 5 × 10ⁿ. An empty series still gets an axis (0–4).
 */
export function axisTicks(max: number): number[] {
  const top = Math.max(max, 4);
  let step = 1;
  for (let magnitude = 1; ; magnitude *= 10) {
    const fit = [1, 2, 5].map((m) => m * magnitude).find((s) => Math.ceil(top / s) <= 4);
    if (fit) {
      step = fit;
      break;
    }
  }
  const ticks: number[] = [];
  for (let v = 0; v < top + step; v += step) ticks.push(v);
  return ticks;
}

/** Drafts with no edits for `days` days or more, longest-neglected first. */
export function stuckDrafts<T extends { updated_at: string | null }>(
  drafts: readonly T[],
  now = new Date(),
  days = 14,
): T[] {
  const cutoff = now.getTime() - days * 24 * 3600 * 1000;
  return drafts
    .filter((d) => d.updated_at && new Date(d.updated_at).getTime() <= cutoff)
    .sort((a, b) => (a.updated_at ?? '').localeCompare(b.updated_at ?? ''));
}

/** Whole-number percentage, or null when there's nothing to divide by. */
export function percent(part: number, whole: number): number | null {
  return whole > 0 ? Math.round((100 * part) / whole) : null;
}
