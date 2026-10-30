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

### After pulling new code

```bash
pnpm install       # new or updated packages
pnpm db:migrate    # apply new migrations; keeps your local data
```

`pnpm db:start` applies migrations only when it first creates the local
database, so later migrations need `pnpm db:migrate`. Skipping it makes new
features fail with errors like "Could not find the function
public.complete_attempt(…) in the schema cache" or "Could not find the table
… in the schema cache". (`pnpm db:reset` also works, but wipes local data.)

Sign in with **Developer sign-in** (email + any password of 6+ characters; the
account is created on first use). Google login is off locally unless you set it up
(see `supabase/config.toml`).

| Command                     | What it does                                                                  |
| --------------------------- | ----------------------------------------------------------------------------- |
| `pnpm lint` / `pnpm format` | ESLint / Prettier                                                             |
| `pnpm typecheck`            | TypeScript in every package                                                   |
| `pnpm test`                 | Unit tests (web outbox, Worker auth and routes)                               |
| `pnpm db:test`              | pgTAP tests: RLS, ownership, triggers, `topic_stats`                          |
| `pnpm db:migrate`           | Apply new migrations to the local database, keeping its data                  |
| `pnpm db:reset`             | Recreate the local database from `supabase/migrations`                        |
| `pnpm db:types`             | Regenerate `packages/shared/src/database.types.ts` after a migration          |
| `pnpm --filter worker test:int` | Worker REST calls against local Supabase (pass `SUPABASE_INT_URL`, `SUPABASE_INT_ANON_KEY`, `SUPABASE_INT_SERVICE_ROLE_KEY` from `supabase status -o env`; CI does this) |
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

6. **Publishing to Keep needs no setup.** Share to Keep and Copy & open Keep run in the browser. Before calling Phase 4 done, check them by hand on real devices:
   - Android, Chrome: a joke card → **Publish to Keep** → **Share to Keep** → pick Keep. The note opens with the title and body filled in. Save, answer **Yes**, and the card shows "Sent to Keep".
   - iPhone, Safari (with the Keep app installed): the same. If Keep isn't in the share sheet, tap **More** and enable it.
   - A computer: **Copy & open Keep** copies the note and opens keep.google.com. Paste into a new note.

### Optional: Google Docs Joke Book

Off by default (`FEATURE_DOCS_SYNC=false`). When on, a **Connect Google** button
appears in Settings and **Add to Joke Book** in the Publish sheet. It needs a
second Google OAuth client, separate from the login one (docs/DESIGN.md §8.5).

1. **Google Cloud** (same project as login):
   - _APIs & Services → Library:_ enable the **Google Docs API**.
   - _Google Auth Platform → Data access:_ add the scope `https://www.googleapis.com/auth/drive.file`. It isn't a sensitive scope, so no security assessment is needed.
   - _Clients → Create client → Web application_, named "Joke Shovel integration". Authorized redirect URI: `<APP_BASE_URL>/api/integrations/google/callback` (for local testing also add `http://localhost:8787/api/integrations/google/callback`).
   - _Audience:_ set publishing status to **In production** and finish brand verification. In "Testing", only listed test users can connect and their access expires after 7 days.
2. **Worker secrets** (from `worker/`):

   ```bash
   pnpm exec wrangler secret put SUPABASE_SERVICE_ROLE_KEY         # Supabase → Project settings → API keys (secret)
   pnpm exec wrangler secret put GOOGLE_INTEGRATION_CLIENT_ID
   pnpm exec wrangler secret put GOOGLE_INTEGRATION_CLIENT_SECRET
   openssl rand -base64 32 | pnpm exec wrangler secret put TOKEN_ENCRYPTION_KEY
   openssl rand -base64 32 | pnpm exec wrangler secret put OAUTH_STATE_SIGNING_KEY
   ```

3. **GitHub variable** `FEATURE_DOCS_SYNC` = `true`, then re-run **Deploy**. If any secret is missing, the app keeps the feature hidden and Workers Logs show `docs integration is missing secrets` with the missing names (never values).
4. **Check it** with a consumer Gmail account: Settings → **Connect Google** → allow → back in Settings it says "Connected". Publish a joke with **Add to Joke Book**; a Doc called "The Joke Shovel — Joke Book" appears in Drive with the joke. Then revoke the app at <https://myaccount.google.com/permissions>, publish again, and check you see "Google access expired. Reconnect to publish."

To turn it off again, set `FEATURE_DOCS_SYNC=false` and deploy. Stored connections stay; they work again when it's turned back on.

**Locally:** run the Worker (`pnpm dev:worker`) with the `FEATURE_DOCS_SYNC` block in `worker/.dev.vars` filled in (see `.dev.vars.example`), and open the app at <http://localhost:8787>.

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
| `SUPABASE_SERVICE_ROLE_KEY` | Worker secret (Docs Joke Book) | Supabase → API keys → roll the secret key; `wrangler secret put` the new one |
| Google integration client secret | Worker secret | Google Cloud → Clients → add secret, `wrangler secret put GOOGLE_INTEGRATION_CLIENT_SECRET`, delete old |
| `TOKEN_ENCRYPTION_KEY`     | Worker secret            | `openssl rand -base64 32 \| wrangler secret put …`. Stored Google tokens can't be read any more, so users reconnect (the app asks them) |
| `OAUTH_STATE_SIGNING_KEY`  | Worker secret            | Replace any time; only sign-ins in progress at that moment fail |
