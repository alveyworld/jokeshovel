/**
 * The body of a published joke: what goes into a Keep note or the Docs Joke
 * Book (docs/DESIGN.md §9.4). Shared by the browser (share sheet, copy) and
 * the Worker (Docs), so both send exactly the text the preview shows.
 */

/** The optional sections a user can include. Setup and punch always go in. */
export interface IncludeOptions {
  target: boolean;
  connectorAndReinterpretation: boolean;
  secondStory: boolean;
  dateAndLink: boolean;
}

export const DEFAULT_INCLUDE: IncludeOptions = {
  target: false,
  connectorAndReinterpretation: false,
  secondStory: false,
  dateAndLink: true,
};

/** Reads include options from untrusted JSON, falling back to the defaults. */
export function parseInclude(value: unknown): IncludeOptions {
  const v = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  const pick = (key: keyof IncludeOptions) =>
    typeof v[key] === 'boolean' ? (v[key] as boolean) : DEFAULT_INCLUDE[key];
  return {
    target: pick('target'),
    connectorAndReinterpretation: pick('connectorAndReinterpretation'),
    secondStory: pick('secondStory'),
    dateAndLink: pick('dateAndLink'),
  };
}

export interface NoteJoke {
  id: string;
  setup_text: string;
  punch_text: string;
  target_assumption_text: string;
  connector_text: string;
  reinterpretation_text: string;
  second_story_text: string;
  completed_at: string;
}

export interface NoteOptions {
  topicTitle: string;
  /** Origin for the link back, e.g. https://jokeshovel.app */
  appBaseUrl: string;
  include: IncludeOptions;
  /** IANA time zone for "Written Oct 27, 2026"; UTC when missing or unknown. */
  timeZone?: string;
}

/** "Oct 27, 2026" in the given time zone. */
export function formatNoteDate(iso: string, timeZone?: string): string {
  const format = (tz: string) =>
    new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: tz }).format(
      new Date(iso),
    );
  try {
    return format(timeZone || 'UTC');
  } catch {
    return format('UTC');
  }
}

/** True when the name is a time zone this runtime knows. */
export function isTimeZone(name: unknown): name is string {
  if (typeof name !== 'string' || !name) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: name });
    return true;
  } catch {
    return false;
  }
}

const oneLine = (text: string) => text.replace(/\s+/g, ' ').trim();

/**
 * Setup and punch, then "How I dug it" (only the checked sections that have
 * text, in a fixed order), then the date and the link back.
 */
export function formatNoteBody(joke: NoteJoke, { topicTitle, appBaseUrl, include, timeZone }: NoteOptions): string {
  const blocks: string[] = [[joke.setup_text.trim(), joke.punch_text.trim()].join('\n')];

  const dig: string[] = [];
  if (include.target && joke.target_assumption_text.trim()) {
    dig.push(`Target assumption: ${oneLine(joke.target_assumption_text)}`);
  }
  if (include.connectorAndReinterpretation) {
    if (joke.connector_text.trim()) dig.push(`Connector: “${oneLine(joke.connector_text)}”`);
    if (joke.reinterpretation_text.trim()) dig.push(`Reinterpretation: ${oneLine(joke.reinterpretation_text)}`);
  }
  if (include.secondStory && joke.second_story_text.trim()) {
    dig.push(`Second story: ${joke.second_story_text.trim()}`);
  }
  if (dig.length) blocks.push(['— How I dug it —', ...dig].join('\n'));

  if (include.dateAndLink) {
    const base = appBaseUrl.replace(/\/+$/, '');
    const topic = topicTitle.trim();
    const written = `Written ${formatNoteDate(joke.completed_at, timeZone)}`;
    blocks.push(
      [topic ? `Topic: ${topic} · ${written}` : written, `Open in The Joke Shovel: ${base}/j/${joke.id}`].join('\n'),
    );
  }
  return blocks.join('\n\n');
}

/** What Copy puts on the clipboard: the title, a blank line, then the body. */
export function noteText(title: string, body: string): string {
  return `${title.trim()}\n\n${body}`;
}
