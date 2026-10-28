# Sprint 1 review — "Break Ground"

**Goal:** a deployed app where I can sign in with Google, create topics, brainstorm associations, write setups, see counts, close the tab mid-sentence, and find everything there when I come back.

**Result:** everything is built and tested locally against a real Supabase stack. It is **not deployed yet**: deploying needs the Supabase, Google Cloud and Cloudflare accounts from the RUNBOOK's one-time setup. Once those exist, merging to `main` deploys automatically.

## Tickets

| #     | Ticket                  | Status                        | Notes                                                                                                                                                                                                         |
| ----- | ----------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1-01 | Monorepo scaffold       | ✅                            | pnpm workspaces: `apps/web`, `worker`, `packages/shared`; ESLint (incl. jsx-a11y, react-hooks), Prettier                                                                                                      |
| S1-02 | Supabase local          | ✅                            | `supabase/config.toml`; unused services (realtime, storage, studio, edge functions, analytics) off; generated types in `packages/shared`                                                                      |
| S1-03 | pgTAP RLS tests         | ✅                            | 24 assertions: ownership, cross-user read/insert/update/delete blocked, composite-FK cross-linking blocked, anon has no access, triggers, `topic_stats`                                                       |
| S1-04 | Worker + assets         | ✅                            | Hono; SPA fallback; security headers (`public/_headers` for assets, `secureHeaders` for API); JWT check via JWKS with HS256 fallback; `/api/health`, `/api/me`; structured logs with hashed user ids          |
| S1-05 | CI/CD                   | ✅ (deploy dormant)           | `ci.yml` (lint, format, typecheck, unit, build, pgTAP, type drift, E2E); `deploy.yml` runs after green CI on `main` once `DEPLOY_ENABLED=true`; `backup.yml` nightly once `BACKUP_ENABLED=true`               |
| S1-06 | Auth UI                 | ✅                            | Google (PKCE) sign-in, `/auth/callback`, protected routes with same-origin `next`, sign out (this device / everywhere) that flushes unsaved work first; dev-only email sign-in behind `VITE_ENABLE_DEV_LOGIN` |
| S1-07 | Design tokens and shell | ✅                            | Light/dark tokens, 3 px focus ring, bottom tabs on phones, left rail ≥ 640 px, persistent save indicator                                                                                                      |
| S1-08 | Autosave core           | ✅                            | IndexedDB-backed outbox: coalescing, ordered, debounced (800 ms), flush on blur/hide, backoff retry, permanent-error reporting, overlay of unsaved edits on server data; 9 unit tests                         |
| S1-09 | Topics                  | ✅                            | Create, inline rename/describe, favorite, archive/restore, delete with Undo; list with filter (active / favorites / archived) and sort                                                                        |
| S1-10 | Associations workspace  | ✅                            | Enter-to-add keeping focus, rotating prompt placeholder, star, edit, reorder (fractional), delete with Undo                                                                                                   |
| S1-11 | Setups                  | ✅                            | New setup opens focused, autosaves (empty drafts allowed), favorite, archive, delete with Undo, starred-associations panel, "Write a setup" from the associations tab                                         |
| S1-12 | Resume + Home           | ✅                            | `profiles.last_location` written on topic screens; Home "Resume digging" card, recent topics with counts                                                                                                      |
| S1-13 | E2E and a11y            | ✅ (partly manual items open) | 9 Playwright tests × desktop and phone layouts (17 pass, 1 intentionally skipped) incl. axe scans and 320 px overflow check                                                                                   |
| S1-14 | Demo and retro          | ⏳                            | Needs a deployed URL to try on a real phone for two days                                                                                                                                                      |

## Acceptance criteria

| AC                                          | How it's verified                                                                                                                                 |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC-1 Google sign-in, basic scopes only      | Code requests `openid email profile`; profile row created by trigger (pgTAP). **Real Google login not yet tried**: needs the Google Cloud client. |
| AC-2 Sign out, protected routes             | E2E: redirect to `/signin?next=…`; sign out returns to sign-in                                                                                    |
| AC-3 Topic create / rename / delete + Undo  | E2E                                                                                                                                               |
| AC-4 Rapid association entry                | E2E                                                                                                                                               |
| AC-5 Close the tab within 2 s, nothing lost | E2E reloads before the debounced save fires                                                                                                       |
| AC-6 Offline edits sync on reconnect        | E2E with the browser offline                                                                                                                      |
| AC-7 Counts exclude deleted / archived      | pgTAP + E2E card text                                                                                                                             |
| AC-8 User B can't touch user A's data       | pgTAP                                                                                                                                             |
| AC-X1 No serious axe violations             | E2E, desktop layout (phone layout skipped: axe reports rows under the sticky bottom bar; real focus is kept clear with `scroll-padding`)          |
| AC-X2 Keyboard reachable, visible focus     | Semantic controls throughout; global `:focus-visible` ring. Manual keyboard pass still to do on a real device.                                    |
| AC-X3 No horizontal scroll at 320 px        | E2E                                                                                                                                               |

## Deviations from the plan

- **Worker tests** use plain Vitest with Hono's `app.request()` instead of `@cloudflare/vitest-pool-workers`: faster and simpler. Real `workerd` behaviour was checked with `wrangler dev` against local Supabase (assets, SPA fallback, headers, 401s, `/api/me` with a real token).
- **Local Supabase signs tokens with HS256**, so the Worker checks those with Supabase Auth; new hosted projects use asymmetric keys and are verified locally against JWKS (covered by unit tests).
- **Extra migration** `20261028000000_revoke_anon.sql` removes the default `anon` grants so signed-out requests fail loudly instead of returning empty lists.
- **Lighthouse** wasn't run (not available in the build container). Bundle is ~170 KB gzipped, mostly `supabase-js`.

## Still to do before calling Sprint 1 fully "done"

1. Owner: one-time setup in `docs/RUNBOOK.md` (Supabase, Google Cloud, Cloudflare, GitHub variables/secrets, backups).
2. First production deploy (automatic once `DEPLOY_ENABLED=true`), then sign in with a real Google account.
3. Manual checks on a real Android phone and iPhone: VoiceOver/TalkBack, keyboard, touch targets.
4. Lighthouse on Home and Topic detail.
5. Two days of real use, then write the retro notes here.
