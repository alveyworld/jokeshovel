# COMP-4 review: completed jokes as 3×5 index cards

**Story:** *As a comedian, I want my completed jokes to look like the 3×5 index cards I keep my material on, so that my collection feels like my joke file and finished jokes stand out from work in progress.* (docs/DESIGN.md §14, acceptance criteria AC-35 to AC-41 in §15.)

**Result:** built and tested locally. Nothing changes in the database. It goes live with the next deploy.

## What you see now

1. **Jokes tab and a topic's Jokes tab (AC-35, AC-38).**
   - Each finished joke is a white index card on the yellow legal pad, with a thin edge and a soft shadow.
   - The title sits above a red header line, with the topic in small capitals at the right.
   - The setup and the bold punch sit on light-blue rules.
   - Tags, rating, favorite, "Archived" and "In Keep" are written on the last lines.
   - Cards are never shorter than 3:5 and grow when a joke needs more lines. Wide screens show them side by side.
2. **The joke page (AC-36).**
   - The joke is one larger card: the title on the header line, then the setup and the punch on the rules.
   - You edit all three right on the card, and the text box grows line by line as you type.
   - Publishing, rating, tags, notes and history are below the card.
3. **Dark theme (AC-39).** The card is a dimmed card stock with faint rules and a muted red line, not a bright white rectangle.
4. **Work in progress keeps the legal pad (AC-41).** Topics, associations, setups and drafts are unchanged.

## How it works

- **Rule spacing:**
  - The rules are a CSS background repeated every `--card-line`.
  - That's 1.75rem on list cards and 2rem on the joke page.
  - Every line of text on the card uses the same value as its line height, and `--card-lift` raises each rule to just under the text's baseline.
  - Both values are in rem, so wrapping, browser zoom and larger text settings keep each line on a rule (AC-37).
- **Text boxes on the joke page:**
  - They use `field-sizing: content`, so they grow a whole line at a time.
  - Browsers without it (currently Firefox) keep two rows and scroll inside the box. There, the box draws its own rules, which scroll with the text.
- **Accessibility (AC-40):**
  - The rules and red line are decoration. Screen readers hear the title, topic, setup, punch and details, as before.
  - In forced-colors (high contrast) mode the card's edge and the header line stay visible.
  - Colours are tokens (`--card-stock`, `--card-edge`, `--card-red`, `--card-rule`) in both themes. Text on the card meets 4.5:1.

## Decisions made while building

- **Font:** the app's own typeface, not a handwriting font, for readability.
- **Printing** onto real 3×5 cards isn't included; it could be its own story.
- **Labels on the joke page:** the Setup and Punch labels are hidden (screen readers still announce them) so the card reads like a card. Empty fields show "Setup" and "Punch" as placeholders, and the punch is bold.
- **The topic** moved from above the title to the right of it on list cards, so the title is the first thing on the card. A link's name now starts with the title.

## Tests

- **End-to-end:** 5 new, run on desktop and mobile:
  - **AC-35/38/41:** the card on both Jokes tabs, with the red line, rules, shadow, at least 3:5, and every line on a rule. Tags, rating and favorite are shown, and there are no cards on topics, setups or drafts.
  - **AC-36/37:** the joke page card, editing in place, a wrapped setup staying on the rules, and changes saved.
  - **AC-37/40:** the rules follow the text at 100% and 200% text size, at 320 px and 1000 px wide. Nothing is cut off, and there's no sideways scroll.
  - **AC-39:** a dimmed card in dark mode, with text contrast of at least 4.5:1.
  - **AC-40:** screen-reader names, axe in the light and dark themes, and forced colors.
- **Checking the checks:** giving the card text a different line height makes the alignment test fail.
- **Full suite:** 91 end-to-end tests and 119 unit tests pass, along with lint, typecheck and the build.
