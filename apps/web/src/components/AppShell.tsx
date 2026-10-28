import { NavLink, Outlet } from 'react-router';
import { useOutbox } from '../data/OutboxProvider';
import { useSaveState } from '../data/hooks';
import { SaveIndicator } from './SaveIndicator';

const NAV = [
  { to: '/', label: 'Home', icon: '⛏', end: true },
  { to: '/topics', label: 'Topics', icon: '⛰', end: false },
  { to: '/settings', label: 'Settings', icon: '⚙', end: false },
];

export function AppShell() {
  const box = useOutbox();
  const snapshot = useSaveState();
  return (
    <div className="shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="topbar">
        <NavLink to="/" className="brand">
          <span aria-hidden="true">⛏</span> The Joke Shovel
        </NavLink>
        <SaveIndicator snapshot={snapshot} onRetry={() => box.retryNow()} />
      </header>
      <nav className="tabs" aria-label="Main">
        <ul>
          {NAV.map((item) => (
            <li key={item.to}>
              <NavLink to={item.to} end={item.end} className="tabs__link">
                <span aria-hidden="true" className="tabs__icon">
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <main id="main" className="main" tabIndex={-1}>
        <Outlet />
      </main>
    </div>
  );
}
