# The Joke Shovel ⛏️

A mobile-first workbench that helps comedians dig from a broad **topic** to a finished **setup-and-punch joke**, following the structured method in Greg Dean's _Step by Step to Stand-Up Comedy_ and its companion workbook. When a joke is done, it can be sent to Google Keep.

## Status

**Sprint 1 ("Break Ground") built and tested locally; not deployed yet** (needs the one-time account setup in the runbook). It includes: Google sign-in, topics, association lists, setups, autosave that survives closed tabs and lost connections, topic counts, and "Resume digging". Next: Phase 2, the guided Joke Mine.

## Repository layout

```
apps/web/          Vite + React + TypeScript single-page app
worker/            Cloudflare Worker (Hono): serves the app and /api/*
packages/shared/   Types generated from the database, shared constants
supabase/          config.toml, migrations/, tests/ (pgTAP)
docs/              DESIGN.md, RUNBOOK.md, sprint reviews
.github/workflows/ ci.yml, deploy.yml, backup.yml
```

## Quick start

```bash
pnpm install
pnpm db:start            # local Supabase in Docker
cp apps/web/.env.example apps/web/.env.local     # fill in ANON_KEY from `pnpm exec supabase status -o env`
pnpm dev                 # http://localhost:5173
```

Full instructions, production setup, deploys, rollback and backups: [`docs/RUNBOOK.md`](docs/RUNBOOK.md).

## Docs

- [`docs/DESIGN.md`](docs/DESIGN.md): product, UX, data model, auth, Keep publishing, architecture, phases, user stories
- [`docs/RUNBOOK.md`](docs/RUNBOOK.md): running, deploying, restoring
- [`docs/sprint-1-review.md`](docs/sprint-1-review.md): what Sprint 1 delivered and what's left

## Stack

Supabase (Postgres, Auth with Google) · Cloudflare Workers (static assets + Hono API) · Vite + React 19 + TypeScript · TanStack Query · Vitest · Playwright · GitHub Actions
