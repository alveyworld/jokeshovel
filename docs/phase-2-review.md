# Phase 2 review: the guided Joke Mine

**Goal:** take a setup all the way to a punch, one decision at a time.

**Result:** built and tested locally against Supabase. Like Sprint 1, it isn't deployed until the one-time account setup in `docs/RUNBOOK.md` is done.

## What you can do now

1. On a topic's **Setups** tab, choose **Mine this setup** on any setup.
2. On the setup page, list the setup's **assumptions**. Question chips (Who? Where? When? What's happening? Why? Which meaning?) turn the input into a prompt.
3. **Start a joke attempt** and work through the steps, each with its own screen and address (`/a/<attempt>/<step>`):

   | Step | Screen |
   |---|---|
   | 6 · Target | Pick the assumption to break, or add one right there |
   | 7 · Connector | Tap words in the setup to fill in the connector, or type it; optional "why" note |
   | 8 · Reinterpret | Rapid-fire list of other readings ("What else could “my flight” mean?"), with stars and delete + Undo |
   | 9 · Choose | Pick one; starred ones come first. Changing the choice after writing a second story shows a "review it?" notice and never changes your text |
   | 10 · Second story | Prompted by the chosen reading |
   | 11 · Punch | Written directly under the setup, with a word count and the second story for reference |

4. A **stepper** links to every step. Finished steps show ✓ and steps you jumped past show as skipped. On phones it shrinks to numbers plus the current step's name.
5. **The thread so far** shows every decision, each linking back to its step: beside the step on wide screens, as a fold-out on phones.
6. **Multiple attempts per setup**, each targeting a different assumption, are listed on the setup page.
7. A **Drafts** tab ("Open shafts") lists every unfinished attempt across topics with its step and age. The top three also appear on Home, and topic cards gain an "N drafts" count.

## Acceptance criteria

| AC | Verified by |
|---|---|
| AC-9 Assumptions persist | E2E (golden path) + pgTAP |
| AC-10 Deleting the targeted assumption clears the target | E2E (soft delete) + pgTAP (hard delete sets it to null) |
| AC-11 Word chips fill the connector in setup order and toggle off | E2E + unit tests (`packages/shared/src/mine.test.ts`) |
| AC-12 Changing the choice flags, never edits, the second story | E2E |
| AC-13 Jump to any step; Back returns with text intact | E2E |
| AC-14 Drafts lists in-progress attempts with topic, setup, step and age | E2E + pgTAP (`drafts_feed`) |
| AC-15 A second attempt starts with no target | E2E |
| AC-X1 / AC-X3 | axe on the setup page, all six steps and Drafts (desktop); no horizontal scroll at 320 px on three steps |

## Database

Migration `supabase/migrations/20261028120000_phase2_joke_mine.sql`:

- Tables `assumptions`, `joke_attempts` and `reinterpretations`, with RLS and composite ownership foreign keys (a row can never point at another user's parent).
- A trigger copies each attempt's topic from its setup, and rejects a target from another setup or a reinterpretation from another attempt.
- Topic "last activity" now also updates when assumptions and reinterpretations change.
- `topic_stats` gains `unfinished_attempt_count`, and there's a new `drafts_feed` view.
- Tests: `supabase/tests/database/phase2_joke_mine.test.sql` (27 assertions); 51 database tests in total.

## Two save-queue bugs found and fixed

Both would have lost work in real use, and each now has a regression test.

1. **An edit that referred to a newer row could be dropped.** If an attempt already had a queued edit (for example while offline) and you then added an assumption and chose it as the target, the target change was merged into the attempt's earlier queued edit. It would then be saved before the assumption existed, the database would reject it, and the choice was lost. Now edits move to the back of the queue, behind anything they refer to. Covered by an E2E test (offline → add assumption → it becomes the target → reconnect → reload). I confirmed the test fails with the old queue order.
2. **A slow, older response could hide a just-saved row.** Opening a brand-new setup started loading it just before it finished saving. That response could arrive after the save and say the setup didn't exist, so the page flickered to "Setup not found" and wiped a half-typed entry. It failed about 1 run in 20 in testing. Now a saved change stays applied on screen for 15 seconds until fresh data arrives. A probe run 120 times passed every time.

## Deviations from the plan

- **Step status is derived** from the attempt's data rather than stored in a `skipped_steps` column, so it can't get out of sync.
- **No `version` column yet.** Each field saves independently, which is safe for one person editing. Optimistic concurrency arrives with "complete joke" in Phase 3, the first multi-field operation.
- **Review (step 12)** is Phase 3. The punch screen ends with **Done for now** (back to the setup) and a note. The `attempt_step` enum already includes `review`.

## Tests

- Unit: 43 (web 26, shared 7, Worker 10)
- Database: 51 pgTAP assertions
- E2E: 26 passed on desktop and phone layouts; 2 skipped (the axe scans on the phone layout, as in Sprint 1)
