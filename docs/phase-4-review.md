# Phase 4 review: Google Keep publishing

**Goal:** get jokes into Keep with predictable titles.

**Result:** built and tested locally against Supabase. Like the earlier phases, it isn't deployed until the one-time setup in `docs/RUNBOOK.md` is done. Share to Keep still has to be tried on a real Android phone and iPhone (runbook, production setup step 6).

## What you can do now

1. **Publish to Keep** on any joke card opens the Publish sheet (a bottom sheet on phones, a dialog on larger screens):
   - **Note title:** `[Topic] — [Keywords] — Joke`, e.g. `Airports — Flight Layover — Joke`. The setup's candidate keywords are toggle chips; turning one on or off rebuilds the title. Type your own title and the chips stop changing it until you choose **↺ Reset to suggestion**. If another joke's Keep note already has the same title, this one becomes `… #2 — Joke`.
   - **Include:** setup and punch always; tick any of target assumption, connector and reinterpretation, second story, and date and link back. Your choices are remembered for next time.
   - **Preview:** exactly the text that will be sent.
2. **Share to Keep** (phones, and any browser with a share sheet) opens the system share sheet. Pick Keep and the note opens filled in. Afterwards the sheet asks **Did it save in Keep?** The app can't see inside Keep, so your answer is what counts.
3. **Copy & open Keep** (everywhere) copies the title and note, opens keep.google.com, and asks the same question. **Copy title only** and **Copy note text only** help with Keep's separate title field.
4. **Publish history** on the joke card lists each publish with where it went, how, whether it landed, and when. A publish you never answered shows **Did it save? It saved / It didn't**. The card shows a **✓ Sent to Keep · date** badge.
5. **Keep counts:** topic cards show "N sent to Keep"; Stats gains a **Sent to Keep** tile and an **In Keep** column; the Jokes tab has a **Keep** filter (Sent to Keep / Not yet in Keep), and its cards show **✓ In Keep**.
6. **Offline:** the sheet says "You're offline. Publishing will be available when you reconnect." and the buttons wait.
7. **Settings → Integrations** explains Keep publishing (nothing to connect).
8. **Google Docs Joke Book, off by default.** With the flag on and the Google client set up (runbook), Settings gets **Connect Google** and the sheet gets **Add to Joke Book**. That appends each joke to one Google Doc, "The Joke Shovel — Joke Book", with the title as a heading. Republishing adds a new entry marked "(revised)".

## Acceptance criteria

| AC | Verified by |
|---|---|
| AC-21 Fixture title `Airports — Flight Layover — Joke` (flight 4, layover 3, six-hour 1) | Unit tests (`packages/shared/src/note.test.ts`: title and chip scores) + E2E with the design's fixture |
| AC-22 Editing the title stops auto-updates; Reset restores it | E2E |
| AC-23 Share opens the share sheet with title and body; confirming shows "Published" and raises the topic's Keep count by 1; cancelling records `cancelled` and doesn't | E2E with a stand-in share sheet (headless Chrome has none) + pgTAP. **Real Android Chrome still to check by hand.** |
| AC-24 The body has exactly the checked sections, in order, plus date and link | Unit tests (the design's example, word for word) + E2E preview |
| AC-25 Joke detail lists each publication with method, status and time | E2E |
| AC-26 A revoked token gives "Google access expired. Reconnect to publish." and a `failed` publication with `GOOGLE_RECONNECT_REQUIRED` | Worker tests against a fake Google |
| AC-27 Connecting asks only for the requested scope; disconnecting revokes the token and removes the row | Worker tests (consent URL has only `drive.file`; revoke called with the stored token; row deleted) |
| AC-X1 / AC-X3 | axe on the Publish sheet, its confirm step, the joke card with history, and Settings (desktop); the sheet fits a 320 px phone |

Other checks: the Worker's database calls are tested against a real local Supabase (`worker/test/store.int.test.ts`, now part of CI), including RLS hiding one user's joke from another.

## Database

Migration `supabase/migrations/20261030120000_phase4_publishing.sql`:

- `publications`: every publish with exactly what was sent. Users can read their own and can't write directly. Share and copy publishes go through `start_publication` (records it as pending, idempotent on `client_request_id`) and `confirm_publication` (Yes → `user_confirmed`, No → `cancelled`, and a mistaken answer can be corrected). Docs publishes are written only by the Worker.
- `google_connections`: the Docs integration's refresh token, AES-256-GCM encrypted. RLS with no policies, so only the Worker's service role can reach it.
- `topic_stats` v4: `published_to_keep_count` (distinct jokes with a confirmed Keep publish) and `published_to_docs_count`.
- Tests: `supabase/tests/database/phase4_publishing.test.sql` (25 assertions); 102 database tests in total.

## Worker (Docs Joke Book)

- `GET /api/integrations/google`, `GET /api/integrations/google/start?feature=docs`, `GET /api/integrations/google/callback`, `DELETE /api/integrations/google`, `POST /api/jokes/:id/publish`. `/api/me` now reports `features.docsSync`.
- OAuth with PKCE and `access_type=offline`, asking only for `drive.file`. Refresh tokens are encrypted before they're stored and never reach the browser or the logs.
- Publishing is idempotent on `client_request_id`; Retry reuses the same row. Google 429/5xx are retried 3 times with backoff and jitter. `invalid_grant` marks the connection revoked. A deleted Joke Book offers "Create a new one".
- Rate limits: 10 publishes a minute (Workers Rate Limiting binding) and 100 a day per user; 5 connection starts a minute.
- Tests: 21 new Worker tests (31 in total) plus the integration test.

## A save-queue bug found and fixed

While testing, **Mark as complete** sometimes said "You're offline" on a working connection. Before completing a joke the app saves any queued edits, but if an automatic save was already running, it didn't wait for it: it returned at once with edits still queued, and that looked like being offline. Edits that arrived during the save, such as the "Resume digging" bookmark written a few seconds after opening a page, had the same effect. The save queue now waits for a save in progress, includes edits that arrive meanwhile, and reports whether a lost connection stopped it. Signing out and publishing to the Joke Book use the same check. Two new unit tests cover it.

## Deviations from the plan

- **Share and copy publishes don't go through the Worker.** The design had `POST /api/jokes/:id/publish/preview` and `POST /api/publications/:id/confirm`. Instead the browser builds the note with the same shared code the Worker uses (`packages/shared/src/note.ts`), and records it through two database functions. That keeps the share sheet opening straight from the tap (phones block a share sheet opened after a network wait), and Keep publishing works even when the Worker is down.
- **No Workers KV.** The design stored the PKCE verifier in KV. It now travels inside the OAuth `state`, which is encrypted and expires after 10 minutes, so there is no KV namespace to create before deploying. Google's authorization codes are single-use, which covers replay.
- **`/api/integrations/google/start` returns the consent URL as JSON** rather than redirecting: the browser has to send its session token, which a plain page navigation can't carry.
- **The connected Google account's email isn't shown.** Reading it would need the `email` scope, and AC-27 asks for only the requested scope.
- **No preferred-method setting.** The sheet shows Share to Keep wherever a share sheet exists and Copy & open everywhere, so there's nothing to choose.
- **Markdown export** (FR-K5) is left for Phase 5, alongside export of everything.
