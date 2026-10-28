# The Joke Shovel — Product & Technical Design

| | |
|---|---|
| **Status** | Draft v0.2 — ready for Sprint 1 (owner decisions recorded in §18.1) |
| **Date** | 2026-10-27 |
| **Owner** | Zack Alvey |
| **Stack** | Supabase (Postgres + Auth) · Cloudflare Workers · Vite + React + TypeScript · GitHub Actions |

> **About the source method.** The Joke Shovel is built around the joke-writing process taught in Greg Dean's *Step by Step to Stand-Up Comedy* and its companion workbook. This document describes those ideas in its own words and does not quote the books. The app should point users to the books for the full method; it is a workbench, not a replacement for them.

---

## Contents

1. [Executive summary](#1-executive-summary)
2. [Product vision](#2-product-vision)
3. [Guiding principles from the joke-writing method](#3-guiding-principles-from-the-joke-writing-method)
4. [Target users](#4-target-users)
5. [User experience and navigation](#5-user-experience-and-navigation)
6. [Functional requirements](#6-functional-requirements)
7. [Data model](#7-data-model)
8. [Google login and authentication](#8-google-login-and-authentication)
9. [Google Keep integration](#9-google-keep-integration)
10. [Technical architecture](#10-technical-architecture)
11. [Security and privacy](#11-security-and-privacy)
12. [Accessibility](#12-accessibility)
13. [Development phases](#13-development-phases)
14. [Prioritized user stories](#14-prioritized-user-stories)
15. [Acceptance criteria](#15-acceptance-criteria)
16. [Prototype plan](#16-prototype-plan)
17. [Testing strategy](#17-testing-strategy)
18. [Risks and open questions](#18-risks-and-open-questions)
19. [Recommended first sprint](#19-recommended-first-sprint)
20. [Future roadmap](#20-future-roadmap)

---

## 1. Executive summary

The Joke Shovel is a mobile-first web app that takes a comedian from a broad **topic** to a finished **setup-and-punch joke**, one small decision at a time. It follows the structured method from Greg Dean's books. In the *Prospector* stage the comedian digs around a topic for associations and setups. In the *Mine* stage they take one setup apart (its assumptions, the connector, other ways to read the connector) and rebuild it into a punch.

Every keystroke is saved. The user can leave in the middle of step 7, come back three weeks later on another device, and land on the same field. Each topic shows how much has been dug out of it: associations, setups, unfinished attempts, finished jokes, and jokes sent to Google Keep.

**Key decisions**

| Decision | Choice | Why |
|---|---|---|
| Frontend | Vite + React + TypeScript single-page app, served as Cloudflare Workers static assets | Simple to build, very large ecosystem, easy to deploy on Workers. No server rendering is needed for an app behind a login. |
| Server | One Cloudflare Worker (Hono router) under `/api/*` | Handles secrets, Google integration, rate limiting, and export. Ordinary create/read/update/delete goes straight to Supabase. |
| Data | Supabase Postgres with Row Level Security on every table | The browser can read and write its own rows safely, which keeps the API surface small. |
| Auth | Supabase Auth, Google provider, PKCE | Required. Login asks only for `openid email profile`. |
| Keep publishing | **Share-first.** (1) Share sheet / copy-and-open on every account. (2) Optional Google Docs "Joke Book" sync as the automatic alternative. The direct Keep API is **not planned**. | The Google Keep API is an enterprise (Workspace) API and isn't usable from ordinary @gmail.com accounts, and the owner has no Workspace account. See §9. |
| Cost | **Free app.** Runs on the free tiers of Supabase, Cloudflare Workers, KV, and R2. | The owner's decision. See §10.11 and §18.1 for what the free tiers mean. |
| AI | Not in v1. A possible later add-on that only *asks questions* and never writes jokes. | The comedian makes the creative decisions. |

**First usable prototype:** end of Sprint 1 (2 weeks). Google login, topics, association lists, setups, autosave, and topic counts, deployed to a Workers URL.

---

## 2. Product vision

> *"Every topic is a dig site. Keep shoveling and you'll hit a joke."*

**Problem.** The method works, but it is a long chain of small steps, and on paper or in a notes app the chain breaks. People lose the association list, forget which assumption they were aiming at, or can't find the half-finished punch from last Tuesday. Experienced writers end up with hundreds of fragments and no picture of which topics are producing material.

**Vision.** A calm, encouraging workbench that:

- shows the comedian **exactly one decision at a time** while keeping the whole dig in view,
- **never loses anything**, so short sessions on a phone are worth it,
- makes progress visible (it feels like hauling material out of a mine),
- moves finished jokes to where the comedian already keeps their set lists (Google Keep).

**Theme.** A friendly mining and digging metaphor in the copy, icons, and empty states, never in the way of clarity:

| Concept | Playful label (secondary) | Plain label (always shown) |
|---|---|---|
| Dashboard | The Dig Site | Home |
| Topic | Claim | Topic |
| Association list | Surface survey | Associations |
| Setups list | Test holes | Setups |
| Joke attempt in progress | Open shaft | Draft joke |
| Completed joke | Nugget | Joke |
| Favorite joke | Gold | Favorite |
| Published to Keep | Hauled to town | Published |

Plain labels are what screen readers announce and what forms use. Playful labels are decoration (headings, empty states, celebrations).

**Visual identity: the legal pad.** Comedians write on yellow legal pads, so the app looks like one (reference: `docs/brand/legal-pad-reference.png`).

| Element | Treatment |
|---|---|
| Page | Legal-pad yellow `#F3EE8A` ruled with teal lines `#59A191` every 28 px, and a double red margin line `#AF4044` at the left. Content starts to the right of the margin. |
| Binding | Charcoal `#4E4E4E` top bar (with a darker top edge) and charcoal bottom tabs / side rail. Active tab and focus rings on the binding use the pad yellow. |
| Cards | Off-white index cards `#FFFDF2` laid on the pad, small radius, soft shadow. |
| Logo | The illustrated shovel with "JS" on the blade and the distressed "JOKE SHOVEL" wordmark. Full lockup on the sign-in page; blade icon + light wordmark in the top bar; blade icon as favicon and app icon. Cut from the reference by `tools/brand/extract.py`. Replace with original artwork files when available. |
| Type | Headings in Alfa Slab One (self-hosted, OFL), echoing the wordmark's slab letters; body text in the system sans for readability. |
| Accents | Shovel-handle brown `#7A4630` for buttons and links; gold stars. |
| Dark mode | "Night pad": charcoal-olive paper `#23221C` with dim teal rules and a muted margin; the same layout. |

All text and UI colours are checked against WCAG AA in both themes (see `apps/web/src/styles/tokens.css`).

**Success metrics (prototype)**

- Users who start a topic go on to write at least one setup (activation): ≥ 60%.
- Joke attempts resumed after leaving: ≥ 40% within 14 days.
- Data loss reports: **zero**.
- Median time from opening the app to typing in a field: < 3 seconds on a mid-range phone.

---

## 3. Guiding principles from the joke-writing method

### 3.1 The method in brief (paraphrased)

A joke works because the **setup** leads the audience to picture one scenario, and the **punch** shows a second, different scenario that fits the same words. The setup quietly makes the audience assume things. One of those assumptions, the **target assumption**, is the one the punch will break. The target rests on a **connector**: a word, phrase, or idea in the setup that can be read in more than one way. The audience reads it one way. The joke is built by finding **another way to read it** (a reinterpretation), imagining the situation in which that reading would be true (the **second story**), and writing a **punch** that shows that second story as briefly as possible.

There are two digging modes:

- **Joke Prospector (topic → setups).** Start from a broad subject, brainstorm associations, and turn promising ones into setups.
- **Joke Mine (setup → punch).** Start from one setup and work through the steps that turn it into a punch.

### 3.2 Glossary (canonical definitions used across the app)

These definitions appear as in-app help tooltips ("What's this?") and in onboarding. They are written for this app and are not quoted from the books.

| Term | Definition in The Joke Shovel | Example (original) |
|---|---|---|
| **Topic** | A broad subject you want to write about. A topic holds many setups. | "Airports" |
| **Association** | Anything the topic makes you think of: people, objects, places, feelings, phrases, opinions. Raw material, not jokes. | "TSA", "layover", "neck pillow" |
| **Setup** | A sentence or two, usually true or believable, that sets the scene. The audience starts picturing a scenario. | "My flight had a six-hour layover." |
| **Assumption** | Something the audience automatically believes after hearing the setup, even though it wasn't said. A setup produces several. | "The layover is an inconvenience." "The speaker is a passenger." |
| **Target assumption** | The single assumption you choose to break. Each joke attempt has exactly one. | "The speaker is a passenger." |
| **Connector** | The specific word, phrase, or idea in the setup that the target assumption depends on, and that could be read another way. | "my flight" |
| **Reinterpretation** | A different, still-valid reading of the connector that makes the target assumption false. You brainstorm several and pick one. | "my flight" = the flight I'm *piloting* |
| **Second story** | The situation or scenario in which the reinterpretation is true. It is the hidden story the punch reveals. | The speaker is the pilot, stranded and bored in the cockpit. |
| **Punch** | The line that reveals the second story, as briefly as possible, ideally with the surprising word last. | "So I just sat in the cockpit doing loop-de-loops on the tarmac." |
| **Completed joke** | A setup and punch the comedian has marked as done, along with the reasoning path that produced it. It is the thing you collect, tag, and publish. | Setup + punch |

### 3.3 Product principles that follow from the method

1. **One decision per screen.** The Mine is a sequence of decisions. Each step gets its own focused panel with one main input and one main action.
2. **The comedian decides; the app asks.** Prompts are questions ("What does the audience assume about *who* is speaking?"), never generated answers.
3. **Lists before choices.** Wherever the method asks for a choice (setup, target assumption, reinterpretation), the app first encourages a *list*, then asks the user to choose one. The rest of the list stays available for another attempt.
4. **Branching is normal.** One setup can lead to many attempts (different targets). One attempt can try many reinterpretations. The model supports this from day one.
5. **Nothing is wasted.** Unchosen associations, assumptions, and reinterpretations stay saved. They are the spoil heap you dig through later.
6. **Show the thread.** Every screen in the Mine shows a compact "thread" of the decisions so far: Setup → Target → Connector → Reinterpretation → Second story → Punch.
7. **Gentle guidance, no gatekeeping.** Steps are recommended in order but never locked. The user can jump to the punch if inspiration strikes, and the app marks earlier steps as "skipped" without blocking.

---

## 4. Target users

| Persona | Context | Needs | Design implications |
|---|---|---|---|
| **Bea, the beginner** — learning the method from the book | Laptop at home plus phone on the bus. Has done 2 open mics. | Understand each step. Not feel stupid. See examples. Know what to do next. | Inline "What's this?" help on every step, worked examples, a progress stepper, encouraging empty states, a "Next step" button that is always visible. |
| **Marcus, the working comic** — 10 years in, hundreds of fragments | Phone between sets, desktop for writing sessions | Speed. Organize lots of material. Find old ideas quickly. Capture fast, refine later. | Quick capture, search and filters, keyboard shortcuts, tags, favorites, bulk views, collapsible guidance ("Expert mode" hides help text). |
| **Sam, the snacker** — writes in 5-minute bursts | Phone, one thumb, often offline (subway) | Open the app and be typing in seconds. Never lose a thought. | "Resume digging" card on Home, local draft buffer, offline indicator, large touch targets, minimal fields per screen. |
| **Riley, the returner** — comes back after weeks away | Any device | Remember where they were and why. See unfinished work. | "Open shafts" list sorted by recency, the decision thread shown on resume, "last edited 3 weeks ago" timestamps, notes and reflections per attempt. |

---

## 5. User experience and navigation

### 5.1 Information architecture

```
Home (Dig Site)
├── Topics
│   └── Topic detail
│       ├── Associations workspace        (Prospector: steps 1–2)
│       ├── Setups list                   (Prospector: steps 3–4)
│       │   └── Setup detail              (assumptions live here; Mine step 5)
│       │       └── Joke attempt (Mine workspace)
│       │           ├── Target            (6)
│       │           ├── Connector         (7)
│       │           ├── Reinterpretations (8–9)
│       │           ├── Second story      (10)
│       │           ├── Punch             (11)
│       │           └── Review            (12) → Completed joke
│       └── Jokes from this topic
├── Drafts (all unfinished attempts, across topics)
├── Jokes (all completed jokes)
│   └── Joke detail / review → Publish sheet (13)
├── Search
├── Stats
└── Settings (account, integrations, preferences)
```

### 5.2 Global navigation

- **Phone (< 640 px):** a bottom tab bar with 4 tabs (**Home · Topics · Drafts · Jokes**) and a search icon in the top bar. Each tab button is at least 48 × 48 px.
- **Tablet (640–1024 px):** the same tabs as a left rail. On the Topic and Setup screens a two-pane layout shows the list on the left and detail on the right.
- **Desktop (> 1024 px):** left rail, list pane, and workspace pane. The Mine's thread panel is pinned on the right.
- **Breadcrumb** on every nested screen: `Airports › "My flight had a six-hour layover." › Attempt 2`. Each part is a link.
- **Quick switcher** (⌘/Ctrl-K on desktop, the "⇄" button in the top bar on phone): a searchable sheet listing recent topics, setups, and drafts. It is the fastest way to jump between work.
- **Resume button:** Home always shows a large "Resume digging" card that goes to `profiles.last_location`.
- **Back/forward:** each screen and Mine step has its own URL (e.g. `/a/:attemptId/connector`). Browser back and forward work as expected. Because everything autosaves, no navigation ever loses work and there are no "unsaved changes" dialogs.

### 5.3 Screens

For each screen: purpose, main content, and primary actions. Wireframes are ASCII and describe phone width.

#### Home — "The Dig Site"

- **Resume digging** card (the last place edited, with its thread summary).
- **Open shafts:** the 5 most recently touched unfinished attempts (topic · setup excerpt · current step · "3 days ago").
- **Recent topics** with mini stats chips.
- **Haul this week:** associations added, setups written, jokes completed. A small celebratory note when a joke is finished ("You struck gold ⛏️").
- Primary action: **+ New topic**. Secondary: **Quick setup** (pick a topic, type a setup).

```
┌──────────────────────────────┐
│ ⛏ The Joke Shovel      ⇄  🔍 │
├──────────────────────────────┤
│ RESUME DIGGING               │
│ Airports › "My flight had…"  │
│ Step 8 of 12 · Reinterpret   │
│ [ Continue → ]               │
├──────────────────────────────┤
│ Open shafts (4)        See all│
│ • Dentists — Connector · 2d  │
│ • Airports — Punch · 5d      │
├──────────────────────────────┤
│ Topics                 See all│
│ Airports  12 assoc · 4 setups│
│           1 draft · 2 jokes  │
├──────────────────────────────┤
│ [ + New topic ]              │
├──────────────────────────────┤
│ Home  Topics  Drafts  Jokes  │
└──────────────────────────────┘
```

#### Topic list

- Cards showing title, description excerpt, and stats chips (associations · setups · drafts · jokes · published), plus "active 2d ago" and a completion ring.
- Sort: recent activity (default), A–Z, most jokes, most unfinished. Filter: active / archived / favorites / tag.
- Swipe left on phone, or use the overflow menu: archive, favorite, delete (moves to Trash).

#### Topic detail

- Header: editable title and description (autosaved), completion ring, stats row.
- Segmented control: **Associations · Setups · Jokes · Notes**.
- "Dig deeper" prompt cards that suggest the next action ("You have 14 associations and 0 setups. Try turning two associations into a setup").

#### Association-list workspace (Prospector, step 2)

- One always-focused input at the top with a placeholder that rotates through prompts ("People you'd find here?", "Things you can hold?", "What annoys you about it?", "Opinions people have?").
- **Enter** adds the item and keeps focus, for rapid-fire brainstorming. Each item is a chip or row. Tap to edit, star it, or swipe to delete (Undo appears in a toast).
- **Timer** (optional, Could Have): a 5-minute brainstorming sprint.
- Selecting 1–3 starred associations and choosing **"Make a setup from these"** opens the setup composer with those associations shown as context.

#### Setup list (Prospector, steps 3–4)

- Each row shows the setup text, the number of attempts, the best status ("2 jokes · 1 draft"), and a favorite star.
- **+ New setup** opens an inline composer. Saving is automatic, and an empty setup is a valid draft.
- Choosing a setup to work on: **"Mine this setup"** opens Setup detail.

#### Setup-detail workspace (Mine, step 5)

- The setup text is editable at the top.
- An **Assumptions list** with prompt chips the user can tap for a nudge: *Who? Where? When? What's happening? Why? What does a word mean?* Each chip turns into a question in the input placeholder, not an answer.
- **Attempts on this setup:** a list of joke attempts, each with its target assumption and current step. Primary action: **Start a joke attempt** (step 6).
- Overflow menu: duplicate or branch setup, archive, notes.

#### Joke Mine workspace (steps 6–11)

A **stepper** layout with one decision per panel:

```
┌──────────────────────────────┐
│ ‹ Airports › My flight…   ⋯  │
│ ●──●──●──○──○──○──○  Step 7  │
│ Target ✓ Connector ● …       │
├──────────────────────────────┤
│ THE THREAD                 ▾ │
│ Setup: My flight had a six-  │
│   hour layover.              │
│ Target: I'm a passenger.     │
├──────────────────────────────┤
│ CONNECTOR                    │
│ Which word or idea in the    │
│ setup makes the audience     │
│ believe the target?    (?)   │
│ ┌──────────────────────────┐ │
│ │ my flight                │ │
│ └──────────────────────────┘ │
│ Tap words in the setup:      │
│ [My] [flight] [had] [a] …    │
│                    Saved ✓   │
├──────────────────────────────┤
│ [ ‹ Back ]   [ Next: Reinterp›]│
└──────────────────────────────┘
```

| Step | Panel | Main input | Main action |
|---|---|---|---|
| 6 Target | List of the setup's assumptions as radio cards, plus "+ add assumption" | Choose one | Next |
| 7 Connector | Text field plus **tappable word chips** from the setup that fill the field | Connector text and optional "why" note | Next |
| 8 Reinterpretations | Rapid-fire list (same pattern as associations), prompt: "What else could *my flight* mean?" | Add many | Choose one |
| 9 Choose | Radio cards of reinterpretations | Choose one | Next |
| 10 Second story | Multiline field with the prompt "In what situation would *[reinterpretation]* be true? Describe it." | Free text | Next |
| 11 Punch | Multiline field with the setup shown directly above it so it reads naturally. A tip: "Can you reveal the second story in fewer words? Put the surprise last." Character and word count. | Punch text | Review |

The stepper dots are links, so the user can jump anywhere. Steps they skipped show a hollow dot with an outline. The thread panel collapses on phone and is pinned on desktop.

#### Reinterpretation workspace

This is step 8–9 of the Mine. It gets more room because it is where most of the creative digging happens:

- The connector is shown large at the top.
- Brainstorm list items can be starred. A **"Try another target"** link creates a new attempt on the same setup and copies nothing except the setup.
- Choosing a reinterpretation stores `selected_reinterpretation_id`. The others stay available ("Spoil heap: 6 other readings"). Choosing a different one later is allowed and does not delete the second story or punch, but the app shows "Your second story was written for *X*; review it?"

#### Completed-joke review page (step 12)

- Big readable **Setup / Punch** card, set like a performance card.
- An expandable "How you dug it" section shows the target, connector, reinterpretation, and second story.
- Fields: title (auto-suggested, editable), tags, favorite, a 1–5 "strength" rating, and notes or reflection ("Where would this go in a set?").
- Primary action: **Mark as complete** (creates the completed-joke record; a small "Nugget!" animation that respects `prefers-reduced-motion`). Secondary: **Keep digging** (back to the Punch step).
- Once a joke is complete the page becomes the Joke detail page and gains **Publish to Keep** and **Edit**.

#### Google Keep publishing interface (step 13)

A bottom sheet or modal:

```
┌──────────────────────────────┐
│ Publish to Google Keep       │
│ Title                        │
│ ┌──────────────────────────┐ │
│ │ Airports — Flight Layover│ │
│ │ — Joke                   │ │
│ └──────────────────────────┘ │
│ Keywords: [flight✓][layover✓]│
│           [six-hour]         │
│ Include:                     │
│ ☑ Setup & punch (required)   │
│ ☐ Target assumption          │
│ ☐ Connector & reinterpret.   │
│ ☐ Second story               │
│ ☑ Date & link back           │
│ ── Preview ─────────────────  │
│ My flight had a six-hour…    │
├──────────────────────────────┤
│ [ Share to Keep ] [ Copy ]   │
└──────────────────────────────┘
```

The buttons depend on the account (§9). There is a live preview of the exact note body and a publish history below ("Shared via share sheet · Oct 27 · ✓ confirmed").

#### Search and filtering

- One search field covering topics, associations, setups, punches, and notes. Results are grouped by type, with the match highlighted.
- Filters: type, topic, status (draft / complete / published / archived), tag, favorite, rating ≥ N, date range.
- Saved filters (Could Have): "Favorites not yet on Keep".

#### Progress and statistics

- Per-topic table of the §6.4 statistics, sortable.
- Totals and a weekly bar chart of setups written and jokes completed.
- "Stuck shafts": attempts with no edits in 14+ days, with a Resume link.
- A funnel showing associations → setups → attempts → completed → published.

#### Account and integration settings

- Profile: display name, time zone.
- Preferences: Expert mode (hide help text), reduced motion, theme (system / light / dark), default note-detail checkboxes.
- **Integrations:** Google Keep publishing method (*Share sheet* / *Copy & open*), Google Docs Joke Book, connect/disconnect buttons, and the scopes granted.
- Data: export everything (Markdown / JSON), Trash (restore within 30 days), delete account.
- Sign out (this device) and Sign out everywhere.

### 5.4 Key user flows

**Flow A — First joke (beginner)**
Sign in → onboarding (3 cards explaining Topic → Setup → Joke) → New topic "Airports" → add associations → star two → "Make a setup" → write setup → "Mine this setup" → list assumptions → Start attempt → choose target → connector (tap words) → brainstorm reinterpretations → choose → second story → punch → Review → Mark complete → Publish.

**Flow B — Quick capture (snacker)**
Open app → Home → "Quick setup" → choose a recent topic → type the setup → leave the app. Next time, Home shows it under Resume.

**Flow C — Return later (returner)**
Open app → Resume card → lands on `/a/:id/punch` with the thread expanded and a "last edited 19 days ago" banner, plus that attempt's notes.

**Flow D — Switch between work (experienced)**
⌘K → type "dent" → choose "Dentists › 'My dentist…' › Attempt 1 · Connector" → edit → ⌘K → "air" → … Nothing to save, nothing lost.

**Flow E — Many attempts from one setup**
Setup detail → Attempts (2) → "Start another attempt" → choose a different target assumption → the Mine runs again. Both attempts show in the setup's list.

---

## 6. Functional requirements

IDs are referenced from the user stories and phases.

### 6.1 Accounts and sessions
- **FR-A1** Sign in with Google (Supabase Auth). No passwords.
- **FR-A2** A profile row is created automatically on first sign-in.
- **FR-A3** Sign out on this device, and sign out everywhere.
- **FR-A4** Delete account and all data (cascade), with a typed confirmation.

### 6.2 Prospector (topics, associations, setups)
- **FR-P1** Create, rename, describe, favorite, archive, restore, and soft-delete topics.
- **FR-P2** Add, edit, reorder, star, and delete associations within a topic, with undo.
- **FR-P3** Create setups under a topic, optionally linked to source associations (Could Have).
- **FR-P4** Edit, favorite, archive, duplicate, branch, and soft-delete setups.

### 6.3 Mine (attempts)
- **FR-M1** List assumptions for a setup (add, edit, reorder, delete).
- **FR-M2** Start one or more joke attempts per setup.
- **FR-M3** Choose exactly one target assumption per attempt (changeable).
- **FR-M4** Record the connector (free text and/or word chips) with an optional note.
- **FR-M5** Brainstorm many reinterpretations per attempt and choose one (changeable).
- **FR-M6** Write a second story and a punch.
- **FR-M7** Track `current_step`. Steps can be visited in any order. Skipped steps are shown as skipped.
- **FR-M8** Attach notes and reflections to topics, setups, attempts, and jokes.

### 6.4 Completion, collection, statistics
- **FR-C1** Mark an attempt complete. This requires non-empty setup and punch text and creates a **completed joke** snapshot.
- **FR-C2** Edit a completed joke (setup and punch text, title, tags, rating, notes) without changing the attempt's history.
- **FR-C3** Reopen a completed joke for more digging (creates a new attempt pre-filled from it; Should Have).
- **FR-C4** Favorites, a 1–5 rating, and tags.
- **FR-C5** Per-topic statistics (definitions in §7.6) on the topic list, topic detail, and stats page.
- **FR-C6** Search and filter across all entity types.

### 6.5 Persistence
- **FR-S1** Every field autosaves (debounced 800 ms, plus when the field loses focus, plus when the page is hidden).
- **FR-S2** A visible save state on every editing screen: *Saving… / Saved ✓ / Offline — saved on this device / Couldn't save — Retry*.
- **FR-S3** Edits made offline are buffered locally and replayed in order when the connection returns.
- **FR-S4** The last location is remembered per user and used by Resume.
- **FR-S5** Soft delete with a 30-day Trash. Undo toast for 8 seconds after any delete.

### 6.6 Publishing
- **FR-K1** Generate a suggested note title using the format `[Topic] — [Setup Keywords] — Joke` (§9.4). The title is editable.
- **FR-K2** Choose which optional sections go in the note body.
- **FR-K3** Publish by the best available method for the account (§9). Record every attempt in `publications`.
- **FR-K4** Show publish status and history per joke. Retry failed publishes.
- **FR-K5** Export to Markdown or plain text (Should Have; it is the fallback for everything).

### 6.7 Non-functional
- **NFR-1** First load (cached) < 1.5 s and interaction-ready < 3 s on a mid-range Android phone over 4G.
- **NFR-2** Autosave round trip p95 < 500 ms.
- **NFR-3** WCAG 2.2 AA.
- **NFR-4** No joke content in server logs.
- **NFR-5** The app is free, so it must run on the Supabase Free plan and the Cloudflare Workers Free plan (100,000 requests/day), with no paid add-ons.

---

## 7. Data model

### 7.1 Entity-relationship overview

```
auth.users 1─1 profiles
auth.users 1─* topics
topics     1─* associations
topics     1─* setups
setups     1─* setups            (parent_setup_id: branches)
setups     1─* assumptions
setups     1─* joke_attempts
joke_attempts *─1 assumptions     (target_assumption_id)
joke_attempts 1─* reinterpretations
joke_attempts *─1 reinterpretations (selected_reinterpretation_id)
joke_attempts 1─0..1 jokes        (completed-joke snapshot)
jokes      1─* publications
tags       *─* topics  (topic_tags)
tags       *─* jokes   (joke_tags)
auth.users 1─0..1 google_connections   (server-only)
```

**Why a separate `jokes` table and not just `joke_attempts.status = 'completed'`?** A completed joke is the thing the comedian *collects*. They tidy its wording, tag it, rate it, publish it, and later put it in a set. The attempt is the *working* that produced it. Keeping a snapshot means polishing the punch on the joke card doesn't rewrite the history of how it was found, and lets a joke exist without an attempt in the future (e.g. imported material).

### 7.2 Conventions (all tables)

- `id uuid primary key default gen_random_uuid()`. The **client may generate the id** (UUIDv4) so that creates are idempotent and work offline (an upsert on `id`).
- `user_id uuid not null default auth.uid()`. It is on **every** table, including children, so RLS is a simple `user_id = auth.uid()` with no joins.
- **Composite ownership foreign keys:** every parent has `unique (id, user_id)` and children reference `(parent_id, user_id)`. A row therefore cannot point at another user's parent, even through a crafted API call. (Verified in the Phase 1 smoke test.)
- `created_at`, `updated_at` (trigger-maintained), `deleted_at` (soft delete), and `archived_at` where archiving applies.
- Text length limits are enforced with `check` constraints.
- Ordering uses `sort_order double precision` (fractional ordering, so a reorder updates one row).

### 7.3 Tables

✅ = created in the Phase 1 migration (`supabase/migrations/20261027000000_phase1_core.sql`). Other tables are added in the phase noted.

#### `profiles` ✅
| Column | Type | Notes |
|---|---|---|
| id | uuid PK, FK → auth.users(id) on delete cascade | |
| display_name | text ≤ 80 | from the Google profile on sign-up |
| timezone | text | default `UTC` |
| preferences | jsonb | expert_mode, reduced_motion, theme, default_publish_includes |
| last_location | jsonb | `{route, label, at}` for Resume |
| created_at, updated_at | timestamptz | |

#### `topics` ✅
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | `unique (id, user_id)` |
| user_id | uuid FK → auth.users | |
| title | text 1–120 | |
| description | text ≤ 2000 | |
| notes | text ≤ 10000 | reflections |
| status | enum `active` \| `archived` | |
| is_favorite | bool | |
| last_activity_at | timestamptz | bumped by child triggers |
| created_at, updated_at, archived_at, deleted_at | timestamptz | |

Index: `(user_id, status, last_activity_at desc) where deleted_at is null`.

#### `associations` ✅
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id, topic_id | uuid | FK `(topic_id, user_id)` → topics, cascade |
| text | text 1–200 | |
| sort_order | float8 | |
| is_starred | bool | |
| created_at, updated_at, deleted_at | | |

Index: `(topic_id, sort_order) where deleted_at is null`.

#### `setups` ✅
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | `unique (id, user_id)` |
| user_id, topic_id | uuid | FK `(topic_id, user_id)` → topics, cascade |
| parent_setup_id | uuid FK → setups, set null | branch / duplicate lineage |
| text | text ≤ 1000, **may be empty** | so a draft saves on the first keystroke |
| notes | text | |
| status | enum `active` \| `archived` | |
| is_favorite | bool | |
| sort_order | float8 | |
| created_at, updated_at, archived_at, deleted_at | | |

Indexes: `(topic_id, status, updated_at desc)`, `(user_id, updated_at desc)`, both partial on `deleted_at is null`.

*Setup progress* (untouched / being mined / has joke) is **derived**, not stored, so it can't drift out of date.

#### `assumptions` (Phase 2)
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | `unique (id, user_id)` |
| user_id, setup_id | uuid | FK `(setup_id, user_id)` → setups, cascade |
| text | text 1–300 | |
| sort_order | float8 | |
| created_at, updated_at, deleted_at | | |

Assumptions belong to the **setup**, because the setup is what creates them. Several attempts can target different assumptions of the same setup.

#### `joke_attempts` (Phase 2)
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | `unique (id, user_id)` |
| user_id, setup_id | uuid | FK `(setup_id, user_id)` → setups, cascade |
| topic_id | uuid | denormalized for stats; filled from the setup by a trigger |
| status | enum `in_progress` \| `completed` \| `abandoned` \| `archived` | |
| current_step | enum `target` \| `connector` \| `reinterpretations` \| `choose` \| `second_story` \| `punch` \| `review` | the step the user last worked on |
| skipped_steps | text[] | for stepper display |
| target_assumption_id | uuid | FK `(target_assumption_id, user_id)` → assumptions, `on delete set null (target_assumption_id)` |
| connector | text ≤ 200 | |
| connector_note | text | why this connector |
| selected_reinterpretation_id | uuid | FK → reinterpretations, `on delete set null (…)` |
| second_story | text ≤ 4000 | |
| punch | text ≤ 1000 | |
| notes | text | |
| version | int | optimistic concurrency (§7.7) |
| started_at, last_step_at, completed_at | timestamptz | |
| created_at, updated_at, deleted_at | | |

Validation trigger: the target assumption must belong to the same setup, and the selected reinterpretation must belong to this attempt.
Indexes: `(user_id, status, updated_at desc)` for Drafts and Resume, `(setup_id)`, `(topic_id, status)`.

#### `reinterpretations` (Phase 2)
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | `unique (id, user_id)` |
| user_id, attempt_id | uuid | FK `(attempt_id, user_id)` → joke_attempts, cascade |
| text | text 1–300 | |
| is_starred | bool | |
| sort_order | float8 | |
| created_at, updated_at, deleted_at | | |

#### `jokes` — completed jokes (Phase 3)
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | `unique (id, user_id)` |
| user_id | uuid | |
| topic_id | uuid | FK `(topic_id, user_id)` → topics, cascade |
| setup_id | uuid null | FK → setups, set null |
| attempt_id | uuid null **unique** | FK → joke_attempts, set null |
| title | text ≤ 120 | display and default Keep title |
| setup_text, punch_text | text, not empty | editable snapshot |
| target_assumption_text, connector_text, reinterpretation_text, second_story_text | text | snapshot of the dig path |
| notes | text | reflections |
| status | enum `complete` \| `archived` | |
| is_favorite | bool | |
| rating | smallint 1–5 null | |
| completed_at, created_at, updated_at, archived_at, deleted_at | | |

Indexes: `(user_id, status, completed_at desc)`, `(topic_id)`, GIN trigram on `setup_text`, `punch_text`, `title`.

#### `tags`, `topic_tags`, `joke_tags` (Phase 5)
- `tags(id, user_id, name ≤ 40, color, created_at)` with a unique index on `(user_id, lower(name))`.
- `topic_tags(topic_id, tag_id, user_id)` and `joke_tags(joke_id, tag_id, user_id)`. The PK is the pair of ids. Composite ownership FKs as above.

#### `publications` (Phase 4)
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id, joke_id | uuid | FK `(joke_id, user_id)` → jokes, cascade |
| client_request_id | uuid | **idempotency key**, `unique (user_id, client_request_id)` |
| destination | enum `google_keep` \| `google_docs` \| `markdown` | |
| method | enum `share_sheet` \| `copy_open` \| `docs_api` \| `download` | |
| status | enum `pending` \| `succeeded` \| `failed` \| `user_confirmed` \| `cancelled` | |
| title, body | text | exactly what was sent |
| include_options | jsonb | which optional sections were included |
| external_id, external_url | text | Google Doc id and link for Docs Joke Book publishes |
| error_code, error_message | text | user-safe message |
| attempt_count | int | |
| requested_at, completed_at, created_at, updated_at | | |

Indexes: `(joke_id, created_at desc)`, `(user_id, status)`.

#### `google_connections` (Phase 4, server-only)
| Column | Type | Notes |
|---|---|---|
| user_id | uuid PK, FK → auth.users cascade | |
| google_sub, google_email | text | which Google account granted access |
| granted_scopes | text[] | |
| refresh_token_ciphertext | text | AES-GCM, `iv.ciphertext` base64, key held only in a Worker secret |
| status | enum `active` \| `revoked` \| `error` | |
| connected_at, updated_at, last_error | | |

RLS is enabled with **no policies** for `authenticated`, so it is reachable only with the service role from the Worker. The UI gets its status from `GET /api/integrations/google`.

### 7.4 Status fields summary

| Entity | Stored status | Derived status (views) |
|---|---|---|
| Topic | active / archived (+ deleted_at) | completion % |
| Setup | active / archived | `untouched` (no attempts) · `mining` (an in-progress attempt) · `struck` (≥1 joke) |
| Joke attempt | in_progress / completed / abandoned / archived; `current_step` | "stuck" = in_progress and not updated for 14 days |
| Joke | complete / archived | `published` = has a succeeded or confirmed Keep publication |
| Publication | pending / succeeded / failed / user_confirmed / cancelled | |

### 7.5 Ownership and security rules

1. RLS is **enabled on every table** in `public`.
2. The standard policy is `for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))`. Wrapping `auth.uid()` in `(select …)` lets Postgres evaluate it once per query instead of once per row.
3. Composite FKs `(parent_id, user_id)` stop rows from being linked across users. FK checks bypass RLS, so this matters.
4. Views use `security_invoker = true` so they follow the caller's RLS.
5. `security definer` functions are used only where needed (`handle_new_user`), with `set search_path = ''`.
6. The `anon` role gets no grants on app tables.
7. The service role key is used only in the Worker and only for `google_connections`, account deletion, and admin jobs.

### 7.6 Topic statistics — definitions

All counts exclude soft-deleted rows (`deleted_at is not null`). They are computed by the `topic_stats` view (security invoker), which is extended in each phase.

| Statistic | Definition |
|---|---|
| Topic title / description | `topics.title`, `topics.description` |
| Association ideas | count of `associations` for the topic |
| Setups | count of `setups` with `status = 'active'` |
| Unfinished joke attempts | count of `joke_attempts` with `status = 'in_progress'` |
| Completed jokes | count of `jokes` with `status = 'complete'` |
| Published to Keep | count of **distinct jokes** for the topic with at least one `publications` row where `destination = 'google_keep'` and `status in ('succeeded','user_confirmed')` |
| Most recent activity | `topics.last_activity_at`, bumped by triggers on any insert, update, or delete in associations, setups, attempts, jokes, assumptions (via setup), and reinterpretations (via attempt) |
| **Overall completion %** | `round(100 × setups_with_a_completed_joke ÷ active_setups)`, shown as "—" when there are no setups |

*Why this completion definition?* It answers "how much of what I've dug has paid off?", it is easy to explain ("3 of your 5 setups became jokes"), and it can't be inflated by brainstorming. A topic with many associations and no setups shows "—" and a prompt to write setups, not 0%, which would feel like failure. **Dig depth** (a per-attempt progress bar) is shown separately: completed steps out of 7 (target, connector, reinterpretations, choice, second story, punch, review).

Performance: correlated subquery counts are fine for prototype scale (hundreds of rows per topic). If a user ever has thousands of topics, the view can be swapped for a trigger-maintained `topic_counters` table without changing the UI contract.

### 7.7 Drafts and partial progress

1. **Every row is a draft from the moment it exists.** There is no separate drafts table. Empty strings are valid for in-progress text (setup text, connector, second story, punch). Only *completion* has requirements (setup and punch must be non-empty).
2. **Client-generated UUIDs and upserts** make "create" idempotent. The UI can show a new setup immediately and save it in the background. Retries never create duplicates.
3. **Field-level autosave.** Each field saves on its own (debounced 800 ms, on blur, and on `visibilitychange: hidden`). Only changed columns are PATCHed, so two tabs editing different fields don't overwrite each other.
4. **Local buffer.** Pending writes go into an IndexedDB outbox (`{table, id, patch, queuedAt}`) before the network call and are removed when the server acknowledges them. On app load and on `online`, the outbox is replayed in order. While the outbox is non-empty, the UI shows "Saved on this device".
5. **Concurrency.** Single-field patches use last-writer-wins, which is acceptable for a single author. Multi-field operations (complete joke, choose a reinterpretation that resets later steps) use `version`: `update … set …, version = version + 1 where id = $1 and version = $2`. If no row matches, the client refetches and shows a non-destructive "This was changed on another device" banner that offers both versions.
6. **Resume pointer.** Navigation to an editing route writes `profiles.last_location` (debounced 5 s). `joke_attempts.current_step` and `last_step_at` are updated when the user enters a step.
7. **Soft delete and Trash.** Deletes set `deleted_at`. A scheduled job (Supabase `pg_cron`) hard-deletes rows older than 30 days.

---

## 8. Google login and authentication

### 8.1 Authentication flow (Supabase Auth, Google provider, PKCE)

```
Browser (SPA)                 Supabase Auth                 Google
    │ signInWithOAuth({provider:'google',                      │
    │   options:{redirectTo: APP/auth/callback}})              │
    │──────────────────────────────▶│                          │
    │                               │── authorize (openid email profile, PKCE) ─▶│
    │◀───────────── redirect to Google consent ────────────────│
    │──────────────────────────────────────────────────────────▶│ user consents
    │◀──── redirect to Supabase callback ──── code ────────────│
    │                               │ exchanges code, creates/updates auth.users
    │◀── redirect APP/auth/callback?code=… ──│                  │
    │ exchangeCodeForSession(code) (PKCE verifier in storage)  │
    │──────────────────────────────▶│                          │
    │◀── access JWT (1 h) + refresh token ──│                  │
```

- **Account creation** is implicit. The first successful sign-in inserts into `auth.users`, and the `on_auth_user_created` trigger creates `profiles` (display name from Google's `full_name`).
- The login scopes are **only** `openid email profile`. Login never asks for Keep or Drive.
- Redirect URLs are allow-listed in Supabase (production domain, preview domains, `http://localhost:5173`).

### 8.2 Session handling

- `supabase-js` stores the session in `localStorage` and refreshes the access token automatically before it expires.
- The SPA sends `Authorization: Bearer <access_token>` on every `/api/*` call.
- The Worker verifies the JWT **locally** against the Supabase project's JWKS (asymmetric JWT signing keys), cached in memory, checking `iss`, `aud = authenticated`, and `exp`. If the project still uses the legacy HS256 secret, the Worker calls `supabase.auth.getUser(token)` instead.
- For database calls made on behalf of the user, the Worker creates a Supabase client **with the user's JWT**, so RLS still applies. The service role is used only where §7.5 allows it.

### 8.3 Protected routes

- **SPA:** a `<RequireAuth>` route wrapper. Unauthenticated users are sent to `/signin?next=<path>`. After sign-in they land back on `next`, which must be a same-origin path.
- **Worker:** every `/api/*` route except `/api/health` and `/api/integrations/google/callback` requires a valid JWT. The callback is authenticated by its signed `state` parameter (§8.6).
- Public routes: `/signin`, `/auth/callback`, `/privacy`, `/terms`, `/about`.

### 8.4 Sign-out behavior

- **Sign out (this device):** `supabase.auth.signOut({ scope: 'local' })`. Clear React Query caches, the IndexedDB outbox **only after flushing it** (if it can't be flushed, warn: "2 unsaved changes will be lost — Retry / Sign out anyway"), and `last_location` from memory.
- **Sign out everywhere:** `signOut({ scope: 'global' })` revokes all refresh tokens.
- Signing out does **not** disconnect Google integrations. Disconnecting is a separate, explicit action in Settings (§8.5).

### 8.5 Requesting Google integration permissions separately

Login and integration are **separate consents with separate OAuth clients/flows**:

| | Login | Integration (Keep/Docs) |
|---|---|---|
| Who runs it | Supabase Auth | Our Worker |
| Scopes | `openid email profile` | `https://www.googleapis.com/auth/drive.file` (Docs Joke Book). No Keep scope (§9.1). |
| When | Sign-in | When the user first taps "Connect" in Settings or the Publish sheet |
| Tokens | Supabase session | Google refresh token, encrypted, in `google_connections` |

Why not reuse Supabase's `provider_token`? Supabase passes Google's access token through once but **does not refresh it**, and asking for extra scopes at login would show a scary consent screen to every user, including those who never publish. A dedicated, incremental flow handles both problems.

Integration flow:
1. `GET /api/integrations/google/start?feature=keep|docs` (authenticated). The Worker builds an authorization URL with `scope=<feature scope>`, `access_type=offline`, `prompt=consent`, `include_granted_scopes=true`, `login_hint=<user email>`, PKCE `code_challenge`, and `state`.
2. `state` is an HMAC-signed, 10-minute token binding `{user_id, feature, nonce, code_verifier_ref}`. The verifier is stored in Workers KV with a 10-minute TTL.
3. `GET /api/integrations/google/callback` verifies `state`, exchanges the code, checks that the granted scopes include the requested one, encrypts the refresh token, and upserts `google_connections`.
4. **Disconnect** calls Google's revoke endpoint and deletes the row.

### 8.6 OAuth security considerations

- PKCE on both flows. A signed, short-lived, single-use `state`, which prevents CSRF and replay.
- Exact-match redirect URIs. No wildcards in production.
- Refresh tokens are encrypted with AES-256-GCM (Web Crypto) using a key from a Worker secret. They are never sent to the browser and never logged.
- Least privilege: `drive.file` (only files the app creates) and never full `drive`. No Keep scope is ever requested.
- **Publishing status "In production" before real users connect Docs.** While a Google OAuth app is in "Testing" status it is limited to 100 listed test users, and refresh tokens for non-basic scopes expire after 7 days. Move the consent screen to "In production" (brand verification only, because `drive.file` is not a sensitive scope) before Phase 4 ships.
- Handle `invalid_grant` (token revoked or expired) by setting `status = 'revoked'` and prompting the user to reconnect.
- Google OAuth app verification: login scopes and `drive.file` are non-sensitive or recommended scopes. The Keep scope is restricted and limited to enterprise use (§9), which is one reason it is behind a flag.
- `next` redirects after login are same-origin only (no open redirects).
- Content-Security-Policy is restricted to self, the Supabase URL, and Google auth endpoints.

---

## 9. Google Keep integration

### 9.1 Current API availability (verify again before Phase 4)

What we found when writing this document (October 2026):

- Google publishes a **Google Keep API (v1)** with `notes.create`, `notes.get`, `notes.list`, `notes.delete`, media download, and permission batch operations. Creating a note requires the scope `https://www.googleapis.com/auth/keep`. A read-only scope also exists.
- The API is described as an **enterprise API for Google Workspace**, meant for things like admin and compliance tooling within a domain. **It is not available for consumer (@gmail.com) Keep accounts**, and there is no other official consumer Keep API.
- **There is no "update note"**. Changing a note means deleting it and creating it again. Notes support a title and a text or list body. There is no rich formatting and no labels through the API.
- The `keep` scope is a sensitive/restricted scope, so using it in a public app means Google's OAuth verification and possibly a security assessment. In practice it also needs the Workspace admin to allow the app.

> ⚠️ **Verification note:** the official developer documentation (developers.google.com/workspace/keep/api) could not be fetched from the design environment (network-restricted), so the points above come from Google's REST reference as mirrored in search results plus several client-library and integration-vendor docs. **Before Phase 4, a developer must re-check the official Keep API overview, scopes, and quotas**, and test with a consumer Gmail account. The owner has no Workspace account, so direct Keep publishing can't be built or tested and is out of scope (§18.1).

### 9.2 Recommendation: tiered publishing

Most comedians will sign in with consumer Gmail accounts, so the default path can't depend on the Keep API.

| Tier | Who | How it works | Pros | Cons |
|---|---|---|---|---|
| **1. Share to Keep** (default) | Everyone on Android, and iOS with Keep installed | The Web Share API (`navigator.share({title, text})`) opens the OS share sheet. The user picks **Keep**, and Keep opens a new note with the title and text filled in. | No OAuth, no Google review, works today, the user sees the note before saving | The user taps once more in Keep. We can't be sure the note was saved, so we ask "Did it save? ✓". Desktop browsers usually have no Keep share target. |
| **1b. Copy & open Keep** (desktop fallback) | Desktop | Copies "Title⏎⏎Body" to the clipboard, opens `https://keep.google.com/` in a new tab, and shows "Paste into a new note". | Universal | Manual paste, and the title must be pasted separately |
| ~~2. Direct to Keep~~ — **not planned** | (would be Google Workspace users only) | (would call `POST https://keep.googleapis.com/v1/notes`) | Fully automatic | Workspace only, restricted scope, verification work. **Dropped:** the owner has no Workspace account to build or test with, and the app's audience is mostly consumer Gmail users. Revisit only if a Workspace tester appears. |
| **3. Google Docs "Joke Book"** (optional alternative) | Everyone | With the `drive.file` scope, the Worker creates one Doc "The Joke Shovel — Joke Book" and appends each published joke as a heading plus body | Automatic for all accounts, non-restricted scope, searchable, printable | It's not Keep. It needs the Docs API, and Drive verification for `drive.file` is light. |
| **4. Export** | Everyone | Markdown or plain-text download of one joke or many | Works offline, portable | Manual |

**What counts as "published to Keep"** for statistics: Tier 1 and 1b once the user confirms ("Yes, it's in Keep" → `user_confirmed`), Tier 2 is not planned. Tier 3 is tracked as `destination = google_docs` and shown separately.

**Not recommended:** unofficial or reverse-engineered Keep libraries (e.g. `gkeepapi`). They need the user's master token or password, break the terms of service, and break without warning.

### 9.3 Publishing workflow

1. On a completed joke, the user taps **Publish**.
2. The client calls `POST /api/jokes/:id/publish/preview` with the include options. The Worker returns `{title, body, methods: ['share_sheet'|'copy_open'|'docs_api']}` based on the device's capabilities (sent by the client) and `google_connections`.
3. The user edits the title (live preview) and toggles optional sections.
4. The user picks a method.
   - **share_sheet / copy_open:** the client creates a `publications` row (`pending`, with `client_request_id`), runs `navigator.share` or the clipboard copy, then asks for confirmation. Yes → `user_confirmed`. No or cancel → `cancelled`.
   - **docs_api:** the client calls `POST /api/jokes/:id/publish {method, title, include, client_request_id}`. The Worker inserts a `pending` row (idempotent on `client_request_id`), refreshes the Google access token, calls Google, and updates the row to `succeeded` (with `external_id` and `external_url`) or `failed` (with `error_code` and a friendly message).
5. The joke card shows a "Published · Oct 27" badge and the history.
6. **Republishing** after edits shares a new Keep note (the user deletes the old one in Keep if they want) and, for the Docs Joke Book, appends a new entry marked "(revised)".

### 9.4 Note format

**Title format:** `[Topic] — [Setup Keywords] — Joke`, for example `Airports — Flight Layover — Joke`.

**Keyword selection (deterministic, runs on the client and is shared with the Worker):**
1. Tokenize the setup text. Lowercase it, strip punctuation, keep hyphenated words together.
2. Remove English stop words (a curated list of about 300 words), pronouns, numbers written as digits, and words already in the topic title.
3. Score each remaining word:
   - +3 if it appears in the attempt's **connector**
   - +2 if it matches one of the topic's **associations** (starred: +3)
   - +1 if it has 6 or more characters
   - +1 if it was capitalized in the middle of the sentence (a probable proper noun)
4. Take the top 2 (at most 3) words and keep them in **setup order** so they read naturally. Use Title Case.
5. Fallback: if nothing is left, use the first 4 words of the setup.
6. Trim to 80 characters and collapse whitespace. If the user already has a joke with the same title, add ` #2`, ` #3`, and so on.

The Publish sheet shows the candidate keywords as **toggle chips**. Turning chips on or off rebuilds the title, and the user can also edit the title text directly. Once edited by hand, the title stops auto-updating (with a "↺ Reset to suggestion" link). The final title is saved to `jokes.title` and `publications.title`.

**Body:**
```
My flight had a six-hour layover.
So I just sat in the cockpit doing loop-de-loops on the tarmac.

— How I dug it —            (only if any optional section is checked)
Target assumption: I'm a passenger.
Connector: "my flight"
Reinterpretation: the flight I'm piloting
Second story: I'm the pilot, stuck waiting with a plane full of fuel.

Topic: Airports · Written Oct 27, 2026
Open in The Joke Shovel: https://jokeshovel.app/j/7f3c…
```

The link back is a plain URL (Keep turns it into a link). It points to `/j/:jokeId`, which requires sign-in, so it reveals nothing to anyone else.

### 9.5 Error handling for publishing

| Error | Detected by | User message | Recovery |
|---|---|---|---|
| Share API unsupported | `!navigator.canShare` | (the method is hidden) | Offer Copy & open |
| User cancelled share | `AbortError` | none | Row → `cancelled` |
| Google 401 / `invalid_grant` | Worker | "Google access expired. Reconnect to publish." | Reconnect button. Connection → `revoked`. |
| Google 403 / 404 (Joke Book doc deleted or access removed) | Worker | "We couldn't reach your Joke Book doc. Create a new one?" | Create a new doc and store its id |
| Google 429 / 5xx | Worker | "Google is busy. We'll retry." | Up to 3 retries with exponential backoff and jitter, then `failed` with a Retry button |
| Network offline | Client | "You're offline. Publishing will be available when you reconnect." | Button disabled |

---

## 10. Technical architecture

### 10.1 Overview

```
                 ┌──────────────────────── Cloudflare ────────────────────────┐
 Phone/desktop   │  Worker "jokeshovel"                                       │
 browser  ──────▶│   • Static assets (SPA build, served by Workers Assets)    │
   │             │   • /api/* (Hono): auth check, rate limit, integrations,   │
   │             │     publish, export, stats helpers                         │
   │             │   • Bindings: KV (OAuth state), Rate Limiting, secrets     │
   │             └───────────────┬───────────────────────────┬────────────────┘
   │  supabase-js (RLS)          │ user JWT / service role   │ OAuth + REST
   ▼                             ▼                           ▼
 ┌──────────── Supabase ────────────┐                 ┌──── Google ────┐
 │ Auth (Google provider)           │                 │ OAuth 2.0      │
 │ Postgres + RLS + views + pg_cron │                 │                │
 │ PostgREST                        │                 │ Docs/Drive API │
 └──────────────────────────────────┘                 └────────────────┘
 GitHub: repo `jokeshovel` → Actions: lint/test → supabase db push → wrangler deploy
```

### 10.2 Frontend architecture

- **Vite + React 18 + TypeScript**, React Router (data routers). Built to `dist/` and served by the same Worker via `[assets]`, with SPA fallback (`not_found_handling = "single-page-application"`).
- **State and data:** TanStack Query for server state (cache, optimistic updates, retry). A small `useAutosave(table, id, field)` hook wraps the debounce, outbox, and save-state reporting.
- **Offline outbox:** `idb-keyval` in IndexedDB. Optionally a service worker for app-shell caching (PWA install) in Phase 5.
- **Styling:** plain CSS with custom properties (design tokens) and CSS Modules. No UI kit, to keep the bundle small. Use `@radix-ui` primitives only for dialog, popover, and radio group, to get accessible behavior for free.
- **Folder layout:**
  ```
  apps/web/src/
    routes/          (one file per screen)
    features/        topics/ associations/ setups/ mine/ jokes/ publish/ search/ stats/
    components/      SaveIndicator, Stepper, Thread, ChipInput, QuickSwitcher, …
    lib/             supabase.ts, api.ts, autosave/, keywords.ts, format.ts
    styles/          tokens.css, base.css
  ```
- **Why not Next.js or SvelteKit?** Everything is behind a login, there is no SEO need, and a static SPA plus a Worker API is the simplest thing that deploys to Workers. Both can be revisited later.

### 10.3 Cloudflare Worker responsibilities

- Serve the SPA assets with security headers (CSP, HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`).
- `/api/*`: JWT verification, per-user rate limiting, Google OAuth flows, token encryption, Keep, Docs, and Drive calls, publish orchestration, export (Markdown/JSON zip), and account deletion.
- **Not** responsible for plain CRUD. That goes browser → Supabase under RLS, which keeps the Worker small and avoids a hand-written API layer for every table.
- Scheduled handler (Cron Trigger, daily): retry `pending` API publications older than 10 minutes and run the health check of Google connections.

### 10.4 Supabase responsibilities

- Auth (Google provider, sessions, refresh tokens).
- Postgres: schema, constraints, RLS, triggers (`updated_at`, `last_activity_at`, validation, profile creation), views (`topic_stats`, `setup_progress`, `drafts_feed`), and search (trigram).
- `pg_cron`: purge Trash older than 30 days.
- Migrations live in the repo (`supabase/migrations`) and are applied by CI with `supabase db push`.

### 10.5 Authentication boundaries

| Caller → Callee | Credential | Authorization |
|---|---|---|
| Browser → Supabase (PostgREST) | anon/publishable key + user JWT | RLS |
| Browser → Worker | user JWT | JWT verify, then per-route logic |
| Worker → Supabase (user context) | user JWT | RLS |
| Worker → Supabase (privileged) | service role key | Only `google_connections`, account deletion, cron jobs |
| Worker → Google | per-user OAuth access token (from the encrypted refresh token) | Google scopes |

### 10.6 API routes (Worker)

| Method & path | Auth | Purpose | Phase |
|---|---|---|---|
| `GET /api/health` | none | liveness and version | 1 |
| `GET /api/me` | JWT | profile plus feature flags | 1 |
| `POST /api/jokes/:id/complete` | JWT | (alternative to client-side) transactional attempt → joke snapshot via RPC | 3 |
| `POST /api/jokes/:id/publish/preview` | JWT | build the title and body, list available methods | 4 |
| `POST /api/jokes/:id/publish` | JWT + rate limit | Docs Joke Book publish (idempotent) | 4 |
| `POST /api/publications/:id/confirm` | JWT | mark share or copy as `user_confirmed` / `cancelled` | 4 |
| `GET /api/integrations/google` | JWT | connection status and scopes | 4 |
| `GET /api/integrations/google/start?feature=` | JWT | 302 to Google consent | 4 |
| `GET /api/integrations/google/callback` | signed state | finish OAuth | 4 |
| `DELETE /api/integrations/google` | JWT | revoke and delete | 4 |
| `GET /api/export?format=md\|json` | JWT + rate limit | export all data | 5 |
| `DELETE /api/account` | JWT + re-auth (< 5 min) | delete the user (service role) | 5 |

Postgres RPCs (called directly from the client via `supabase.rpc`): `complete_attempt(attempt_id, title)` (a transaction that inserts the joke, sets the attempt to completed, and returns the joke), `branch_setup(setup_id)`, `search_all(q, filters)`.

All responses use JSON. Errors use `{ "error": { "code": "GOOGLE_RECONNECT_REQUIRED", "message": "…", "requestId": "…" } }`.

### 10.7 Environment variables and secrets

| Name | Where | Secret? | Purpose |
|---|---|---|---|
| `VITE_SUPABASE_URL` | web build | no | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | web build | no (publishable; RLS protects data) | browser client |
| `SUPABASE_URL` | Worker var | no | |
| `SUPABASE_ANON_KEY` | Worker var | no | user-context client |
| `SUPABASE_SERVICE_ROLE_KEY` | Worker secret | **yes** | privileged ops |
| `SUPABASE_JWKS_URL` | Worker var | no | JWT verification |
| `GOOGLE_INTEGRATION_CLIENT_ID` | Worker var | no | integration OAuth client (separate from the Supabase login client) |
| `GOOGLE_INTEGRATION_CLIENT_SECRET` | Worker secret | **yes** | |
| `TOKEN_ENCRYPTION_KEY` | Worker secret | **yes** | 32-byte base64 AES-GCM key |
| `OAUTH_STATE_SIGNING_KEY` | Worker secret | **yes** | HMAC for `state` |
| `APP_BASE_URL` | Worker var | no | links in notes, redirects |
| `FEATURE_DOCS_SYNC` | Worker var | no | flag for the Docs Joke Book |
| Google **login** client id/secret | Supabase dashboard (Auth → Providers) | **yes** | Supabase-managed login |
| `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` | GitHub Actions secrets | **yes** | deploy |
| `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `SUPABASE_PROJECT_REF` | GitHub Actions secrets | **yes** | migrations |

`.dev.vars` (Worker) and `.env.local` (web) are git-ignored. `.dev.vars.example` and `.env.example` are committed.

### 10.8 Error handling

- **Client:** a React error boundary per route ("Something broke on this screen. Your work is saved. [Reload] [Go home]"). Supabase and API errors map to friendly messages plus a "Details" disclosure with the `requestId`.
- **Autosave errors** never block typing. The field keeps its value, the save indicator turns amber, the change stays in the outbox, and retries back off (1 s, 2 s, 5 s, 10 s, then every 30 s).
- **Worker:** a central `onError` that logs a structured error and returns the JSON error envelope. Zod-validated input, which returns `400 VALIDATION_FAILED`.
- **Database:** constraint violations map to field-level messages (e.g. a title that is too long).

### 10.9 Logging and observability

- Workers Logs (observability enabled in `wrangler.toml`) with structured JSON: `{level, msg, requestId, route, userIdHash, status, durationMs, googleStatus}`.
- **No joke content, tokens, or emails in logs.** User ids are hashed with SHA-256 plus a salt.
- Optional (Phase 5): Sentry for the browser and Worker, with `beforeSend` scrubbing of text fields.
- Supabase: the dashboard logs for Auth and Postgres, and slow-query monitoring.

### 10.10 Rate limiting

- Workers Rate Limiting binding, keyed by `user_id`:
  - publish: 10 / minute, 100 / day
  - integration start: 5 / minute
  - export: 3 / hour
  - other `/api/*`: 120 / minute
- Supabase applies its own limits to Auth endpoints. PostgREST traffic is bounded by RLS and by the client's debounced autosave.
- Google API calls: exponential backoff on 429 and a per-user concurrency of 1 for publishing.

### 10.11 Backup and recovery

- **Supabase plan:** the app is free, so it runs on the **Free plan**. The Free plan has **no managed backups**, so the nightly job below is required from day one, not optional. Free projects are also **paused after a period of inactivity** (about a week at the time of writing; check Supabase's current policy). The nightly backup job queries the database, which should keep the project active. A paused project can be restored from the dashboard. If usage ever outgrows the free tier, the Pro plan adds daily backups and Point-in-Time Recovery.
- **Nightly logical backup:** a GitHub Actions scheduled workflow runs `supabase db dump --data-only` and `pg_dump` of the schema, encrypts the result with `age`, and uploads it to a Cloudflare R2 bucket with 30-day lifecycle retention. Do a quarterly restore drill into a scratch project.
- **User-level recovery:** 30-day Trash, undo toasts, and export.
- **Migrations:** forward-only and reviewed in a PR. Destructive changes are split across two releases (expand, then contract).
- **Secrets recovery:** secrets are documented in the runbook (`docs/RUNBOOK.md`) by name and owner. Rotating `TOKEN_ENCRYPTION_KEY` means users reconnect Google, which is acceptable.

### 10.12 Repository and CI/CD

```
jokeshovel/
├─ apps/web/                 Vite React SPA
├─ worker/                   Hono Worker (src/index.ts), wrangler.toml
├─ packages/shared/          types, zod schemas, keywords.ts (title generation), note-format.ts
├─ supabase/                 config.toml, migrations/, seed.sql, tests/
├─ docs/                     DESIGN.md, RUNBOOK.md, ADRs
├─ .github/workflows/        ci.yml, deploy.yml, backup.yml
└─ package.json              pnpm workspaces
```

- **ci.yml** (on PR): install → lint (ESLint) → typecheck → unit tests (Vitest) → `supabase start` + `supabase db reset` + `supabase test db` (pgTAP RLS tests) → Playwright e2e against `wrangler dev` → axe checks.
- **deploy.yml** (on push to `main`): `supabase db push` → `wrangler deploy`. PRs get preview deploys with `wrangler versions upload` (preview URL) against a staging Supabase project.
- Branch protection on `main`: CI is required and changes come in by PR.

---

## 11. Security and privacy

- **Data is private by default.** There is no sharing in v1. Jokes are a comedian's livelihood, so the privacy page states plainly: "We never train on, sell, or read your material."
- **RLS everywhere**, composite ownership FKs, and pgTAP tests proving that user B cannot read or write user A's rows on every table.
- **Least-privilege OAuth.** Login uses basic scopes only, and integrations are opt-in and revocable.
- **Token handling:** Google refresh tokens are encrypted at rest and only the Worker can read them. Supabase sessions live in browser storage, protected by a strict CSP that blocks third-party scripts.
- **Input handling:** all user text is rendered as text (React escaping). No `dangerouslySetInnerHTML`. Markdown export escapes control characters.
- **Headers:** CSP (`default-src 'self'; connect-src 'self' https://<project>.supabase.co https://accounts.google.com; frame-ancestors 'none'`), HSTS, `Referrer-Policy: strict-origin-when-cross-origin`.
- **Dependencies:** Dependabot, `pnpm audit` in CI, and lockfile committed.
- **Account deletion** removes `auth.users`, which cascades to all rows, revokes Google tokens, and purges backups by rotation (documented).
- **Logging** excludes content and PII (§10.9).
- **Compliance:** a lightweight privacy policy and terms, Google API Services User Data Policy compliance for any Google scopes (needed for OAuth verification), and data export for portability.

---

## 12. Accessibility

Target: **WCAG 2.2 AA**.

| Area | Requirement |
|---|---|
| Keyboard navigation | Everything works without a mouse. Logical tab order. The stepper is a `nav` list of links, and arrow keys move between radio cards. Enter adds a list item, Esc closes sheets. Shortcuts (Phase 5): ⌘/Ctrl-K switcher, `N` new item, `]`/`[` next/previous step, `?` shortcut help. All shortcuts can be turned off, and single-key ones only fire outside text fields (WCAG 2.1.4). |
| Screen readers | Semantic landmarks (`header`, `nav`, `main`). Each step panel has an `h2`. Lists are `ul`/`li` with counts ("Associations, 12 items"). The save indicator is an `aria-live="polite"` region that announces "Saved" at most every 10 s, while errors are announced at once (`assertive`). Toggle chips use `aria-pressed`. Stepper links carry `aria-current="step"` and status ("Connector, completed"). |
| Visible focus | 3 px focus ring with ≥ 3:1 contrast against adjacent colors, never removed. `:focus-visible` is used, and focused elements are never hidden behind sticky bars (WCAG 2.4.11). |
| Color contrast | Body text ≥ 4.5:1, large text and UI parts ≥ 3:1, in both light and dark themes. Status is never shown by color alone (icons plus text: "✓ Saved", "⚠ Not saved"). |
| Clear labels | Every input has a visible `<label>` with the plain term (e.g. "Connector") and help text tied by `aria-describedby`. Placeholders are examples, never labels. |
| Large touch targets | ≥ 48 × 48 px for primary actions and ≥ 24 × 24 px minimum anywhere (WCAG 2.5.8), with 8 px spacing. Swipe actions always have a button alternative. |
| Autosave feedback | A persistent save indicator in the top bar. Offline and error states use text, not just color. |
| Error messages | Inline, next to the field, say what happened and how to fix it, linked to the field with `aria-describedby`, plus focus moves to the first error on submit actions. |
| Undo and recovery | An undo toast (8 s, focusable, also reachable via ⌘Z outside text fields) for deletes, archives, and selection changes. 30-day Trash. |
| Not overwhelming | One primary decision per screen in the Mine. Optional fields sit behind "More" disclosures. Help is collapsible, and Expert mode hides it. |
| Responsive layouts | Fluid from 320 px to 1920 px. Content reflows at 400% zoom without horizontal scrolling (WCAG 1.4.10). Respects `prefers-reduced-motion`, `prefers-color-scheme`, and the user's font size (rem units). |
| Time limits | None. The brainstorm timer is optional, can be paused, and is silent by default. |
| Language | `lang="en"`, plain-language copy at about grade 7. |

---

## 13. Development phases

Each phase ends with something deployed and usable. Sprints are 2 weeks for one developer, shorter with more people.

### Phase 1 — Basic prototype (Sprint 1)
- **Goal:** sign in, collect topics, association lists, and setups, and never lose a word.
- **User value:** replaces a notes app for the Prospector half of the method.
- **Features:** Google login, sign-out, topics CRUD (create, edit, delete, archive), association lists, setups under topics (create, edit, delete), autosave with save indicator, topic counts (associations, setups, last activity), Resume card.
- **Database changes:** `profiles`, `topics`, `associations`, `setups`, `topic_stats` v1, triggers, RLS (**migration already written:** `supabase/migrations/20261027000000_phase1_core.sql`).
- **Screens:** Sign in, Home, Topic list, Topic detail (Associations, Setups tabs), Settings (minimal).
- **User stories:** AUTH-1, AUTH-2, AUTH-3, TOP-1, TOP-2, TOP-3, ASSOC-1, ASSOC-2, SET-1, SAVE-1, SAVE-2, RET-1, STAT-1, MOB-1 (§14).
- **Acceptance criteria:** AC-1 … AC-8 (§15).
- **Technical tasks:** see §19.
- **Definition of done:** deployed to `jokeshovel.<account>.workers.dev`; CI green; RLS tests pass; Lighthouse accessibility ≥ 95 on Home and Topic detail; manual test on a real Android and iOS phone; no console errors.
- **Risks and dependencies:** Google Cloud OAuth consent screen setup (allow 1 day); Supabase redirect URL configuration; autosave edge cases.

### Phase 2 — Guided Joke Mine (Sprints 2–3)
- **Goal:** take a setup all the way to a punch.
- **User value:** the core of the method, guided.
- **Features:** assumptions list, start attempt, target selection, connector with word chips, reinterpretation brainstorm and choice, second story, punch, stepper, thread panel, skip-ahead, multiple attempts per setup, Drafts tab.
- **Database changes:** `assumptions`, `joke_attempts`, `reinterpretations`, validation trigger, `topic_stats` v2 (unfinished attempts), `drafts_feed` view.
- **Screens:** Setup detail, Mine workspace (6 step panels), Reinterpretation workspace, Drafts list.
- **User stories:** ASM-1, ASM-2, TGT-1, CON-1, CON-2, REI-1, REI-2, SS-1, PUN-1, PUN-2, RET-2, NAV-1.
- **Acceptance criteria:** AC-9 … AC-15.
- **Technical tasks:** migration and pgTAP tests; `Stepper`, `Thread`, `ChipInput`, `WordChips` components; route per step; `current_step` tracking; changing a reinterpretation shows a "review later steps" banner; e2e test of the full Mine flow.
- **Definition of done:** a test user goes from a setup to a punch on a phone in under 10 minutes without help (hallway test with 3 people); all steps reachable by keyboard; e2e green.
- **Risks:** too much on one screen. Mitigate with a design review of the step panels on a 360 px viewport before building.

### Phase 3 — Completed jokes (Sprint 4)
- **Goal:** collect, review, and find finished jokes.
- **Features:** Review page, `complete_attempt` RPC, joke detail and edit, favorites and rating, Jokes tab, search (trigram) and filters, stats page, completion %.
- **Database changes:** `jokes`, `complete_attempt()`, `search_all()`, `topic_stats` v3 (completed and completion %), trigram indexes.
- **Screens:** Review / Joke detail, Jokes list, Search, Stats.
- **User stories:** COMP-1, COMP-2, COMP-3, SRCH-1, SRCH-2, STAT-2.
- **Acceptance criteria:** AC-16 … AC-20.
- **Definition of done:** completion is transactional (no orphan jokes); search returns in < 300 ms for 5,000 rows; stats match hand-counted fixtures.
- **Risks:** confusion between the attempt and the joke snapshot. Mitigate with copy ("Your joke card" vs "Your dig").

### Phase 4 — Google Keep publishing (Sprints 5–6)
- **Goal:** get jokes into Keep with predictable titles.
- **Features:** Publish sheet, keyword chips and title generation, Share-to-Keep, Copy-and-open, confirmation, `publications` history, Keep statistics. Behind a flag: Google integration OAuth and the Docs Joke Book. Error handling (§9.5). (No direct Keep API, §18.1.)
- **Database changes:** `publications`, `google_connections`, `topic_stats` v4 (Keep-published).
- **Screens:** Publish sheet, Integrations settings, Joke detail publish history.
- **User stories:** PUB-1 … PUB-5, ERR-1, ERR-2.
- **Acceptance criteria:** AC-21 … AC-27.
- **Technical tasks:** `packages/shared/keywords.ts` with unit tests; note formatter; Worker OAuth routes with encryption; KV for state; rate limiting; Docs API client.
- **Definition of done:** Share-to-Keep verified on Android Chrome and iOS Safari; Docs Joke Book verified with a consumer Gmail account; revoked-token path tested; OAuth consent screen set to "In production" with brand verification done.
- **Risks and dependencies:** iOS share-target behavior varies; Google brand verification lead time for the Docs Joke Book.

### Phase 5 — Improved writing workflow (Sprints 7–8)
- **Features:** quick switcher (⌘K), favorites everywhere, tags (topics and jokes), duplicate and branch setup, archive and Trash UI, keyboard shortcuts, Markdown/JSON export, PWA install and app-shell caching, mobile polish (swipe actions, sticky step footer, haptics where supported), Expert mode, account deletion.
- **Database changes:** `tags`, `topic_tags`, `joke_tags`; `branch_setup()` RPC; `pg_cron` Trash purge.
- **User stories:** NAV-2, NAV-3, ORG-1, ORG-2, ORG-3, A11Y-3, EXP-1.
- **Definition of done:** shortcuts documented in `?` help; PWA passes the installability check; export round-trip test.
- **Risks:** shortcut conflicts with screen readers. Mitigate with the WCAG 2.1.4 rules above.

### Phase 6 — Future enhancements
See §20.

---

## 14. Prioritized user stories

**Priority key:** **M** = Must Have (needed for the phase to be usable), **S** = Should Have, **C** = Could Have.

| ID | Pri | Phase | Story |
|---|---|---|---|
| **Authentication** ||||
| AUTH-1 | M | 1 | As a new comedian, I want to sign in with my Google account, so that I don't need another password. |
| AUTH-2 | M | 1 | As a returning user, I want to stay signed in on my phone, so that I can start writing in seconds. |
| AUTH-3 | M | 1 | As a user on a shared computer, I want to sign out, so that nobody else can see my material. |
| AUTH-4 | S | 5 | As a security-minded user, I want to sign out of all devices, so that a lost phone can't open my jokes. |
| AUTH-5 | S | 4 | As a user, I want Google to ask for Keep or Docs access only when I choose to publish, so that signing in feels safe. |
| **Topic creation** ||||
| TOP-1 | M | 1 | As a beginner, I want to create a topic with a title and an optional description, so that I have a place to start digging. |
| TOP-2 | M | 1 | As a comedian, I want to rename, edit, and delete a topic, so that my list reflects what I'm actually working on. |
| TOP-3 | S | 1 | As an experienced comedian, I want to archive topics I'm done with, so that my active list stays short without losing anything. |
| TOP-4 | C | 5 | As an organizer, I want to tag topics (e.g. "family", "travel"), so that I can group related material. |
| **Association brainstorming** ||||
| ASSOC-1 | M | 1 | As a comedian, I want to add associations rapidly by typing and pressing Enter, so that brainstorming isn't slowed by the interface. |
| ASSOC-2 | S | 1 | As a beginner, I want rotating prompt questions while I brainstorm, so that I don't run dry. |
| ASSOC-3 | S | 1 | As a comedian, I want to star promising associations, so that I can find them when I write setups. |
| ASSOC-4 | C | 5 | As a snacker, I want an optional 5-minute brainstorm timer, so that I can do a quick focused sprint. |
| **Setup creation** ||||
| SET-1 | M | 1 | As a comedian, I want to write several setups under a topic, so that I have options to mine. |
| SET-2 | S | 1 | As a comedian, I want to start a setup from selected associations, so that I can see my raw material while writing. |
| SET-3 | S | 5 | As an experienced comedian, I want to duplicate or branch a setup, so that I can try a variation without losing the original. |
| **Assumption identification** ||||
| ASM-1 | M | 2 | As a beginner, I want to list what the audience assumes after hearing my setup, so that I can find something to break. |
| ASM-2 | S | 2 | As a beginner, I want question prompts (Who? Where? What's happening?), so that I notice assumptions I'd otherwise miss. |
| **Target selection** ||||
| TGT-1 | M | 2 | As a comedian, I want to choose one assumption as my target, so that the rest of the process is focused. |
| TGT-2 | S | 2 | As a comedian, I want to start another attempt with a different target on the same setup, so that one setup can give several jokes. |
| **Connector identification** ||||
| CON-1 | M | 2 | As a comedian, I want to write down the connector behind my target, so that I know what to reinterpret. |
| CON-2 | S | 2 | As a mobile user, I want to tap words in my setup to fill in the connector, so that I don't have to retype them. |
| **Reinterpretation brainstorming** ||||
| REI-1 | M | 2 | As a comedian, I want to brainstorm many readings of the connector, so that I find a surprising one. |
| REI-2 | M | 2 | As a comedian, I want to choose one reinterpretation and keep the others, so that I can come back to them. |
| **Second-story creation** ||||
| SS-1 | M | 2 | As a beginner, I want a prompt to describe the situation where my reinterpretation is true, so that I understand the hidden story before writing the punch. |
| **Punch writing** ||||
| PUN-1 | M | 2 | As a comedian, I want to write the punch right under my setup, so that I can hear how they read together. |
| PUN-2 | S | 2 | As a comedian, I want a word count and a reminder to put the surprise last, so that I tighten the punch. |
| **Draft saving** ||||
| SAVE-1 | M | 1 | As any user, I want every change saved automatically, so that I never lose material. |
| SAVE-2 | M | 1 | As any user, I want to see whether my work is saved, so that I can trust the app. |
| SAVE-3 | S | 1 | As a subway writer, I want to keep typing offline and have it sync later, so that a bad connection doesn't stop me. |
| **Returning to unfinished work** ||||
| RET-1 | M | 1 | As a returner, I want a "Resume digging" card that opens where I left off, so that I can continue right away. |
| RET-2 | M | 2 | As a returner, I want a list of all unfinished attempts sorted by recency, so that I can choose what to keep working on. |
| RET-3 | S | 2 | As a returner, I want to see the thread of my earlier decisions when I resume, so that I remember my reasoning. |
| NAV-1 | M | 2 | As a comedian, I want to jump to any step and go back without losing anything, so that I can follow my inspiration. |
| NAV-2 | S | 5 | As an experienced comedian, I want a quick switcher, so that I can jump between topics, setups, and drafts in a couple of keystrokes. |
| NAV-3 | C | 5 | As a desktop user, I want keyboard shortcuts, so that I can write without touching the mouse. |
| **Topic statistics** ||||
| STAT-1 | M | 1 | As a comedian, I want each topic to show association, setup, and activity counts, so that I can see where I've been digging. |
| STAT-2 | S | 3 | As a comedian, I want completed, unfinished, published, and completion % per topic, so that I know which topics pay off. |
| STAT-3 | C | 3 | As a motivated writer, I want a weekly progress chart, so that I can keep a writing habit. |
| **Completing jokes** ||||
| COMP-1 | M | 3 | As a comedian, I want to review my setup and punch together and mark the joke complete, so that it joins my collection. |
| COMP-2 | M | 3 | As a comedian, I want to edit a completed joke's wording, so that I can polish it after trying it on stage. |
| COMP-3 | S | 3 | As a comedian, I want to favorite and rate jokes, so that my best material is easy to find. |
| **Searching and filtering** ||||
| SRCH-1 | M | 3 | As an experienced comedian, I want to search all my material by keyword, so that I can find that dentist bit from last spring. |
| SRCH-2 | S | 3 | As an organizer, I want to filter by status, topic, tag, and favorite, so that I can build a set list. |
| **Publishing to Google Keep** ||||
| PUB-1 | M | 4 | As a comedian who uses Keep, I want to send a completed joke to Keep, so that it's next to my set lists. |
| PUB-2 | M | 4 | As a comedian, I want a predictable note title made from the topic and setup keywords, so that I can find jokes in Keep. |
| PUB-3 | M | 4 | As a comedian, I want to edit the title before publishing, so that it makes sense to me. |
| PUB-4 | S | 4 | As a beginner, I want to choose whether to include the assumption, connector, reinterpretation, and second story, so that my notes can include my reasoning. |
| PUB-5 | S | 4 | As a comedian, I want to see when and where a joke was published, so that I don't publish it twice by accident. |
| PUB-6 | Won't (now) | — | As a Workspace user, I want jokes published to Keep directly with no extra taps, so that publishing is instant. *(Dropped: no Workspace account to build or test with, §18.1.)* |
| **Recovering from errors** ||||
| ERR-1 | M | 4 | As a user, I want clear messages and a Retry button when publishing fails, so that I know what to do. |
| ERR-2 | M | 1 | As a user, I want my typing kept and retried when the server can't be reached, so that errors never cost me material. |
| ERR-3 | S | 5 | As a user, I want to undo a delete and restore from Trash, so that a slip of the thumb isn't permanent. |
| **Mobile use** ||||
| MOB-1 | M | 1 | As a phone user, I want large buttons and one-thumb navigation, so that I can write while standing in a green room. |
| MOB-2 | S | 5 | As a phone user, I want to install the app on my home screen, so that it opens like a native app. |
| **Accessibility** ||||
| A11Y-1 | M | 1 | As a keyboard-only user, I want to reach every control with visible focus, so that I can use the whole app. |
| A11Y-2 | M | 1 | As a screen-reader user, I want labeled fields and announced save states, so that I know what each field is and whether it's saved. |
| A11Y-3 | S | 5 | As a user with low vision, I want the layout to work at 200–400% zoom and in dark mode, so that I can read comfortably. |
| **Organization** ||||
| ORG-1 | S | 5 | As an organizer, I want to tag jokes, so that I can group them by set or theme. |
| ORG-2 | S | 5 | As a comedian, I want to archive jokes I've retired, so that they stop cluttering my list. |
| ORG-3 | C | 5 | As a comedian, I want to export my jokes to Markdown, so that I own a copy outside the app. |
| EXP-1 | C | 5 | As an experienced comedian, I want an Expert mode that hides help text, so that the screens are leaner. |

---

## 15. Acceptance criteria

Given/When/Then, grouped by phase. IDs are referenced in §13.

**Phase 1**
- **AC-1 (AUTH-1):** *Given* I'm signed out, *when* I tap "Continue with Google" and consent, *then* I land on Home, a `profiles` row exists with my Google name, and only `openid email profile` were requested.
- **AC-2 (AUTH-3):** *Given* I'm signed in, *when* I sign out, *then* any pending saves are flushed first, I see the sign-in page, and visiting `/topics` redirects to `/signin?next=/topics`.
- **AC-3 (TOP-1/2):** *Given* I'm on Topics, *when* I create "Airports", *then* it appears at the top immediately and is still there after a hard refresh. Renaming saves within 1 s of when I stop typing. Deleting shows an 8-second Undo, and after Undo the topic and its children are intact.
- **AC-4 (ASSOC-1):** *Given* the association input is focused, *when* I type "TSA" ⏎ "layover" ⏎, *then* both items appear in order, focus stays in the input, and the count reads 2.
- **AC-5 (SET-1/SAVE-1):** *Given* a topic, *when* I tap "+ New setup", type a sentence, and close the tab within 2 s, *then* reopening shows the full sentence.
- **AC-6 (SAVE-2/ERR-2):** *Given* I go offline, *when* I edit a setup, *then* the indicator shows "Saved on this device". *When* I reconnect, *then* it changes to "Saved ✓" within 5 s and the server has the text.
- **AC-7 (STAT-1):** *Given* a topic with 3 associations (1 deleted) and 2 setups, *then* its card shows "2 associations · 2 setups" and "active just now".
- **AC-8 (Security):** *Given* user B's JWT, *when* B requests user A's topic id via PostgREST, *then* the result is empty, and an insert referencing A's topic id fails.

**Phase 2**
- **AC-9 (ASM-1):** I can add, edit, reorder, and delete assumptions on a setup, and they persist.
- **AC-10 (TGT-1):** Choosing a target sets `target_assumption_id`. Picking another replaces it. Deleting the targeted assumption clears the target and the stepper shows Target as incomplete.
- **AC-11 (CON-2):** Tapping words in the setup adds them to the connector field in setup order. Tapping again removes them.
- **AC-12 (REI-2):** I can add ≥ 10 reinterpretations, choose one, and the others stay listed. Changing the choice after a second story exists shows a non-blocking "review" banner and changes no text.
- **AC-13 (NAV-1):** From the Punch step, clicking the "Target" dot shows the Target panel. Browser Back returns to Punch with the text intact.
- **AC-14 (RET-2):** The Drafts tab lists in-progress attempts newest first, showing topic, setup excerpt, step name, and relative time.
- **AC-15 (TGT-2):** Starting a second attempt on a setup creates a new attempt with no target, and both appear under the setup.

**Phase 3**
- **AC-16 (COMP-1):** "Mark complete" is disabled with an explanation while setup or punch is empty. Once enabled, it creates exactly one `jokes` row (retrying does not duplicate it) and sets the attempt to `completed`.
- **AC-17 (COMP-2):** Editing the joke's punch changes `jokes.punch_text` but not `joke_attempts.punch`.
- **AC-18 (SRCH-1):** Searching "layovr" (a typo) finds the joke containing "layover". Results are grouped by type.
- **AC-19 (STAT-2):** For the fixture topic (5 setups, 3 with completed jokes), completion shows 60%. With 0 setups it shows "—".
- **AC-20 (COMP-3):** Favorites filter shows only favorited jokes. Rating persists.

**Phase 4**
- **AC-21 (PUB-2):** For topic "Airports", setup "My flight had a six-hour layover.", connector "my flight", and an unstarred association "layover", the suggested title (scores: flight 4, layover 3, six-hour 1) is `Airports — Flight Layover — Joke`.
- **AC-22 (PUB-3):** Editing the title stops auto-updates. "Reset to suggestion" restores it.
- **AC-23 (PUB-1):** On Android Chrome, "Share to Keep" opens the share sheet with the title and body. After I confirm, the joke shows "Published" and the topic's Keep count goes up by 1. Cancelling records `cancelled` and doesn't change the count.
- **AC-24 (PUB-4):** The note body contains exactly the sections I checked, in the documented order, plus the date and the link back.
- **AC-25 (PUB-5):** Joke detail lists each publication with method, status, and timestamp.
- **AC-26 (ERR-1):** If the Google token is revoked, an API publish shows "Google access expired. Reconnect to publish." and the publication is `failed` with code `GOOGLE_RECONNECT_REQUIRED`.
- **AC-27 (AUTH-5):** Connecting an integration shows Google consent for only the requested scope. Disconnecting revokes the token and removes the row.

**Cross-cutting (every phase)**
- **AC-X1:** axe reports no serious or critical violations on new screens.
- **AC-X2:** Every new interactive element is reachable by keyboard and has a visible focus ring.
- **AC-X3:** Layout has no horizontal scroll at 320 px width.

---

## 16. Prototype plan

**Prototype = Phase 1 + a clickable mock of Phase 2**, so the method can be validated with real comedians before the Mine is built.

| Week | Build | Validate |
|---|---|---|
| 1 | Repo scaffold, Supabase project, Google login, topics CRUD, deploy pipeline | Sign in works on 2 real phones |
| 2 | Associations, setups, autosave and outbox, topic counts, Resume card | 3 comedians use it for 1 week of normal writing |
| 2 (parallel) | Figma or HTML click-through of Mine steps 6–11 at 360 px | 5 short usability sessions: can they get from a setup to a punch? Where do they stall? |
| 3 | Debrief and adjust the Phase 2 scope | Decide: one panel per step vs combined Connector+Reinterpretation panel |

**Prototype success criteria:** zero data loss; ≥ 3 of 5 testers complete the Mine mock without help; ≥ 2 testers return to write again without a reminder.

---

## 17. Testing strategy

| Layer | Tooling | What |
|---|---|---|
| Database | `supabase test db` (pgTAP) | RLS per table (owner can CRUD; other user can't read, insert, update, delete, or cross-link); triggers (`updated_at`, `last_activity_at`, validation); `topic_stats` numbers against fixtures; `complete_attempt` idempotency |
| Shared logic | Vitest | `keywords.ts` (table-driven: stop words, scoring, ties, fallback, dedupe suffix, 80-char trim), `note-format.ts`, autosave outbox ordering and retry |
| Worker | Vitest with Hono's `app.request()`, plus a `wrangler dev` smoke test | JWT verification (valid, expired, wrong audience), rate limiting, OAuth state signing and expiry, token encryption round trip, Google error mapping (mocked fetch) |
| Components | Vitest + Testing Library | Save indicator states, ChipInput keyboard behavior, Stepper aria attributes |
| End-to-end | Playwright (Chromium, WebKit, mobile viewports) against `wrangler dev` + local Supabase | Golden path topic → joke → publish (share mocked), offline autosave (`context.setOffline`), back/forward, resume |
| Accessibility | `@axe-core/playwright` in e2e, manual NVDA + VoiceOver pass per phase, keyboard-only pass | AC-X1–X3 |
| Performance | Lighthouse CI on Home and Topic detail | Performance ≥ 85 (mobile), Accessibility ≥ 95 |
| Manual | Real devices: a mid-range Android phone (Chrome) and an iPhone (Safari) | Share-to-Keep behavior, touch targets, keyboard overlap with sticky footers |
| Auth | e2e uses Supabase test users created via the admin API (no real Google login in CI); a manual Google login check before each release | |

Phase 1 database tests live in `supabase/tests/database/phase1_rls.test.sql` (pgTAP, run by `pnpm db:test`).

---

## 18. Risks and open questions

| # | Risk / question | Impact | Mitigation / next step |
|---|---|---|---|
| R1 | **Keep API is Workspace-only** and its scope is restricted | No automatic Keep publishing for anyone | Share sheet and copy-and-open (§9.2); Docs Joke Book for automatic sync; re-verify before Phase 4 in case Google opens the API |
| R2 | Web Share to Keep behaves differently on iOS and desktop | Inconsistent publish UX | Detect capabilities; Copy & open fallback; test on real devices |
| R3 | Users can't confirm a share-sheet publish, so counts may be off | Stats accuracy | Explicit "Did it save?" confirmation; label the stat "Sent to Keep" |
| R4 | Method too complex on a small screen | Beginners give up | One decision per panel, help text, prototype testing in week 2 |
| R5 | Autosave conflicts across devices | Overwritten text | Field-level patches, `version` for multi-field operations, conflict banner |
| R6 | Copyright: help text drifting toward the book's wording | Legal | All copy is original; glossary review checklist; point to the books |
| R7 | Supabase Free plan pauses inactive projects and has no backups | Downtime and data risk | Nightly backup workflow from day one (it also keeps the project active); 30-day Trash; user export in Phase 5 |
| R8 | Google brand verification lead time for `drive.file` | Phase 4 delay for the Docs Joke Book | Start verification early; ship Share-to-Keep first, which needs no scopes |
| R10 | Free-tier limits (Workers 100k requests/day, Supabase 500 MB database, 50,000 monthly active users) | Outage if the app gets popular | Well above prototype needs; debounced autosave keeps request counts low; check usage monthly |
| R9 | Scope creep (rehearsal, AI) | Delays the core | Phase 6 backlog only |
| Q1 | Should a completed joke stay linked to edits on its attempt, or always be a snapshot? | | **Proposed:** snapshot plus an optional "Update joke card from dig" action |
| Q2 | Should assumptions belong to the setup (shared by attempts) or to each attempt? | | **Proposed:** setup (§7.3). Revisit after testing. |
| Q3 | Is a custom domain (`jokeshovel.app`) needed for the prototype? | | Not for testing. Use `workers.dev`. |
| Q4 | ~~Which Google Workspace tenant is available for Keep API testing?~~ | | **Answered:** none, so direct Keep publishing is dropped (§18.1) |
| Q5 | Should the brainstorm timer and prompts be configurable per user? | | Phase 5 decision |
| Q6 | ~~Monetization or free?~~ | | **Answered:** free (§18.1) |

### 18.1 Owner decisions (2026-10-27)

| Decision | Consequence for the design |
|---|---|
| **No Google Workspace account** | The direct Keep API tier is dropped (PUB-6 → Won't). Keep publishing is Share-to-Keep plus Copy & open for everyone. The Google Docs Joke Book is the only automatic sync, and the only Google scope beyond login is `drive.file`. `google_connections.account_type` and `publications.method = 'keep_api'` are left out of the Phase 4 migration. |
| **The app is free** | Supabase Free plan and Cloudflare free tiers only (NFR-5). The nightly backup to R2 is required, not optional (§10.11). No billing, plans, or paywall in scope. The OAuth consent screen goes to "In production" with brand verification only. Sensitive or restricted scopes, which would need a paid security assessment, stay out of scope. |

---

## 19. Recommended first sprint

> **Status (2026-10-28):** built and tested locally; waiting on account setup to deploy. See [`sprint-1-review.md`](sprint-1-review.md).

**Sprint 1 — "Break Ground"** · 2 weeks · 1 developer
**Sprint goal:** a deployed app where I can sign in with Google, create topics, brainstorm associations, write setups, see counts, close the tab mid-sentence, and find everything there when I come back.

### Before day 1 (owner, ~1 hour)
- [x] Create the GitHub repo `jokeshovel` and push this document plus the migration.
- [ ] Create a Supabase project (region near you). Note the project ref, URL, and anon key.
- [ ] Create a Google Cloud project, an OAuth consent screen (External, scopes `openid email profile`), and an OAuth client (Web) with redirect URI `https://<ref>.supabase.co/auth/v1/callback`.
- [ ] In Supabase → Auth → Providers → Google, paste the client id and secret. In Auth → URL configuration add `http://localhost:5173` and the Workers URL.
- [ ] Create a Cloudflare account, an API token (Workers edit), and note the account id.

### Backlog (in order)

| # | Ticket | Est. | Done when |
|---|---|---|---|
| S1-01 | **Monorepo scaffold:** pnpm workspaces, `apps/web` (Vite React TS), `worker` (Hono), `packages/shared`, ESLint, Prettier, tsconfig, `.env.example`, `.dev.vars.example` | 0.5 d | `pnpm dev` runs the web app and Worker locally |
| S1-02 | **Supabase local:** `supabase init`, move the migration in, `supabase start`, `supabase db reset` passes; generate TS types into `packages/shared/db.ts` | 0.5 d | Local DB has tables; types compile |
| S1-03 | **pgTAP RLS tests** converted from `phase1_rls_smoke.sql`: owner CRUD, cross-user read, insert, update, delete, and cross-link blocked on profiles, topics, associations, setups; `topic_stats` counts; `last_activity_at` bump | 0.5 d | `supabase test db` green |
| S1-04 | **Worker + assets:** `wrangler.toml` with `[assets]` SPA fallback, `/api/health`, security headers, JWT verify middleware (JWKS), `/api/me` | 0.5 d | `curl /api/me` returns 401 without a token and 200 with one |
| S1-05 | **CI:** `ci.yml` (lint, typecheck, Vitest, Supabase tests); `deploy.yml` (`supabase db push`, `wrangler deploy` on main) with GitHub secrets | 0.5 d | PR shows green checks; main deploys to workers.dev |
| S1-06 | **Auth UI:** `/signin` (Continue with Google), `/auth/callback` (PKCE exchange), `<RequireAuth>`, `next` handling, sign out (flush outbox first), Settings stub | 1 d | AC-1, AC-2 pass on the deployed URL |
| S1-07 | **Design tokens and shell:** `tokens.css` (colors checked for AA in light and dark), type scale, focus ring; AppShell with bottom tabs (phone) and rail (≥640 px); top bar with save indicator slot | 1 d | axe clean; 320 px no horizontal scroll |
| S1-08 | **Autosave core:** `useAutosave` (debounce 800 ms, blur, visibilitychange), IndexedDB outbox, replay on load and online, global `SaveIndicator` with an `aria-live` region; client UUIDs plus upsert | 1.5 d | AC-5, AC-6 pass (Playwright offline test) |
| S1-09 | **Topics:** list (from `topic_stats`, sort by activity), create, inline edit title and description, archive, soft delete with Undo toast | 1 d | AC-3, AC-7 |
| S1-10 | **Associations workspace:** ChipInput (Enter to add, keeps focus), rotating prompts, star, edit, delete with Undo, fractional reorder | 1 d | AC-4 |
| S1-11 | **Setups:** list under topic, "+ New setup" inline composer (empty allowed), edit, delete with Undo, "From starred associations" context panel | 1 d | SET-1 story passes |
| S1-12 | **Resume + Home:** write `profiles.last_location` on editing routes; Home Resume card, recent topics with stats chips, "+ New topic" | 0.5 d | RET-1: closing the tab and reopening goes back to the last edited setup |
| S1-13 | **E2E and a11y pass:** Playwright golden path (mock-auth test user), axe on each route, manual VoiceOver and keyboard check, Lighthouse | 0.5 d | AC-X1–X3; Lighthouse a11y ≥ 95 |
| S1-14 | **Demo and retro:** deploy, try it on your own phone for 2 days, note friction for Phase 2 | 0.5 d | Demo notes in `docs/sprint-1-review.md` |

**Total ≈ 10.5 days.** Buffer: drop S1-10 rotating prompts and S1-11 "from starred associations" first if time runs short.

### Day-1 commands

```bash
# after cloning the jokeshovel repo
pnpm create vite apps/web --template react-ts
mkdir -p worker/src packages/shared/src
pnpm init && printf 'packages:\n  - apps/*\n  - worker\n  - packages/*\n' > pnpm-workspace.yaml
pnpm add -w -D typescript eslint prettier vitest
pnpm --filter web add @supabase/supabase-js @tanstack/react-query react-router-dom idb-keyval
pnpm --filter worker add hono jose zod && pnpm --filter worker add -D wrangler @cloudflare/workers-types
npx supabase init     # keep supabase/migrations/20261027000000_phase1_core.sql
npx supabase start && npx supabase db reset
```

### Sprint 1 definition of done
- All S1 tickets meet their "done when" column.
- AC-1 … AC-8 and AC-X1 … AC-X3 pass.
- Deployed to production `workers.dev` from `main` by CI.
- No secrets in the repo. `.env.example` documents every variable.
- A short `docs/RUNBOOK.md`: how to run locally, deploy, roll back (`wrangler rollback`), and restore a backup.

---

## 20. Future roadmap

Ordered by expected value to comedians, after Phase 5:

1. **Version history** for setups, punches, and jokes: an append-only `revisions` table written on meaningful saves (debounced to 1 per 5 minutes per field), with diff view and restore. *Why:* comedians rewrite constantly and old wordings are often better.
2. **Collections and routines:** order jokes into sets, add segues and estimated time per joke (word count ÷ speaking rate), print a set list. Share a whole set to Keep as one note (one joke title per line).
3. **Rehearsal and performance tracking:** log a performance (venue, date, recording link) and per-joke result (laugh scale 0–3, notes). Jokes get a "stage-tested" badge and a laugh average.
4. **Act-outs and point-of-view exercises:** optional steps after the punch that prompt for an act-out (showing the second story in character) and alternate points of view. These are guided prompts in the app's own words.
5. **Workbook-style practice exercises** in the spirit of the companion workbook (e.g. a "Critic Spot" for self-review against a checklist, and a "Rehearsal Space" timer and teleprompter for running a set out loud). Written as original exercises, not reproduced from the books.
6. **Export and import:** Markdown or plain-text export of one joke, a topic, or everything; import a plain list of setups or associations from a pasted note.
7. **Sharing with a writing partner** (read-only link or a co-writer role). Needs a sharing model and RLS policy changes, so it comes late.
8. **Optional AI Socratic coach** — *future, opt-in, clearly labeled, off by default.* It asks questions ("What else could *my flight* mean?", "Who is the audience assuming is speaking?"), points out assumptions the user might have missed as questions, and checks whether a punch reveals the second story. **It never writes setups, punches, or jokes.** Content is sent to a model only with explicit per-use consent, and it would need its own privacy review.
9. **Native share target** (Android PWA `share_target`) so text shared from other apps lands as a new association or setup.

---

*End of design document.*
