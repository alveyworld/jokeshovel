import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router';
import { useDrafts, useJokes, useRecentSetups, useTopicSummaries } from '../data/hooks';
import { excerpt } from '../lib/text';

interface Item {
  key: string;
  kind: 'Topic' | 'Setup' | 'Draft' | 'Joke' | 'Go to' | 'Search';
  label: string;
  detail?: string;
  to: string;
  /** For "recent first" when nothing is typed. */
  at?: string;
}

const PAGES: Item[] = [
  ['Home', '/'],
  ['Topics', '/topics'],
  ['Drafts', '/drafts'],
  ['Jokes', '/jokes'],
  ['Search', '/search'],
  ['Stats', '/stats'],
  ['Settings', '/settings'],
  ['Trash', '/trash'],
].map(([label, to]) => ({ key: `page:${to}`, kind: 'Go to' as const, label, to }));

const MAX = 20;

/** 0 = starts with the query, 1 = a word starts with it, 2 = contains it; null = no match. */
function rank(item: Item, q: string): number | null {
  const label = item.label.toLowerCase();
  const all = `${label} ${(item.detail ?? '').toLowerCase()}`;
  if (!q.split(/\s+/).every((word) => all.includes(word))) return null;
  if (label.startsWith(q)) return 0;
  if (label.includes(` ${q}`)) return 1;
  return 2;
}

/**
 * The quick switcher (NAV-2, docs/DESIGN.md §5.2): jump to a topic, setup,
 * draft, joke or screen in a couple of keystrokes. A combobox: arrows move,
 * Enter opens, Esc closes.
 */
export function QuickSwitcher({ onClose }: { onClose(): void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const id = useId();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const { topics } = useTopicSummaries();
  const { drafts } = useDrafts();
  const { jokes } = useJokes();
  const { data: setups = [] } = useRecentSetups();

  useEffect(() => {
    const d = dialog.current;
    if (d && !d.open) d.showModal();
    // showModal focuses the first control (Close); the switcher is for typing.
    input.current?.focus();
    return () => d?.close();
  }, []);

  const items = useMemo(() => {
    const topicTitle = new Map(topics.map((t) => [t.id, t.title || 'Untitled topic']));
    return [
      ...topics.map((t) => ({
        key: `topic:${t.id}`,
        kind: 'Topic' as const,
        label: t.title || 'Untitled topic',
        detail: t.status === 'archived' ? 'Archived' : undefined,
        to: `/topics/${t.id}`,
        at: t.last_activity_at,
      })),
      ...setups
        .filter((s) => s.text.trim() && topicTitle.has(s.topic_id))
        .map((s) => ({
          key: `setup:${s.id}`,
          kind: 'Setup' as const,
          label: excerpt(s.text, 90),
          detail: topicTitle.get(s.topic_id),
          to: `/s/${s.id}`,
          at: s.updated_at,
        })),
      ...drafts.map((d) => ({
        key: `draft:${d.attempt_id}`,
        kind: 'Draft' as const,
        label: excerpt(d.setup_text ?? '', 90) || 'Untitled setup',
        detail: d.topic_title ?? undefined,
        to: `/a/${d.attempt_id}/${d.current_step}`,
        at: d.updated_at ?? undefined,
      })),
      ...jokes
        .filter((j) => topicTitle.has(j.topic_id))
        .map((j) => ({
          key: `joke:${j.id}`,
          kind: 'Joke' as const,
          label: j.title || excerpt(j.setup_text, 90),
          detail: topicTitle.get(j.topic_id),
          to: `/j/${j.id}`,
          at: j.updated_at,
        })),
    ] satisfies Item[];
  }, [topics, setups, drafts, jokes]);

  const q = query.trim().toLowerCase();
  const results = useMemo((): Item[] => {
    if (!q) {
      const recent = [...items].sort((a, b) => (b.at ?? '').localeCompare(a.at ?? '')).slice(0, 8);
      return [...recent, ...PAGES];
    }
    const matches = [...items, ...PAGES]
      .map((item) => ({ item, r: rank(item, q) }))
      .filter((m): m is { item: Item; r: number } => m.r !== null)
      .sort((a, b) => a.r - b.r || (b.item.at ?? '').localeCompare(a.item.at ?? ''))
      .slice(0, MAX)
      .map((m) => m.item);
    return [
      ...matches,
      {
        key: 'search',
        kind: 'Search',
        label: `Search everything for “${query.trim()}”`,
        to: `/search?q=${encodeURIComponent(query.trim())}`,
      },
    ];
  }, [items, q, query]);

  const current = Math.min(active, results.length - 1);
  const optionId = (i: number) => `${id}-option-${i}`;

  const go = (item: Item | undefined) => {
    if (!item) return;
    onClose();
    navigate(item.to);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const moves: Record<string, () => number> = {
      ArrowDown: () => (current + 1) % results.length,
      ArrowUp: () => (current - 1 + results.length) % results.length,
      Home: () => 0,
      End: () => results.length - 1,
    };
    if (e.key === 'Enter') {
      e.preventDefault();
      go(results[current]);
      return;
    }
    const move = moves[e.key];
    if (!move || !results.length) return;
    e.preventDefault();
    const next = move();
    setActive(next);
    document.getElementById(optionId(next))?.scrollIntoView({ block: 'nearest' });
  };

  return (
    <dialog
      ref={dialog}
      className="sheet switcher"
      aria-labelledby={`${id}-heading`}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className="sheet__head">
        <h2 id={`${id}-heading`}>Quick switcher</h2>
        <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
          <span aria-hidden="true">×</span>
        </button>
      </div>
      <div className="sheet__body switcher__body">
        <input
          type="text"
          role="combobox"
          aria-label="Jump to"
          aria-expanded="true"
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          aria-activedescendant={results.length ? optionId(current) : undefined}
          placeholder="Type a topic, setup, joke or screen"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
          autoComplete="off"
          ref={input}
        />
        <ul
          id={`${id}-list`}
          role="listbox"
          aria-label={q ? 'Matches' : 'Recent and screens'}
          className="switcher__list"
        >
          {results.map((item, i) => (
            // Mouse users click; keyboard users use the combobox above.
            // eslint-disable-next-line jsx-a11y/click-events-have-key-events
            <li
              key={item.key}
              id={optionId(i)}
              role="option"
              aria-selected={i === current}
              className={`switcher__option ${i === current ? 'is-active' : ''}`}
              onClick={() => go(item)}
              onMouseMove={() => setActive(i)}
            >
              <span className="switcher__kind">{item.kind}</span>
              <span className="switcher__label">{item.label}</span>
              {item.detail ? <span className="switcher__detail">{item.detail}</span> : null}
            </li>
          ))}
        </ul>
        <p className="field__hint help">
          <kbd>↑</kbd> <kbd>↓</kbd> to move, <kbd>Enter</kbd> to open, <kbd>Esc</kbd> to close.
        </p>
      </div>
    </dialog>
  );
}
