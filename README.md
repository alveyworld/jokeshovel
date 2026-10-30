# The Joke Shovel ⛏️

A mobile-first workbench that helps comedians dig from a broad **topic** to a finished **setup-and-punch joke**, following the structured method in Greg Dean's _Step by Step to Stand-Up Comedy_ and its companion workbook. When a joke is done, it can be sent to Google Keep.

## Status

Built and tested locally; **not deployed yet** (needs the one-time account setup in the runbook).

- **Sprint 1:** Google sign-in, topics, association lists, setups, autosave that survives closed tabs and lost connections, topic counts, and "Resume digging".
- **Phase 2, the Joke Mine:** list a setup's assumptions, then take a joke attempt step by step: target, connector (tap words in the setup), reinterpretations, choice, second story, punch. Multiple attempts per setup, a "thread so far" panel, and a Drafts tab.
- **Phase 3, completed jokes:** a Review step that turns an attempt into a joke with a suggested title, an editable joke card with favorites and ratings, a Jokes tab with filters, typo-tolerant search across everything, and a Stats page with completion %, weekly charts and stuck drafts.
- **Phase 4, publishing:** a Publish sheet with a predictable note title (`Topic — Keywords — Joke`, keyword chips, editable), optional "how I dug it" sections and a live preview; **Share to Keep** on phones and **Copy & open Keep** everywhere, with a "Did it save?" check, a publish history, and Keep counts on topics and Stats. An optional Google Docs "Joke Book" is built but off by default.

Next: Phase 5, an improved writing workflow (quick switcher, tags, export, Trash, installable app).

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

After pulling new code, run `pnpm install` and `pnpm db:migrate`. `pnpm db:start` only applies migrations when it first creates the database, so without `db:migrate` new features fail with errors like "Could not find the function … in the schema cache".

Full instructions, production setup, deploys, rollback and backups: [`docs/RUNBOOK.md`](docs/RUNBOOK.md).

## Docs

- [`docs/DESIGN.md`](docs/DESIGN.md): product, UX, data model, auth, Keep publishing, architecture, phases, user stories
- [`docs/RUNBOOK.md`](docs/RUNBOOK.md): running, deploying, restoring
- [`docs/sprint-1-review.md`](docs/sprint-1-review.md), [`docs/phase-2-review.md`](docs/phase-2-review.md), [`docs/phase-3-review.md`](docs/phase-3-review.md), [`docs/phase-4-review.md`](docs/phase-4-review.md): what each phase delivered

## Stack

Supabase (Postgres, Auth with Google) · Cloudflare Workers (static assets + Hono API) · Vite + React 19 + TypeScript · TanStack Query · Vitest · Playwright · GitHub Actions
