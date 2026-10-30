/**
 * Suggested titles for jokes and Google Keep notes: "[Topic] — [Setup
 * keywords]" (plus " — Joke" for Keep). Deterministic, per docs/DESIGN.md §9.4.
 */

const STOP_WORDS = new Set(
  `a about above after again against all am an and any are aren't as at be because been before being below
   between both but by can can't cannot could couldn't did didn't do does doesn't doing don't down during each
   few for from further get gets got had hadn't has hasn't have haven't having he he'd he'll he's her here
   here's hers herself him himself his how how's i i'd i'll i'm i've if in into is isn't it it's its itself
   just let's like me more most mustn't my myself no nor not now of off on once only or other ought our ours
   ourselves out over own really same shan't she she'd she'll she's should shouldn't so some such than that
   that's the their theirs them themselves then there there's these they they'd they'll they're they've this
   those through to too under until up us very was wasn't we we'd we'll we're we've were weren't what what's
   when when's where where's which while who who's whom why why's will with won't would wouldn't you you'd
   you'll you're you've your yours yourself yourselves also always ever every went go goes going gone one two
   three four five six seven eight nine ten said says say yes yeah okay ok oh well still even much many thing
   things way lot lots back today yesterday tomorrow`
    .split(/\s+/)
    .filter(Boolean),
);

const WORD = /[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu;

export interface KeywordInput {
  setup: string;
  topic: string;
  connector?: string;
  associations?: readonly { text: string; is_starred?: boolean }[];
}

const normalise = (w: string) => w.toLowerCase().replace(/’/g, "'");
const titleCase = (w: string) =>
  w
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('-');

export interface KeywordCandidate {
  /** Title-cased word as it appears in titles ("Six-Hour"). */
  word: string;
  score: number;
  /** Position in the setup, for keeping setup order. */
  index: number;
}

/**
 * Every word of the setup that could go in a title, scored per
 * docs/DESIGN.md §9.4, in setup order. The Publish sheet shows these as chips.
 */
export function keywordCandidates({
  setup,
  topic,
  connector = '',
  associations = [],
}: KeywordInput): KeywordCandidate[] {
  const tokens = [...setup.matchAll(WORD)].map((m) => m[0]);
  const topicWords = new Set([...topic.matchAll(WORD)].map((m) => normalise(m[0])));
  const connectorWords = new Set([...connector.matchAll(WORD)].map((m) => normalise(m[0])));
  const associationScore = new Map<string, number>();
  for (const a of associations) {
    for (const m of a.text.matchAll(WORD)) {
      const w = normalise(m[0]);
      associationScore.set(w, Math.max(associationScore.get(w) ?? 0, a.is_starred ? 3 : 2));
    }
  }

  const seen = new Set<string>();
  return tokens
    .map((original, index) => ({ original, word: normalise(original), index }))
    .filter(({ word }) => {
      if (STOP_WORDS.has(word) || /^\d+$/.test(word) || topicWords.has(word) || seen.has(word)) return false;
      seen.add(word);
      return true;
    })
    .map((c) => {
      let score = 0;
      if (connectorWords.has(c.word)) score += 3;
      score += associationScore.get(c.word) ?? 0;
      if (c.word.length >= 6) score += 1;
      if (c.index > 0 && /^\p{Lu}/u.test(c.original)) score += 1;
      return { word: titleCase(c.word), score, index: c.index };
    });
}

/** The two most telling words of the setup, in setup order. */
export function setupKeywords(input: KeywordInput): string[] {
  const candidates = keywordCandidates(input);
  if (!candidates.length) return [...input.setup.matchAll(WORD)].slice(0, 4).map((m) => titleCase(m[0]));

  // The two best (ties go to the earlier word), shown in setup order.
  return [...candidates]
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, 2)
    .sort((a, b) => a.index - b.index)
    .map((c) => c.word);
}

const MAX_TITLE = 80;
const KEEP_SUFFIX = ' — Joke';

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);

/** "Airports — Flight Layover", trimmed to 80 characters. */
export function suggestTitle(input: KeywordInput): string {
  const keywords = setupKeywords(input).join(' ');
  return clip([input.topic.trim(), keywords].filter(Boolean).join(' — '), MAX_TITLE);
}

/**
 * A Keep note title, "[Topic] — [Keywords] — Joke" (docs/DESIGN.md §9.4),
 * at most 80 characters. `keywords` are in setup order.
 */
export function keepTitle(topic: string, keywords: readonly string[]): string {
  const base = [topic.trim(), keywords.join(' ')].filter(Boolean).join(' — ');
  return `${clip(base || 'Untitled', MAX_TITLE - KEEP_SUFFIX.length)}${KEEP_SUFFIX}`;
}

/** The suggested Keep title: the topic plus the two best keywords. */
export function suggestKeepTitle(input: KeywordInput): string {
  return keepTitle(input.topic, setupKeywords(input));
}

/**
 * Adds " #2", " #3"… when the title is already taken (ignoring case), before
 * the " — Joke" suffix if there is one: "Airports — Flight Layover #2 — Joke".
 */
export function uniqueTitle(title: string, taken: Iterable<string>): string {
  const used = new Set([...taken].map((t) => t.trim().toLowerCase()));
  if (!used.has(title.trim().toLowerCase())) return title;
  const keep = title.endsWith(KEEP_SUFFIX);
  const base = keep ? title.slice(0, -KEEP_SUFFIX.length) : title;
  for (let n = 2; ; n++) {
    const candidate = `${base} #${n}${keep ? KEEP_SUFFIX : ''}`;
    if (!used.has(candidate.toLowerCase())) return candidate;
  }
}
