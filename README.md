# The Joke Shovel ⛏️

A mobile-first workbench that helps comedians dig from a broad **topic** to a finished **setup-and-punch joke**, following the structured method in Greg Dean's *Step by Step to Stand-Up Comedy* and its companion workbook. When a joke is done, it can be sent to Google Keep.

- **Design document:** [`docs/DESIGN.md`](docs/DESIGN.md) (product, UX, data model, auth, Keep integration, architecture, phases, user stories, first sprint)
- **Phase 1 database migration:** [`supabase/migrations/20261027000000_phase1_core.sql`](supabase/migrations/20261027000000_phase1_core.sql)
- **Smoke tests for that migration** (plain Postgres, with a stub of Supabase's `auth` schema): [`supabase/tests/`](supabase/tests/)

## Stack

Supabase (Postgres, Auth with Google) · Cloudflare Workers (static assets plus a Hono API) · Vite + React + TypeScript · GitHub Actions

## Status

Design complete; Sprint 1 ("Break Ground") is ready to start. See §19 of the design doc.

## Run the migration smoke test locally (no Supabase needed)

```bash
createdb jokeshovel_smoke
psql -d jokeshovel_smoke -v ON_ERROR_STOP=1 \
  -f supabase/tests/local_auth_stub.sql \
  -f supabase/migrations/20261027000000_phase1_core.sql
psql -d jokeshovel_smoke -f supabase/tests/phase1_rls_smoke.sql
```

The last three statements are expected to fail or return 0. They show that a second user can't attach rows to, or edit, the first user's topic.
