import type { SearchResult } from '@jokeshovel/shared';
import { useEffect, useId, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useSearch } from '../data/hooks';
import { excerpt } from '../lib/text';

type Kind = 'joke' | 'draft' | 'setup' | 'topic' | 'association';

const KINDS: { kind: Kind; label: string }[] = [
  { kind: 'joke', label: 'Jokes' },
  { kind: 'draft', label: 'Drafts' },
  { kind: 'setup', label: 'Setups' },
  { kind: 'topic', label: 'Topics' },
  { kind: 'association', label: 'Associations' },
];

function resultLink(r: SearchResult): string {
  switch (r.kind) {
    case 'joke':
      return `/j/${r.id}`;
    case 'draft':
      return `/a/${r.id}`;
    case 'setup':
      return `/s/${r.id}`;
    case 'topic':
      return `/topics/${r.id}`;
    default:
      return `/topics/${r.topic_id}/associations`;
  }
}

/** Wraps the first exact (case-insensitive) occurrence of `term` in <mark>. */
function Highlight({ text, term }: { text: string; term: string }) {
  const i = term ? text.toLowerCase().indexOf(term.toLowerCase()) : -1;
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark>{text.slice(i, i + term.length)}</mark>
      {text.slice(i + term.length)}
    </>
  );
}

/** Centers a long snippet on the match so it stays visible after shortening. */
function around(text: string, term: string, max = 140): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  const i = clean.toLowerCase().indexOf(term.toLowerCase());
  if (clean.length <= max || i < max / 2) return excerpt(clean, max);
  return `…${excerpt(clean.slice(i - Math.floor(max / 3)), max)}`;
}

export function Search() {
  const [params, setParams] = useSearchParams();
  const urlTerm = params.get('q') ?? '';
  const [input, setInput] = useState(urlTerm);
  const [kind, setKind] = useState<Kind | 'all'>('all');
  const inputId = useId();
  const term = urlTerm.trim();

  // Debounce typing into the URL (?q=), which drives the query and survives Back.
  useEffect(() => {
    const t = setTimeout(() => {
      if (input.trim() !== term) setParams(input.trim() ? { q: input.trim() } : {}, { replace: true });
    }, 250);
    return () => clearTimeout(t);
  }, [input, term, setParams]);

  const { data, isFetching, error } = useSearch(term);
  const tooShort = term.length < 2;
  const results = (!tooShort && data) || [];
  const counts = new Map(KINDS.map(({ kind: k }) => [k, results.filter((r) => r.kind === k).length]));
  const groups = KINDS.filter(({ kind: k }) => (kind === 'all' || kind === k) && counts.get(k));
  const total = kind === 'all' ? results.length : (counts.get(kind) ?? 0);

  const status = tooShort
    ? 'Type at least two letters to search.'
    : isFetching && !results.length
      ? 'Searching…'
      : total
        ? `${total} ${total === 1 ? 'match' : 'matches'} for “${term}”.`
        : `Nothing matches “${term}”.`;

  return (
    <div className="page">
      <h1 className="page__title">
        Sifting <span className="page__subtitle">Search</span>
      </h1>
      <form role="search" className="search-form" onSubmit={(e) => e.preventDefault()}>
        <label htmlFor={inputId} className="field__label">
          Search your material
        </label>
        <input
          id={inputId}
          type="search"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="A word from a setup, punch, topic or association"
          autoComplete="off"
          // Arriving at Search is a request to type.
          autoFocus
          maxLength={200}
        />
      </form>

      {!tooShort && results.length ? (
        <fieldset className="segmented">
          <legend className="visually-hidden">Show</legend>
          <label className={`segmented__option ${kind === 'all' ? 'is-selected' : ''}`}>
            <input type="radio" name="search-kind" checked={kind === 'all'} onChange={() => setKind('all')} />
            All {results.length}
          </label>
          {KINDS.filter(({ kind: k }) => counts.get(k)).map(({ kind: k, label }) => (
            <label key={k} className={`segmented__option ${kind === k ? 'is-selected' : ''}`}>
              <input type="radio" name="search-kind" checked={kind === k} onChange={() => setKind(k)} />
              {label} {counts.get(k)}
            </label>
          ))}
        </fieldset>
      ) : null}

      <p className="search-status" role="status">
        {status}
      </p>
      {error ? (
        <p className="field__error" role="alert">
          Search failed: {error.message}
        </p>
      ) : null}

      <div className={`search-results ${isFetching ? 'is-refreshing' : ''}`}>
        {groups.map(({ kind: k, label }) => {
          const rows = results.filter((r) => r.kind === k);
          return (
            <section key={k} aria-labelledby={`${inputId}-${k}`}>
              <h2 id={`${inputId}-${k}`} className="section-title">
                {label} <span className="subtabs__count">{rows.length}</span>
              </h2>
              <ul className="card-list">
                {rows.map((r) => (
                  <li key={`${r.kind}:${r.id}`}>
                    <Link to={resultLink(r)} className="card card--link">
                      {r.kind !== 'topic' ? <span className="card__eyebrow">{r.topic_title}</span> : null}
                      <span className="card__title">
                        <Highlight text={excerpt(r.title, 120) || 'Untitled'} term={term} />
                      </span>
                      {r.snippet ? (
                        <span className="card__desc">
                          <Highlight text={around(r.snippet, term)} term={term} />
                        </span>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
