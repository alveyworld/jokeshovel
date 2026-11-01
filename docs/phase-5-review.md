# Phase 5 review: an improved writing workflow

**Goal:** make the app faster to move around, easier to organize, and safer to trust with years of material.

**Result:** built and tested locally against Supabase. Like the earlier phases, it isn't deployed until the one-time setup in `docs/RUNBOOK.md` is done.

## What you can do now

1. **Quick switcher** (NAV-2). Press **⌘K / Ctrl-K**, or tap **⇄** in the top bar. Type a few letters to jump to a topic, setup, draft, joke or screen. With nothing typed it shows recent work. ↑/↓ move, Enter opens, Esc closes, and "Search everything for …" is always the last option.
2. **Keyboard shortcuts** (NAV-3):

   | Keys | Does |
   |---|---|
   | ⌘K / Ctrl-K | Quick switcher |
   | / | Search |
   | N | New item on this screen (topic, association, setup, assumption, reinterpretation) |
   | ] and [ | Next or previous Joke Mine step |
   | ? | Show the shortcuts |
   | ⌘Z / Ctrl-Z | Undo the last delete |

   Single-key shortcuts never fire while you're typing, and **Settings → Preferences → Single-key shortcuts** turns them off (WCAG 2.1.4). ⌘K and ⌘Z always work, and ⌘Z only acts outside text fields, so a field's own undo still works.
3. **Tags** (ORG-1). Add tags to any joke or topic ("Opener, clean set" adds two). Your existing tags are suggested as you type, and duplicates are merged whatever their case. The Jokes and Topics lists gain a **Tag** filter, and cards show their tags. **Settings → Tags** renames a tag everywhere, or deletes it.
4. **Branch and duplicate a setup** (SET-3). **Branch** copies the wording so you can try a variation; it starts with no assumptions, because new wording changes them. **Duplicate** copies the setup with its assumptions. Both remember where they came from: the setup page shows "Branch of …" and lists its branches.
5. **Trash** (ERR-3, ORG-2). **Settings → Your data → Open the Trash** lists deleted topics, setups, drafts and jokes from the last 30 days, with how long each has left. **Restore** brings a topic back with everything in it. **Delete for good** asks once more. A nightly job (pg_cron) empties anything older than 30 days.
6. **Export** (ORG-3). **Download Markdown** gives a readable file: each topic with its jokes (title, setup, punch, rating, tags, notes), setups and associations. **Download JSON** is a complete, versioned copy that can be read back and checked. The Trash isn't exported.
7. **Delete account** (FR-A4). Type "delete my account" to enable the button. You need to have signed in within the last 5 minutes; otherwise the app asks you to sign in again first. Everything you own is deleted, and the Google Docs connection is revoked first if you have one.
8. **Preferences:**
   - **Theme:** match your device, light or dark.
   - **Expert mode** (EXP-1) hides the explanations and tips on each screen; every control stays.
   - **Reduce motion** turns off animations even if your device doesn't ask for that.
9. **Install it** (PWA). On phones, "Add to Home screen" (or the install button on desktop Chrome) installs The Joke Shovel as an app. It opens offline. Your writing still saves on the device while offline, as before, and syncs when you're back.
10. **On phones:**
    - Swipe a topic card left for **Favorite**, **Archive** and **Delete** (the same buttons are on the topic's page).
    - The Joke Mine's **Back / Next** buttons stay in reach above the tab bar.
    - Completing a joke or confirming a Keep save gives a short buzz where the phone supports it.

## Definition of done

| Item | Status |
|---|---|
| Shortcuts documented in `?` help | ✅ The help lists every shortcut and shows which are off |
| PWA passes the installability check | ✅ A browser test against a production build checks the manifest (name, `start_url`, standalone display, 192 and 512 px icons), that the service worker takes control, and that the app opens offline |
| Export round-trip test | ✅ Unit tests write the JSON, read it back with `parseExport` and get identical data, and reject damaged files. A browser test downloads both files and checks their contents |

## Tests

- **Database:** `supabase/tests/database/phase5_workflow.test.sql` (30 assertions). It covers:
  - tag clean-up and limits
  - branch versus duplicate
  - the purge keeping recent rows and removing old ones (and its pg_cron schedule)
  - account deletion refusing a stale sign-in or the wrong phrase, then removing every row
  - other users and anon locked out

  132 database tests in total.
- **Unit:** export round trip and Markdown escaping (`packages/shared/src/export.test.ts`), shortcut rules (`apps/web/src/lib/shortcuts.test.ts`), preferences, and two new save-queue tests. 111 in total.
- **Browser:**
  - `apps/web/e2e/phase5.spec.ts`: switcher, shortcuts, tags, branch and duplicate, Trash, export, account deletion, preferences, swipe, axe, and a 320px screen
  - `apps/web/e2e/pwa.spec.ts`: installability and offline

  The full suite has 71 passing and 7 skipped by design (axe, keyboard shortcuts and swipe each run on one layout only). The Phase 5 spec passed 3 times in a row.

## Bugs found and fixed while testing

- **Tagging a brand-new topic failed** with "topic not found": the topic was still in the on-device save queue. Tag changes now save queued edits first, the same way completing a joke does.
- **Deleting an account didn't show the "deleted" message.** The redirect was dropped when signing out unmounted the page. It's now a full page load to the sign-in screen, which also clears everything from memory.
- **The quick switcher put focus on its Close button**, not the search box.
- **Long tag names widened the Topics filters and Settings rows** on a 320px phone.

## Deviations from the plan

- **Export is built in the browser**, not by `GET /api/export` on the Worker. It reads the same rows the app already can (RLS limits them to the user's own), pages through tables larger than the API's 1,000-row limit, and works without the Worker. No zip: two plain files.
- **Account deletion is a database function** (`delete_account`), not `DELETE /api/account` with the service role. It checks the confirmation phrase and the sign-in time (the `amr` timestamp in the session token, which refreshing doesn't change) and deletes the auth user, which cascades to every row. Backups keep deleted data until they expire (30 days; see the runbook).
- **Tags are changed with one database call per change** (`set_joke_tags`, `set_topic_tags`), not through the offline save queue. Tags organize; they aren't writing. Changing them needs a connection, and the app says so.
- **Swipe actions are on topic cards only.** Associations already delete with one tap and Undo.
- **Less-used screens load on demand** (Stats, Search, Settings, Trash, joke cards). The app fetches them in the background once it's idle, so they still open offline.
