# Runbook

How to run, deploy, roll back, and restore The Joke Shovel.

## Local development

Requirements: Node 22+, pnpm 10 (`npm install -g pnpm@10`), Docker Desktop (running).

```bash
pnpm install                      # at the repository root
pnpm db:start                     # local Supabase (Postgres, Auth, REST) in Docker
cp apps/web/.env.example apps/web/.env.local
pnpm exec supabase status -o env  # copy ANON_KEY into apps/web/.env.local
pnpm dev                          # web app on http://localhost:5173
```

The Worker (`/api/*`) isn't needed by the app yet. To run it too, in a second
terminal: `cp worker/.dev.vars.example worker/.dev.vars`, paste the same anon key,
then `pnpm dev:worker` (builds the web app, then serves it and the API on :8787).

Sign in with **Developer sign-in** (email + any password of 6+ characters; the
account is created on first use). Google login is off locally unless you set it up
(see `supabase/config.toml`).

| Command                     | What it does                                                                  |
| --------------------------- | ----------------------------------------------------------------------------- |
| `pnpm lint` / `pnpm format` | ESLint / Prettier                                                             |
| `pnpm typecheck`            | TypeScript in every package                                                   |
| `pnpm test`                 | Unit tests (web outbox, Worker auth and routes)                               |
| `pnpm db:test`              | pgTAP tests: RLS, ownership, triggers, `topic_stats`                          |
| `pnpm db:reset`             | Recreate the local database from `supabase/migrations`                        |
| `pnpm db:types`             | Regenerate `packages/shared/src/database.types.ts` after a migration          |
| `pnpm e2e`                  | Playwright end-to-end tests (needs `pnpm db:start` and `apps/web/.env.local`) |

### Adding a migration

```bash
pnpm exec supabase migration new <name>   # edit the new file in supabase/migrations
pnpm db:reset && pnpm db:test && pnpm db:types
```

Migrations are forward-only. Split destructive changes across two releases
(add the new thing, ship, then remove the old thing).

## One-time production setup

Everything runs on free tiers (docs/DESIGN.md §18.1).

1. **Supabase.** Create a project (Free plan). Note the project ref, URL, anon key and database password.
   - _Authentication → Sign In / Providers:_ enable **Google**; **disable Email** (the dev sign-in must never work in production).
   - _Authentication → URL Configuration:_ Site URL = your Workers URL (e.g. `https://jokeshovel.<account>.workers.dev`); add `<site>/auth/callback` to Redirect URLs.
2. **Google Cloud.** Create a project → _Google Auth Platform_:
   - Branding: app name "The Joke Shovel", support email, privacy policy URL.
   - Audience: External. Data access: scopes `openid`, `email`, `profile` only.
   - Clients → Web application. Authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`.
   - Paste the client ID and secret into Supabase's Google provider.
   - Basic scopes don't need verification. Before Phase 4 (Google Docs Joke Book) switch publishing status to **In production** and complete brand verification.
3. **Cloudflare.** Create an API token with the _Edit Cloudflare Workers_ template. Note the account ID.
4. **GitHub → Settings → Secrets and variables → Actions.**

   | Kind     | Name                    | Value                                                     |
   | -------- | ----------------------- | --------------------------------------------------------- |
   | Variable | `DEPLOY_ENABLED`        | `true`                                                    |
   | Variable | `SUPABASE_PROJECT_REF`  | project ref                                               |
   | Variable | `SUPABASE_URL`          | `https://<ref>.supabase.co`                               |
   | Variable | `SUPABASE_ANON_KEY`     | anon (publishable) key; safe to expose, RLS protects data |
   | Variable | `APP_BASE_URL`          | the Workers URL                                           |
   | Secret   | `SUPABASE_ACCESS_TOKEN` | Supabase personal access token                            |
   | Secret   | `SUPABASE_DB_PASSWORD`  | database password                                         |
   | Secret   | `CLOUDFLARE_API_TOKEN`  | from step 3                                               |
   | Secret   | `CLOUDFLARE_ACCOUNT_ID` | from step 3                                               |

   Create a GitHub environment named `production` (optionally with required reviewers).

5. **Backups** (required on the Free plan):
   - Create an R2 bucket (e.g. `jokeshovel-backups`) with a 30-day lifecycle rule, and an R2 API token with write access to it.
   - `age-keygen -o jokeshovel-backup.key` on your own machine. Keep the key file offline (password manager); it is the only way to read backups.
   - Variables: `BACKUP_ENABLED=true`, `R2_BACKUP_BUCKET`, `BACKUP_AGE_RECIPIENT` (the `age1…` public key).
   - Secrets: `SUPABASE_DB_URL` (Session pooler connection string from _Connect_), `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`.
   - Run _Actions → Nightly backup → Run workflow_ once to check it.

## Deploying

Merging to `main` runs CI; when CI passes, **Deploy** applies migrations
(`supabase db push`) and then deploys the Worker and the web build
(`wrangler deploy`). It can also be started by hand from the Actions tab.

## Rolling back

- **Worker / web:** `cd worker && pnpm exec wrangler rollback` (or _Workers → jokeshovel → Deployments_ in the Cloudflare dashboard). Assets roll back with the Worker.
- **Database:** migrations are not rolled back automatically. Write a new forward migration that undoes the change. If data was damaged, restore (below).

## Restoring a backup

```bash
aws s3 cp s3://<bucket>/jokeshovel-<timestamp>.tar.gz.age . --endpoint-url https://<account-id>.r2.cloudflarestorage.com
age -d -i jokeshovel-backup.key jokeshovel-<timestamp>.tar.gz.age | tar xz
# Restore into a NEW scratch project first and check it:
psql "$SCRATCH_DB_URL" -f backup/roles.sql
psql "$SCRATCH_DB_URL" -f backup/schema.sql
psql "$SCRATCH_DB_URL" -c 'set session_replication_role = replica' -f backup/data.sql
```

Do a restore drill into a scratch project once a quarter.

## Supabase Free plan notes

- No managed backups: the nightly workflow above is the backup.
- Inactive free projects are paused; the nightly backup queries the database,
  which should keep it active. A paused project can be restored from the dashboard.
- Limits worth watching monthly: 500 MB database, 50,000 monthly active users;
  Cloudflare Workers Free: 100,000 requests/day.

## Secrets

| Secret                     | Where                    | Rotate by                                                                                    |
| -------------------------- | ------------------------ | -------------------------------------------------------------------------------------------- |
| Supabase DB password       | Supabase, GitHub secret  | Supabase → Database settings; update `SUPABASE_DB_PASSWORD` and `SUPABASE_DB_URL`            |
| Supabase access token      | GitHub secret            | Supabase account → Access tokens                                                             |
| Google login client secret | Supabase Google provider | Google Cloud → Clients → add secret, update Supabase, delete old                             |
| Cloudflare API token       | GitHub secret            | Cloudflare → API tokens → Roll                                                               |
| R2 keys                    | GitHub secrets           | Cloudflare → R2 → API tokens                                                                 |
| Backup `age` key           | Offline only             | Generate a new key, update `BACKUP_AGE_RECIPIENT`; keep the old key until its backups expire |
