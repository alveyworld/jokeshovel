import { selectedWordIndexes, setupWords, toggleConnectorWord } from '@jokeshovel/shared';

/** The setup as tappable words that fill in the connector (in setup order). */
export function WordChips({
  setup,
  connector,
  onChange,
}: {
  setup: string;
  connector: string;
  onChange(connector: string): void;
}) {
  const words = setupWords(setup);
  const selected = selectedWordIndexes(words, connector);
  if (!words.length) return null;
  return (
    <div className="word-chips" role="group" aria-label="Words in your setup">
      {words.map((word, i) => (
        <button
          key={`${word}-${i}`}
          type="button"
          className={`chip-btn ${selected.has(i) ? 'is-selected' : ''}`}
          aria-pressed={selected.has(i)}
          onClick={() => onChange(toggleConnectorWord(words, connector, i))}
        >
          {word}
        </button>
      ))}
    </div>
  );
}
