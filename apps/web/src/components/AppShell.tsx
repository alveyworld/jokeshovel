import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router';
import bladeIcon from '../assets/brand/icon-64.png';
import wordmarkLight from '../assets/brand/wordmark-light.png';
import { useOutbox } from '../data/OutboxProvider';
import { useSaveState } from '../data/hooks';
import { usePreferences } from '../data/preferences';
import { applyPreferences } from '../lib/preferences';
import { shortcutFor, shortcutTarget } from '../lib/shortcuts';
import { QuickSwitcher } from './QuickSwitcher';
import { SaveIndicator } from './SaveIndicator';
import { ShortcutHelp } from './ShortcutHelp';
import { useToast } from './Toasts';

const NAV = [
  { to: '/', label: 'Home', icon: '⛏', end: true },
  { to: '/topics', label: 'Topics', icon: '⛰', end: false },
  { to: '/drafts', label: 'Drafts', icon: '✎', end: false },
  { to: '/jokes', label: 'Jokes', icon: '◆', end: false },
];

const SEARCH_ICON = (
  <svg
    viewBox="0 0 24 24"
    width="22"
    height="22"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
  >
    <circle cx="10" cy="10" r="6.5" />
    <path d="M15 15l6 6" />
  </svg>
);

const TOOLS = [
  { to: '/search', label: 'Search', icon: SEARCH_ICON },
  { to: '/settings', label: 'Settings', icon: '⚙' },
];

export function AppShell() {
  const box = useOutbox();
  const snapshot = useSaveState();
  const { prefs } = usePreferences();
  const { undoLast } = useToast();
  const navigate = useNavigate();
  const [panel, setPanel] = useState<'switcher' | 'help' | null>(null);

  useEffect(() => applyPreferences(prefs), [prefs]);

  // Global shortcuts (src/lib/shortcuts.ts). Skipped while any dialog is open.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (document.querySelector('dialog[open]')) return;
      const action = shortcutFor(e, prefs.shortcuts);
      if (!action) return;
      if (action === 'undo') {
        if (undoLast()) e.preventDefault();
        return;
      }
      e.preventDefault();
      if (action === 'switcher') setPanel('switcher');
      else if (action === 'help') setPanel('help');
      else if (action === 'search') navigate('/search');
      else {
        const target = shortcutTarget(action);
        if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) target.focus();
        else target?.click();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [prefs.shortcuts, undoLast, navigate]);

  return (
    <div className="shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="topbar">
        <NavLink to="/" className="brand">
          <img src={bladeIcon} alt="" className="brand__icon" width={36} height={36} />
          <img src={wordmarkLight} alt="The Joke Shovel" className="brand__wordmark" width={54} height={34} />
        </NavLink>
        <SaveIndicator snapshot={snapshot} onRetry={() => box.retryNow()} />
        <nav aria-label="Tools" className="topbar__tools">
          <button
            type="button"
            className="topbar__tool"
            title="Quick switcher (⌘K)"
            onClick={() => setPanel('switcher')}
          >
            <span aria-hidden="true">⇄</span>
            <span className="visually-hidden">Quick switcher</span>
          </button>
          {TOOLS.map((item) => (
            <NavLink key={item.to} to={item.to} className="topbar__tool" title={item.label}>
              <span aria-hidden="true">{item.icon}</span>
              <span className="visually-hidden">{item.label}</span>
            </NavLink>
          ))}
        </nav>
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
      <main id="main" className="main paper" tabIndex={-1}>
        <Outlet />
      </main>
      {panel === 'switcher' ? <QuickSwitcher onClose={() => setPanel(null)} /> : null}
      {panel === 'help' ? <ShortcutHelp singleKeys={prefs.shortcuts} onClose={() => setPanel(null)} /> : null}
    </div>
  );
}
