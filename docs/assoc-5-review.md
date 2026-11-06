# ASSOC-5 review: turn an association into its own topic

**Story:** *As a comedian, I want to turn a promising association into its own topic, so that I can dig into it further without losing where it came from.* (docs/DESIGN.md §14, acceptance criteria AC-28 to AC-34 in §15.)

**Result:** built and tested locally against Supabase. It goes live with the next deploy; the new migration is applied automatically.

## What you can do now

1. **Make it a topic.** Every association row has a new **⤴** button ("Make “TSA” a topic"). Tapping it creates a topic titled with the association's text and opens its Associations screen, ready to type. Back returns to where you were.
2. **Both sides link to each other.**
   - The association stays in the original topic, so its counts don't change.
   - Its **⤴** becomes an accent-coloured **↗** that opens the new topic.
   - The new topic shows **Made from “TSA” in Airports** under its title, linking back.
3. **No duplicates.**
   - Tapping **↗** opens the existing topic instead of making another.
   - A double tap or a retry after a dropped connection still makes exactly one topic.
4. **Same title.** If you already have an active topic with that title (ignoring case), the app asks: **Open “Dogs”** or **Create another**. Closing the dialog changes nothing.
5. **Long associations.** Associations can be 200 characters but topic titles only 120, so a longer one becomes a title cut at the last whole word that fits. Rename it like any topic.
6. **Offline.** It works offline like the rest of the app, and syncs when you reconnect.
7. **Deleting.**
   - **Trashing the new topic** turns the **↗** back into **⤴**, and restoring the topic brings the link back.
   - **Deleting the association** keeps the topic and removes its "Made from" line.

## How it works

- **Database:** `topics.source_association_id`, with a composite foreign key `(source_association_id, user_id)` → `associations (id, user_id)`, so a topic can only link to its owner's association.
  - If the association is deleted for good (the Trash purge, or deleting its topic), the link is set to null and the topic stays.
  - A partial unique index allows one live topic per association.
- **A second live topic for the same association:** the app never makes one itself. It can still happen when:
  - the association was converted on another device as well, or
  - a trashed topic is restored after its association was converted again.

  In either case, a trigger keeps the topic and drops its link instead of rejecting the save, so no work is lost.
- **Saving:** the new topic goes through the same save queue as everything else. The association's own creation is always queued ahead of it, so the link is valid even when both were made offline.

## Decisions made while building

- **Keep vs move:** the association stays in the original topic rather than moving out.
- **One tap, no confirmation:** the topic is created straight away and renamed afterwards if needed. The only question is the same-title one.
- **Nothing copied:** the new topic starts empty, and the original topic's tags aren't copied.
- **Row width on phones:** a fourth button pushed association rows onto two lines on phones. The new button is 36 px wide (like the move buttons) and the spacing is tighter, so rows stay on one line from 360 px wide, as before. At 320 px they wrap, as they already did.
- **Wording:** the link back reads "Made from “TSA” in Airports" rather than "From Airports › TSA", so screen readers and everyone else get the same plain words.
- **Changing topics:** the topic screen's tabs now start fresh when you move to another topic, so the new topic's input is empty and focused.

## Tests

- **Database (pgTAP), 17 new:**
  - linking, and retries keeping the link
  - one live topic per association, and the second-device case
  - Trash and restore
  - deleting the association or the original topic
  - Bob can't link to Alice's association (AC-34)
- **Unit, 8 new:** title from long text (whole-word cut, punctuation, single long word, limit), and same-title matching.
- **End-to-end (desktop and mobile), 6 new:**
  - AC-28/29: create, focus, Back, links both ways, reload
  - AC-30: reopen, and a double tap creates one topic. Removing the guard makes this test fail with 2 topics.
  - AC-31: same-title dialog (Open, Close, Create another), and long text
  - AC-32: offline
  - AC-33: Trash and restore, and deleting the association
  - axe scans of the new screens and the dialog
- **Full suite:** 149 database tests, 119 unit tests and 82 end-to-end tests pass. The 320 px layout checks pass.
