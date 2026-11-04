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
   - _Authentication → URL Configuration:_ Site URL = your Workers URL (e.g. `https://jokeshovel.<account>.workers.dev`); add `<site>/auth/callback` to Redirect URLs. Site URL has its own **Save** button; reload the page to check both values stuck.
2. **Google Cloud.** Create a project → _Google Auth Platform_:
   - Branding: app name "The Joke Shovel", support email, privacy policy URL.
   - Audience: External. Data access: scopes `openid`, `email`, `profile` only.
   - Audience → **Test users:** add your own Google account. While the app is in **Testing**, only listed test users (up to 100) can sign in.
   - Clients → Web application. Under **Authorized redirect URIs** (not JavaScript origins): `https://<project-ref>.supabase.co/auth/v1/callback`.
   - Paste the client ID and secret into Supabase's Google provider. Google shows the secret only once; if you lose it, use **Add secret** on the client page.
   - Basic scopes don't need verification. To let anyone sign in, and before turning on the Google Docs Joke Book, switch publishing status to **In production** and complete brand verification.
   - If sign-in fails, see [Troubleshooting](#troubleshooting).
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
   - Secrets: `SUPABASE_DB_URL` (Session pooler connection string from _Connect_; GitHub runners can't reach the direct connection), `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`.
   - Run _Actions → Nightly backup → Run workflow_ once to check it.
   - Check your key opens it: download the file from the bucket in the Cloudflare dashboard and run `age -d -i jokeshovel-backup.key jokeshovel-<timestamp>.tar.gz.age | tar tz`. It should list `backup/schema.sql`, `backup/roles.sql` and `backup/data.sql`.

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

## Trash, account deletion and backups

- **Trash purge:** the `purge-trash` pg_cron job runs nightly at 03:23 UTC and hard-deletes rows deleted more than 30 days ago. Check it in the Supabase dashboard under _Integrations → Cron_ (or `select * from cron.job_run_details order by start_time desc limit 5;`).
- **Account deletion** (Settings → Your data) removes the auth user and every row they own at once. Nightly backups made before that still contain their data until the R2 lifecycle rule expires them (30 days). If a user asks for their data to be gone from backups sooner, delete the backup objects from the bucket by hand.
- **Installable app:** nothing to configure. `apps/web/public/sw.js` caches only the app's own files (never `/api/*` or Supabase), and `_headers` serves it with `Cache-Control: no-cache` so new versions arrive straight away. To force an update, change `VERSION` in `sw.js`.

## Supabase Free plan notes

- No managed backups: the nightly workflow above is the backup.
- Inactive free projects are paused; the nightly backup queries the database,
  which should keep it active. A paused project can be restored from the dashboard.
- Limits worth watching monthly: 500 MB database, 50,000 monthly active users;
  Cloudflare Workers Free: 100,000 requests/day.

## Troubleshooting

### Production sign-in

Work through these in order; each fix gets you one step further.

| What you see | Cause | Fix |
| --- | --- | --- |
| `{"code":400,"error_code":"validation_failed","msg":"Unsupported provider: provider is not enabled"}` after **Continue with Google** | Google is off in Supabase. | Supabase → _Authentication → Sign In / Providers → Google_: enable it, paste the client ID and secret, **Save**. |
| Google: **Error 400: redirect_uri_mismatch** | The Google client doesn't allow Supabase's callback. | Google Cloud → _Google Auth Platform → Clients_ → the client whose ID is in Supabase → **Authorized redirect URIs** (not JavaScript origins): `https://<project-ref>.supabase.co/auth/v1/callback`, exactly (`https`, no trailing slash). Changes can take a few minutes. Google's **error details** link shows the `redirect_uri` it received. |
| Google: **Access blocked** or `access_denied` | The app is in Testing and this account isn't a test user. | _Audience → Test users_: add the account, or publish the app (step 2 of the setup). |
| Google: **Google hasn't verified this app** | Expected while the app is in Testing. | Click **Continue**. |
| Redirected to `http://localhost:3000/?error=server_error…Unable to exchange external code` | Supabase couldn't swap Google's code for a token: the client secret in Supabase is wrong (a typo, a stray space, or another client's secret). | Google client page → **Add secret**; paste it into Supabase's Google provider with no surrounding spaces, and check the Client ID comes from the same client. The `localhost` part is the next row. |
| Redirected to `http://localhost:3000/?code=…` (**This site can't be reached**) | Sign-in worked, but Supabase didn't find the app's callback on its allow list, so it fell back to its default Site URL. | Supabase → _Authentication → URL Configuration_: **Site URL** = `APP_BASE_URL` (it has its own **Save**); **Redirect URLs** contains exactly `<APP_BASE_URL>/auth/callback`. Reload the page to check, then sign in again. The code in the address is single-use and can be ignored. |

### Workflows

| What you see | Cause | Fix |
| --- | --- | --- |
| **Deploy** or **Nightly backup** runs show as _skipped_ | The `DEPLOY_ENABLED` / `BACKUP_ENABLED` repository variable isn't `true`. | Set it under _Settings → Secrets and variables → Actions → Variables_. |
| Backup log: `pg_dump: warning: there are circular foreign-key constraints` on `setups`, `joke_attempts`, `reinterpretations` | Expected. A setup can point to the setup it was branched from, and attempts and reinterpretations point at each other, so a data-only dump can't be loaded with those checks on. | Nothing. The restore command loads `data.sql` with `session_replication_role = replica`, which skips those checks ([Restoring a backup](#restoring-a-backup)). |

Local errors such as "Could not find the function … in the schema cache" are
covered in [After pulling new code](#after-pulling-new-code).

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
