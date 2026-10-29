# Phase 3 review: completed jokes

**Goal:** collect, review and find finished jokes.

**Result:** built and tested locally against Supabase. Like the earlier phases, it isn't deployed until the one-time account setup in `docs/RUNBOOK.md` is done.

## What you can do now

1. **Review (step 12).** After the punch, the Mine gains a Review step: the setup and punch on one card, set like a performance card, with "How you dug it" folded underneath. **Mark as complete** stays disabled, with the reason and a link to fix it, until both the setup and the punch have text. **Keep digging** goes back to the punch.
2. **Title suggestion.** The title is filled in as `Topic — Keyword Keyword`, using the two strongest words in the setup (words also in your connector and associations rank higher, filler words never count). You can change it to anything, and **Reset to suggestion** brings the suggestion back.
3. **Completing** saves any unsaved edits first, then creates the joke in one database transaction. A "Nugget!" toast confirms it and opens the joke card. The attempt leaves Drafts. Completing twice (double-click, retry, a second device) always returns the same joke.
4. **Joke card** (`/j/<id>`): edit the title, setup, punch and notes (autosaved like everything else). Favorite it (♥), rate it 1–5 stars, archive or delete it (with Undo). "How you dug it" shows the snapshot and links to the original dig. Editing the card never changes the dig.
5. **Jokes tab** ("Nuggets"): every finished joke, filtered by All / Favorites / Archived, topic and minimum rating, sorted by newest, best rated or topic. Each topic also has a **Jokes** tab.
6. **Search** (the magnifier in the top bar): one box across jokes, unfinished drafts, setups, topics and associations. It forgives typos ("layovr" finds "layover"), groups results by type with counts, has type filter chips, highlights exact matches, and keeps the search in the address (`/search?q=…`) so Back and reload work.
7. **Stats** ("The Assay", linked from Home and the Jokes tab):
   - Totals from first idea to finished joke: associations, setups, joke attempts, completed jokes and overall completion %.
   - Two weekly column charts for the last 12 weeks: setups written and jokes completed. Hover a column, or focus the chart and use the arrow keys, to read a week; **Show as table** lists every value.
   - A sortable per-topic table with completion %.
   - **Stuck shafts:** drafts untouched for 14 days or more, each linking back to its step.
8. **Home** gains "Your haul": jokes in all, setups this week and jokes this week. Topic cards show a jokes count and **Completion N%** (or **Completion —** when a topic has no setups yet).
9. **Navigation** now matches the design (§5.2): four tabs (Home · Topics · Drafts · Jokes), with Search and Settings in the top bar.

## Acceptance criteria

| AC | Verified by |
|---|---|
| AC-16 Mark complete is disabled with a reason until setup and punch exist; one joke per attempt, even on retry | E2E (disabled state, double-click → exactly 1 joke) + pgTAP (missing punch/setup rejected, idempotent, never a second row) |
| AC-17 Editing the joke's punch doesn't change the attempt's punch | E2E (edit card → open the dig → original punch) + pgTAP |
| AC-18 "layovr" finds the joke with "layover", grouped by type | E2E + pgTAP (typo, setup, draft, topic, one-letter and unrelated searches) |
| AC-19 5 setups, 3 with jokes → 60%; 0 setups → "—" | pgTAP (exact 60% fixture and null for an empty topic) + E2E ("Completion —", 100%, then 50% after adding a setup; stats tiles and table) |
| AC-20 Favorites filter shows only favorites; rating persists | E2E (favorite + 4 stars survive reload; Favorites shows 1 of 2; rating filter; archive) |
| AC-X1 / AC-X3 | axe on Review, joke card, Jokes, Search, Stats and Home (desktop); no horizontal scroll at 320 px on Review, joke card, Jokes, Search and Stats |

Other checks: the weekly bucketing has unit tests (`apps/web/src/lib/stats.test.ts`) run in four time zones, including weeks that span a daylight-saving change, and the title suggestion has unit tests (`packages/shared/src/keywords.test.ts`).

## Database

Migration `supabase/migrations/20261029120000_phase3_completed_jokes.sql`:

- `jokes` table as designed (§7.3), with RLS, composite ownership foreign keys, and `attempt_id unique`. Deleting the attempt or setup keeps the joke.
- `complete_attempt(attempt_id, title)`: checks the setup and punch, snapshots the dig path (trimmed), marks the attempt completed, and returns the joke, all in one transaction. It runs as the caller, so RLS applies; another user's attempt reads as "not found".
- `search_all(q)`: trigram word similarity (threshold 0.45) over jokes, drafts, setups, topics and associations, with GIN trigram indexes. Runs as the caller. Measured at 47–85 ms over 5,000 jokes and 2,000 setups (the target was under 300 ms).
- `topic_stats` v3 adds `completed_joke_count`, `setups_with_joke_count` and `completion_percent` (null with no setups).
- Tests: `supabase/tests/database/phase3_completed_jokes.test.sql` (26 assertions); 77 database tests in total.

## Charts

The two weekly charts follow the data-visualization rules used for this project: one series each, so no legend; one hue (validated for contrast and lightness against the card surface in both themes: `#a84f1c` light, `#d27a2c` dark); columns at most 24 px wide with rounded tops, growing from one baseline; hairline gridlines; only the latest week labeled directly; values on hover or keyboard focus; and a table view so nothing depends on the tooltip.

## Deviations from the plan

- **No `version` column.** Phase 2 planned optimistic concurrency for "complete joke". Completion now happens entirely inside `complete_attempt`, which locks the attempt row and returns the existing joke if one was already made, so two devices completing at once get the same joke and no update can be lost. Joke card edits remain single-field saves (last writer wins), as for everything else.
- **Tags** on the review page are deferred to Phase 5, where the `tags` tables are scheduled.
- **The funnel** is shown as a row of totals in funnel order (associations → setups → attempts → completed jokes) rather than a funnel chart; "published" joins it in Phase 4.
- **Search filters** cover type here; status, favorite, topic and rating filters live on the Jokes tab. Date-range filters and saved filters (a Could Have) are not built.
- **Search highlighting** marks exact substring matches. Near-miss matches (typos) are found but not highlighted.
