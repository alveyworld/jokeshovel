import { useId, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { axisTicks } from '../lib/stats';

export interface ColumnDatum {
  /** Short axis label ("Oct 26"). */
  label: string;
  /** Full label for the tooltip and table ("Week of Oct 26"). */
  long: string;
  value: number;
}

interface Props {
  title: string;
  subtitle?: string;
  data: readonly ColumnDatum[];
  /** Singular and plural unit for readouts: ['setup', 'setups']. */
  unit: [string, string];
  /** Show every nth axis label so they never collide on a phone. */
  labelEvery?: number;
}

/**
 * A single-series column chart. Columns grow from one baseline with rounded
 * tops; hovering, or focusing the plot and using the arrow keys, shows each
 * value. Every value is also in the table view.
 */
export function ColumnChart({ title, subtitle, data, unit, labelEvery = 3 }: Props) {
  const id = useId();
  const [active, setActive] = useState<number | null>(null);
  const [announce, setAnnounce] = useState('');
  const ticks = axisTicks(Math.max(0, ...data.map((d) => d.value)));
  const top = ticks[ticks.length - 1];
  const n = data.length;
  const last = n - 1;
  const readout = (d: ColumnDatum) => `${d.long}: ${d.value} ${d.value === 1 ? unit[0] : unit[1]}`;

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const i = Math.floor(((e.clientX - box.left) / box.width) * n);
    setActive(Math.min(last, Math.max(0, i)));
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const keys: Record<string, (i: number) => number> = {
      ArrowRight: (i) => Math.min(last, i + 1),
      ArrowLeft: (i) => Math.max(0, i - 1),
      Home: () => 0,
      End: () => last,
    };
    const move = keys[e.key];
    if (!move) return;
    e.preventDefault();
    const next = move(active ?? last);
    setActive(next);
    setAnnounce(readout(data[next]));
  };

  return (
    <figure className="chart" aria-labelledby={`${id}-title`}>
      <figcaption className="chart__head">
        <h3 id={`${id}-title`} className="chart__title">
          {title}
        </h3>
        {subtitle ? <p className="chart__subtitle">{subtitle}</p> : null}
      </figcaption>

      <div className="chart__frame">
        <div className="chart__yaxis" aria-hidden="true">
          {ticks.map((t) => (
            <span key={t} style={{ bottom: `${(t / top) * 100}%` }}>
              {t}
            </span>
          ))}
        </div>
        {/* One tab stop that reads the columns with the arrow keys; the table view lists them all. */}
        {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
        <div
          className="chart__plot"
          role="group"
          // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
          tabIndex={0}
          aria-label={`${title}. Use the left and right arrow keys to read each week.`}
          onPointerMove={onPointerMove}
          onPointerLeave={() => setActive(null)}
          onFocus={() => setActive((i) => i ?? last)}
          onBlur={() => setActive(null)}
          onKeyDown={onKeyDown}
        >
          <div className="chart__grid" aria-hidden="true">
            {ticks.map((t) => (
              <span key={t} style={{ bottom: `${(t / top) * 100}%` }} />
            ))}
          </div>
          <div className="chart__cols" aria-hidden="true">
            {data.map((d, i) => (
              <div key={d.long} className={`chart__col ${active === i ? 'is-active' : ''}`}>
                {/* Label only the latest week; the axis, tooltip and table carry the rest. */}
                {i === last && d.value > 0 && active === null ? (
                  <span className="chart__cap" style={{ bottom: `${(d.value / top) * 100}%` }}>
                    {d.value}
                  </span>
                ) : null}
                <div className="chart__bar" style={{ height: `${(d.value / top) * 100}%` }} />
              </div>
            ))}
          </div>
          {active !== null ? (
            <div
              className={`chart__tip ${active < n / 2 ? 'chart__tip--right' : 'chart__tip--left'}`}
              style={{ left: `${((active + 0.5) / n) * 100}%` }}
              aria-hidden="true"
            >
              <span>
                <strong>{data[active].value}</strong> {data[active].value === 1 ? unit[0] : unit[1]}
              </span>
              <span>{data[active].long}</span>
            </div>
          ) : null}
        </div>
        <div className="chart__xaxis" aria-hidden="true">
          {data.map((d, i) => (
            <span key={d.long}>{(last - i) % labelEvery === 0 ? d.label : ''}</span>
          ))}
        </div>
      </div>
      <p className="visually-hidden" aria-live="polite">
        {announce}
      </p>

      <details className="chart__table">
        <summary>Show as table</summary>
        <table>
          <caption className="visually-hidden">{title}</caption>
          <thead>
            <tr>
              <th scope="col">Week</th>
              <th scope="col">{unit[1][0].toUpperCase() + unit[1].slice(1)}</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.long}>
                <th scope="row">{d.long}</th>
                <td>{d.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
