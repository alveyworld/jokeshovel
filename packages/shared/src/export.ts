/**
 * "Export everything" (docs/DESIGN.md §5.3 Data, ORG-3): a versioned JSON file
 * that can be read back and checked, and a Markdown file for humans. Built in
 * the browser from the user's own rows; Trash is left out.
 */
import type { Database } from './database.types';

type Tables = Database['public']['Tables'];
type Row<T extends keyof Tables> = Omit<Tables[T]['Row'], 'user_id'>;

export const EXPORT_FORMAT = 'jokeshovel-export';
export const EXPORT_VERSION = 1;

/** Tables in the export, parents before children. */
export const EXPORT_TABLES = [
  'topics',
  'associations',
  'setups',
  'assumptions',
  'joke_attempts',
  'reinterpretations',
  'jokes',
  'publications',
  'tags',
  'topic_tags',
  'joke_tags',
] as const;
export type ExportTable = (typeof EXPORT_TABLES)[number];

export type ExportData = { [T in ExportTable]: Row<T>[] };

export interface ExportFile extends ExportData {
  format: typeof EXPORT_FORMAT;
  version: typeof EXPORT_VERSION;
  exported_at: string;
  account: { email: string | null };
}

/** Rows as fetched (user_id and all), before cleaning. */
export type RawExportData = { [T in ExportTable]: readonly Tables[T]['Row'][] };

export class ExportError extends Error {}

const live = <T extends { deleted_at?: string | null }>(rows: readonly T[]) => rows.filter((r) => !r.deleted_at);

function strip<T extends { user_id?: string }>(rows: readonly T[]): Omit<T, 'user_id'>[] {
  return rows.map(({ user_id, ...rest }) => {
    void user_id;
    return rest;
  });
}

function byAge<T extends { created_at?: string; id?: string }>(rows: T[]): T[] {
  return [...rows].sort(
    (a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? '') || (a.id ?? '').localeCompare(b.id ?? ''),
  );
}

/**
 * Keeps live rows whose parents are also exported, without user ids, in a
 * stable order, so the same data always exports the same way.
 */
export function buildExport(raw: RawExportData, meta: { exportedAt: string; email: string | null }): ExportFile {
  const topics = live(raw.topics);
  const topicIds = new Set(topics.map((t) => t.id));
  const underTopic = <T extends { topic_id: string; deleted_at?: string | null }>(rows: readonly T[]) =>
    live(rows).filter((r) => topicIds.has(r.topic_id));

  const setups = underTopic(raw.setups);
  const setupIds = new Set(setups.map((s) => s.id));
  const attempts = underTopic(raw.joke_attempts).filter((a) => setupIds.has(a.setup_id));
  const attemptIds = new Set(attempts.map((a) => a.id));
  const jokes = underTopic(raw.jokes);
  const jokeIds = new Set(jokes.map((j) => j.id));
  const tags = raw.tags;
  const tagIds = new Set(tags.map((t) => t.id));

  // Links to rows that aren't exported (a deleted setup, say) become null.
  const tidyJoke = (j: (typeof jokes)[number]) => ({
    ...j,
    setup_id: j.setup_id && setupIds.has(j.setup_id) ? j.setup_id : null,
    attempt_id: j.attempt_id && attemptIds.has(j.attempt_id) ? j.attempt_id : null,
  });
  const tidySetup = (s: (typeof setups)[number]) => ({
    ...s,
    parent_setup_id: s.parent_setup_id && setupIds.has(s.parent_setup_id) ? s.parent_setup_id : null,
  });
  const reinterpretations = live(raw.reinterpretations).filter((r) => attemptIds.has(r.attempt_id));
  const reinterpretationIds = new Set(reinterpretations.map((r) => r.id));
  const assumptions = live(raw.assumptions).filter((a) => setupIds.has(a.setup_id));
  const assumptionIds = new Set(assumptions.map((a) => a.id));
  const tidyAttempt = (a: (typeof attempts)[number]) => ({
    ...a,
    target_assumption_id:
      a.target_assumption_id && assumptionIds.has(a.target_assumption_id) ? a.target_assumption_id : null,
    selected_reinterpretation_id:
      a.selected_reinterpretation_id && reinterpretationIds.has(a.selected_reinterpretation_id)
        ? a.selected_reinterpretation_id
        : null,
  });

  return {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exported_at: meta.exportedAt,
    account: { email: meta.email },
    topics: byAge(strip(topics)),
    associations: byAge(strip(underTopic(raw.associations))),
    setups: byAge(strip(setups.map(tidySetup))),
    assumptions: byAge(strip(assumptions)),
    joke_attempts: byAge(strip(attempts.map(tidyAttempt))),
    reinterpretations: byAge(strip(reinterpretations)),
    jokes: byAge(strip(jokes.map(tidyJoke))),
    publications: byAge(strip(raw.publications.filter((p) => jokeIds.has(p.joke_id)))),
    tags: byAge(strip(tags)),
    topic_tags: strip(raw.topic_tags.filter((x) => topicIds.has(x.topic_id) && tagIds.has(x.tag_id))).sort(
      (a, b) => a.topic_id.localeCompare(b.topic_id) || a.tag_id.localeCompare(b.tag_id),
    ),
    joke_tags: strip(raw.joke_tags.filter((x) => jokeIds.has(x.joke_id) && tagIds.has(x.tag_id))).sort(
      (a, b) => a.joke_id.localeCompare(b.joke_id) || a.tag_id.localeCompare(b.tag_id),
    ),
  };
}

export function serializeExport(file: ExportFile): string {
  return `${JSON.stringify(file, null, 2)}\n`;
}

/**
 * Reads an export back and checks it: the format and version, every table
 * present, and every link pointing at a row in the file.
 */
export function parseExport(text: string): ExportFile {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new ExportError('This isn’t a JSON file.');
  }
  const file = data as Partial<ExportFile> | null;
  if (!file || file.format !== EXPORT_FORMAT) throw new ExportError('This isn’t a Joke Shovel export.');
  if (file.version !== EXPORT_VERSION) throw new ExportError(`Unsupported export version ${String(file.version)}.`);
  for (const table of EXPORT_TABLES) {
    if (!Array.isArray(file[table])) throw new ExportError(`The export is missing “${table}”.`);
  }
  const f = file as ExportFile;
  const ids = (rows: readonly { id: string }[]) => new Set(rows.map((r) => r.id));
  const topics = ids(f.topics);
  const setups = ids(f.setups);
  const attempts = ids(f.joke_attempts);
  const jokes = ids(f.jokes);
  const tags = ids(f.tags);
  const check = (ok: boolean, what: string) => {
    if (!ok) throw new ExportError(`The export is damaged: ${what}.`);
  };
  for (const r of f.associations) check(topics.has(r.topic_id), 'an association without its topic');
  for (const r of f.setups) check(topics.has(r.topic_id), 'a setup without its topic');
  for (const r of f.setups) check(!r.parent_setup_id || setups.has(r.parent_setup_id), 'a branch without its parent');
  for (const r of f.assumptions) check(setups.has(r.setup_id), 'an assumption without its setup');
  for (const r of f.joke_attempts) check(setups.has(r.setup_id), 'a draft without its setup');
  for (const r of f.reinterpretations) check(attempts.has(r.attempt_id), 'a reinterpretation without its draft');
  for (const r of f.jokes) check(topics.has(r.topic_id), 'a joke without its topic');
  for (const r of f.publications) check(jokes.has(r.joke_id), 'a publication without its joke');
  for (const r of f.topic_tags) check(topics.has(r.topic_id) && tags.has(r.tag_id), 'a topic tag without its tag');
  for (const r of f.joke_tags) check(jokes.has(r.joke_id) && tags.has(r.tag_id), 'a joke tag without its tag');
  return f;
}

// ---------------------------------------------------------------------------
// Markdown
// ---------------------------------------------------------------------------

/**
 * Plain text that stays plain in Markdown: control characters are dropped,
 * inline markup is escaped, and lines can't start a heading, quote or list.
 */
export function mdText(text: string): string {
  return (
    text
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
      .replace(/\r\n?/g, '\n')
      .replace(/([\\`*_[\]<>|])/g, '\\$1')
      .split('\n')
      .map((line) => line.replace(/^(\s*)([#+-]|\d+\.)(?=\s|$)/, '$1\\$2').trimEnd())
      .join('  \n')
  );
}

const day = (iso: string) =>
  new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(iso),
  );

export function exportToMarkdown(file: ExportFile): string {
  const tagName = new Map(file.tags.map((t) => [t.id, t.name]));
  const tagsOf = (links: readonly { tag_id: string }[]) =>
    links
      .map((l) => tagName.get(l.tag_id))
      .filter((n): n is string => Boolean(n))
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  const liveJokes = file.jokes;

  const out: string[] = [
    '# The Joke Shovel — export',
    '',
    `Exported ${day(file.exported_at)} · ${file.topics.length} ${file.topics.length === 1 ? 'topic' : 'topics'} · ${liveJokes.length} ${liveJokes.length === 1 ? 'joke' : 'jokes'}`,
  ];

  const topics = [...file.topics].sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }));
  for (const topic of topics) {
    out.push('', `## ${mdText(topic.title || 'Untitled topic')}${topic.status === 'archived' ? ' (archived)' : ''}`);
    const topicTags = tagsOf(file.topic_tags.filter((x) => x.topic_id === topic.id));
    if (topicTags.length) out.push('', `Tags: ${topicTags.map(mdText).join(', ')}`);
    if (topic.description.trim()) out.push('', mdText(topic.description));

    const jokes = liveJokes.filter((j) => j.topic_id === topic.id);
    if (jokes.length) {
      out.push('', '### Jokes');
      for (const joke of jokes) {
        const marks = [joke.rating ? '★'.repeat(joke.rating) : '', joke.is_favorite ? '♥' : ''].filter(Boolean);
        out.push(
          '',
          `#### ${mdText(joke.title || 'Untitled joke')}${marks.length ? ` ${marks.join(' ')}` : ''}`,
          '',
          mdText(joke.setup_text),
          '',
          `**${mdText(joke.punch_text)}**`,
        );
        const jokeTags = tagsOf(file.joke_tags.filter((x) => x.joke_id === joke.id));
        const meta = [
          joke.status === 'archived' ? 'Archived' : '',
          jokeTags.length ? `Tags: ${jokeTags.map(mdText).join(', ')}` : '',
          `Completed ${day(joke.completed_at)}`,
        ].filter(Boolean);
        out.push('', meta.join(' · '));
        if (joke.notes.trim()) out.push('', `Notes: ${mdText(joke.notes)}`);
      }
    }

    const setups = file.setups.filter((s) => s.topic_id === topic.id && s.text.trim());
    if (setups.length) {
      out.push('', '### Setups', '');
      for (const s of setups) out.push(`- ${mdText(s.text)}`);
    }

    const associations = file.associations.filter((a) => a.topic_id === topic.id);
    if (associations.length) {
      out.push('', '### Associations', '', associations.map((a) => mdText(a.text)).join(', '));
    }
  }
  return `${out.join('\n')}\n`;
}

// ---------------------------------------------------------------------------
// Tags
// ---------------------------------------------------------------------------

export const TAG_MAX = 40;

/** The same tidying the database does: trimmed, single spaces. */
export function cleanTagName(name: string): string {
  return name.replace(/\s+/g, ' ').trim();
}

/** Clean names, dropping blanks and case-insensitive repeats (first spelling wins). */
export function uniqueTagNames(names: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of names) {
    const name = cleanTagName(raw);
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}
