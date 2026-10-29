/**
 * The Joke Mine: the steps that take one setup to a finished joke (steps
 * 6–12 of the flow in docs/DESIGN.md). Help text is written for The Joke Shovel,
 * not quoted from any book.
 */
export const MINE_STEPS = [
  {
    key: 'target',
    number: 6,
    label: 'Target',
    heading: 'Choose a target assumption',
    help: 'Pick the one assumption your joke will break. The others stay on the list for another attempt.',
  },
  {
    key: 'connector',
    number: 7,
    label: 'Connector',
    heading: 'Find the connector',
    help: 'The word, phrase or idea in the setup that the target relies on: the part that could be read another way.',
  },
  {
    key: 'reinterpretations',
    number: 8,
    label: 'Reinterpret',
    heading: 'Brainstorm reinterpretations',
    help: 'List other ways to read the connector, where the target would no longer be true. Go for quantity; judge later.',
  },
  {
    key: 'choose',
    number: 9,
    label: 'Choose',
    heading: 'Choose a reinterpretation',
    help: 'Pick the reading that surprises you most. The rest stay saved.',
  },
  {
    key: 'second_story',
    number: 10,
    label: 'Second story',
    heading: 'Write the second story',
    help: 'Describe the situation in which that reading is true. It is the hidden story your punch will reveal.',
  },
  {
    key: 'punch',
    number: 11,
    label: 'Punch',
    heading: 'Write the punch',
    help: 'Reveal the second story in as few words as you can. Try to put the surprise last.',
  },
  {
    key: 'review',
    number: 12,
    label: 'Review',
    heading: 'Review the joke',
    help: 'Read the setup and punch together. When it works, mark it complete and it joins your jokes.',
  },
] as const;

export type MineStepKey = (typeof MINE_STEPS)[number]['key'];

export function isMineStep(value: string | undefined): value is MineStepKey {
  return MINE_STEPS.some((s) => s.key === value);
}

/** Splits a setup into tappable words, keeping hyphenated words and apostrophes. */
export function setupWords(setup: string): string[] {
  return setup.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu) ?? [];
}

/** Which setup words (by index) appear, in order, in the connector text. */
export function selectedWordIndexes(words: readonly string[], connector: string): Set<number> {
  const wanted = setupWords(connector).map((w) => w.toLowerCase());
  const selected = new Set<number>();
  let from = 0;
  for (const w of wanted) {
    const i = words.findIndex((word, idx) => idx >= from && word.toLowerCase() === w);
    if (i === -1) continue;
    selected.add(i);
    from = i + 1;
  }
  return selected;
}

/** Toggles one word and returns the new connector text (selected words in setup order). */
export function toggleConnectorWord(words: readonly string[], connector: string, index: number): string {
  const selected = selectedWordIndexes(words, connector);
  if (selected.has(index)) selected.delete(index);
  else selected.add(index);
  return [...selected]
    .sort((a, b) => a - b)
    .map((i) => words[i])
    .join(' ');
}
