import { describe, expect, it } from 'vitest';
import {
  EXPORT_TABLES,
  ExportError,
  buildExport,
  exportToMarkdown,
  mdText,
  parseExport,
  serializeExport,
  uniqueTagNames,
  type RawExportData,
} from './export';

const U = 'user-1';
const T = '2026-10-30T12:00:00Z';
const base = { user_id: U, created_at: T, updated_at: T, deleted_at: null };

function fixture(): RawExportData {
  return {
    topics: [
      {
        ...base,
        id: 't1',
        title: 'Airports',
        description: '',
        notes: '',
        status: 'active',
        is_favorite: false,
        archived_at: null,
        last_activity_at: T,
      },
      {
        ...base,
        id: 't2',
        title: 'Deleted topic',
        description: '',
        notes: '',
        status: 'active',
        is_favorite: false,
        archived_at: null,
        last_activity_at: T,
        deleted_at: T,
      },
    ],
    associations: [
      { ...base, id: 'a1', topic_id: 't1', text: 'layover', sort_order: 1, is_starred: true },
      { ...base, id: 'a2', topic_id: 't2', text: 'orphaned by the deleted topic', sort_order: 1, is_starred: false },
    ],
    setups: [
      {
        ...base,
        id: 's1',
        topic_id: 't1',
        parent_setup_id: null,
        text: 'My flight had a six-hour layover.',
        notes: '',
        status: 'active',
        is_favorite: false,
        sort_order: 1,
        archived_at: null,
      },
      {
        ...base,
        id: 's2',
        topic_id: 't1',
        parent_setup_id: 's1',
        text: '# My flight *was* late',
        notes: '',
        status: 'active',
        is_favorite: false,
        sort_order: 2,
        archived_at: null,
      },
      {
        ...base,
        id: 's3',
        topic_id: 't1',
        parent_setup_id: null,
        text: 'in the Trash',
        notes: '',
        status: 'active',
        is_favorite: false,
        sort_order: 3,
        archived_at: null,
        deleted_at: T,
      },
    ],
    assumptions: [{ ...base, id: 'x1', setup_id: 's1', text: 'The speaker is a passenger.', sort_order: 1 }],
    joke_attempts: [
      {
        ...base,
        id: 'd1',
        setup_id: 's1',
        topic_id: 't1',
        status: 'completed',
        current_step: 'review',
        target_assumption_id: 'x1',
        connector: 'my flight',
        connector_note: '',
        selected_reinterpretation_id: 'r1',
        second_story: 'I’m the pilot.',
        punch: 'So I did loop-de-loops.',
        notes: '',
        started_at: T,
        last_step_at: T,
        completed_at: T,
      },
    ],
    reinterpretations: [
      { ...base, id: 'r1', attempt_id: 'd1', text: 'the flight I’m piloting', sort_order: 1, is_starred: false },
    ],
    jokes: [
      {
        ...base,
        id: 'j1',
        topic_id: 't1',
        setup_id: 's3',
        attempt_id: 'd1',
        title: 'Airports — Flight Layover',
        setup_text: 'My flight had a six-hour layover.',
        punch_text: 'So I did loop-de-loops.\nOn the tarmac.',
        target_assumption_text: '',
        connector_text: 'my flight',
        reinterpretation_text: '',
        second_story_text: '',
        notes: 'Closer.',
        status: 'complete',
        is_favorite: true,
        rating: 4,
        completed_at: T,
        archived_at: null,
      },
    ],
    publications: [
      {
        id: 'p1',
        user_id: U,
        joke_id: 'j1',
        client_request_id: 'c1',
        destination: 'google_keep',
        method: 'share_sheet',
        status: 'user_confirmed',
        title: 'Airports — Flight Layover — Joke',
        body: 'b',
        include_options: {},
        external_id: null,
        external_url: null,
        error_code: null,
        error_message: null,
        attempt_count: 1,
        requested_at: T,
        completed_at: T,
        created_at: T,
        updated_at: T,
      },
    ],
    tags: [{ id: 'g1', user_id: U, name: 'Opener', color: null, created_at: T }],
    topic_tags: [{ topic_id: 't1', tag_id: 'g1', user_id: U }],
    joke_tags: [{ joke_id: 'j1', tag_id: 'g1', user_id: U }],
  };
}

const META = { exportedAt: '2026-10-31T09:00:00Z', email: 'bea@example.com' };

describe('JSON export', () => {
  it('round-trips: what is written reads back identically', () => {
    const file = buildExport(fixture(), META);
    expect(parseExport(serializeExport(file))).toEqual(file);
  });

  it('leaves out the Trash, rows under deleted parents, and user ids', () => {
    const file = buildExport(fixture(), META);
    expect(file.topics.map((t) => t.id)).toEqual(['t1']);
    expect(file.associations.map((a) => a.id)).toEqual(['a1']);
    expect(file.setups.map((s) => s.id)).toEqual(['s1', 's2']);
    expect(JSON.stringify(file)).not.toContain(U);
    // The joke stays; its link to the deleted setup becomes null.
    expect(file.jokes[0]).toMatchObject({ id: 'j1', setup_id: null, attempt_id: 'd1' });
    expect(file.setups[1].parent_setup_id).toBe('s1');
  });

  it('includes every table, so nothing is silently dropped', () => {
    const file = buildExport(fixture(), META);
    for (const table of EXPORT_TABLES) expect(file[table].length, table).toBeGreaterThan(0);
  });

  it('rejects files that aren’t exports, or that are damaged', () => {
    expect(() => parseExport('not json')).toThrow(ExportError);
    expect(() => parseExport('{"format":"other"}')).toThrow('isn’t a Joke Shovel export');
    const file = buildExport(fixture(), META);
    expect(() => parseExport(JSON.stringify({ ...file, version: 9 }))).toThrow('version 9');
    const { jokes, ...missing } = file;
    void jokes;
    expect(() => parseExport(JSON.stringify(missing))).toThrow('missing “jokes”');
    const broken = { ...file, setups: [{ ...file.setups[0], topic_id: 'nope' }, file.setups[1]] };
    expect(() => parseExport(JSON.stringify(broken))).toThrow('a setup without its topic');
  });
});

describe('Markdown export', () => {
  it('lists each topic’s jokes, setups and associations', () => {
    const md = exportToMarkdown(buildExport(fixture(), META));
    expect(md).toContain('# The Joke Shovel — export\n\nExported Oct 31, 2026 · 1 topic · 1 joke');
    expect(md).toContain('## Airports\n\nTags: Opener');
    expect(md).toContain('#### Airports — Flight Layover ★★★★ ♥');
    expect(md).toContain('My flight had a six-hour layover.\n\n**So I did loop-de-loops.  \nOn the tarmac.**');
    expect(md).toContain('Tags: Opener · Completed Oct 30, 2026');
    expect(md).toContain('Notes: Closer.');
    expect(md).toContain('### Associations\n\nlayover');
    expect(md).not.toContain('Deleted topic');
  });

  it('keeps the user’s text as text', () => {
    const md = exportToMarkdown(buildExport(fixture(), META));
    expect(md).toContain('- \\# My flight \\*was\\* late');
    expect(mdText('a\u0000b\u0007c')).toBe('abc');
    expect(mdText('<script>')).toBe('\\<script\\>');
    expect(mdText('1. first\n- second')).toBe('\\1. first  \n\\- second');
  });
});

describe('tag names', () => {
  it('tidies, drops blanks and merges case-insensitive repeats', () => {
    expect(uniqueTagNames(['  Opener ', 'clean  set', 'OPENER', ''])).toEqual(['Opener', 'clean set']);
  });
});
