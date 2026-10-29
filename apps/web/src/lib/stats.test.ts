import { describe, expect, it } from 'vitest';
import { axisTicks, countThisWeek, percent, startOfWeek, stuckDrafts, weeklyCounts } from './stats';

// Dates are built in local time so the tests pass in any time zone.
const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).toISOString();
const NOW = new Date(2026, 9, 29, 15); // Thursday 29 Oct 2026

describe('startOfWeek', () => {
  it('returns local midnight on Monday', () => {
    const start = startOfWeek(NOW);
    expect(start.getDay()).toBe(1);
    expect(start.getDate()).toBe(26);
    expect(start.getHours()).toBe(0);
  });

  it('treats Sunday as the end of the week, not the start', () => {
    expect(startOfWeek(new Date(2026, 10, 1)).getDate()).toBe(26);
  });
});

describe('weeklyCounts', () => {
  it('buckets dates into weeks, oldest first, ending with this week', () => {
    const weeks = weeklyCounts(
      [at(2026, 10, 26, 0), at(2026, 10, 29), at(2026, 10, 25), at(2026, 10, 19), at(2026, 10, 12)],
      3,
      NOW,
    );
    expect(weeks.map((w) => w.start.getDate())).toEqual([12, 19, 26]);
    expect(weeks.map((w) => w.count)).toEqual([1, 2, 2]);
  });

  it('ignores dates before the window and in the future', () => {
    const weeks = weeklyCounts([at(2026, 1, 1), at(2026, 12, 25), 'not a date'], 4, NOW);
    expect(weeks.every((w) => w.count === 0)).toBe(true);
  });

  it('keeps every week starting at local midnight across a clock change', () => {
    // 12 weeks back from mid-November spans the EU and US autumn clock changes.
    const weeks = weeklyCounts([at(2026, 11, 2, 0)], 12, new Date(2026, 10, 12));
    expect(weeks[11].count).toBe(0);
    expect(weeks[10].count).toBe(1);
    expect(weeks).toHaveLength(12);
    expect(weeks.every((w) => w.start.getHours() === 0 && w.start.getDay() === 1)).toBe(true);
  });

  it('counts the current week', () => {
    expect(countThisWeek([at(2026, 10, 27), at(2026, 10, 20)], NOW)).toBe(1);
  });
});

describe('axisTicks', () => {
  it('gives an empty chart a 0–4 axis', () => {
    expect(axisTicks(0)).toEqual([0, 1, 2, 3, 4]);
  });

  it('steps by 1, 2 or 5 × 10ⁿ with at most five ticks', () => {
    expect(axisTicks(7)).toEqual([0, 2, 4, 6, 8]);
    expect(axisTicks(13)).toEqual([0, 5, 10, 15]);
    expect(axisTicks(40)).toEqual([0, 10, 20, 30, 40]);
    expect(axisTicks(41)).toEqual([0, 20, 40, 60]);
  });

  it('always reaches the maximum', () => {
    for (let max = 0; max < 500; max++) {
      const ticks = axisTicks(max);
      expect(ticks.at(-1)).toBeGreaterThanOrEqual(max);
      expect(ticks.length).toBeLessThanOrEqual(5);
    }
  });
});

describe('stuckDrafts', () => {
  it('lists drafts untouched for 14+ days, longest-neglected first', () => {
    const drafts = [
      { id: 'fresh', updated_at: at(2026, 10, 28) },
      { id: 'old', updated_at: at(2026, 10, 10) },
      { id: 'older', updated_at: at(2026, 9, 1) },
      { id: 'never', updated_at: null },
    ];
    expect(stuckDrafts(drafts, NOW).map((d) => d.id)).toEqual(['older', 'old']);
  });
});

describe('percent', () => {
  it('rounds, and is null with nothing to divide by', () => {
    expect(percent(3, 5)).toBe(60);
    expect(percent(1, 3)).toBe(33);
    expect(percent(0, 0)).toBeNull();
  });
});
