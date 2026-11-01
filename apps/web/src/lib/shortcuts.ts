/**
 * Keyboard shortcuts (NAV-3, docs/DESIGN.md §12). Shortcuts with ⌘/Ctrl work
 * everywhere; single-key ones only fire outside text fields and can be turned
 * off in Settings (WCAG 2.1.4).
 */

export type ShortcutAction = 'switcher' | 'undo' | 'help' | 'search' | 'new' | 'next-step' | 'prev-step';

export interface ShortcutHelp {
  keys: string[];
  label: string;
  /** Uses ⌘/Ctrl, so it works in text fields and when single keys are off. */
  modifier?: boolean;
}

export const SHORTCUT_HELP: ShortcutHelp[] = [
  { keys: ['⌘ K', 'Ctrl K'], label: 'Open the quick switcher', modifier: true },
  { keys: ['/'], label: 'Search everything' },
  { keys: ['N'], label: 'Add a new item on this screen (topic, association, setup, assumption…)' },
  { keys: [']'], label: 'Next step in the Joke Mine' },
  { keys: ['['], label: 'Previous step in the Joke Mine' },
  { keys: ['?'], label: 'Show these shortcuts' },
  { keys: ['⌘ Z', 'Ctrl Z'], label: 'Undo the last delete (outside text fields)', modifier: true },
  { keys: ['Esc'], label: 'Close a sheet or dialog', modifier: true },
];

const NON_TEXT_INPUTS = new Set(['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color', 'file', 'image']);

/** True while focus is somewhere you type, so single keys must reach the field. */
export function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true;
  if (target instanceof HTMLInputElement) return !NON_TEXT_INPUTS.has(target.type);
  return false;
}

type KeyInfo = Pick<
  KeyboardEvent,
  'key' | 'metaKey' | 'ctrlKey' | 'altKey' | 'shiftKey' | 'target' | 'defaultPrevented' | 'isComposing'
>;

/** What a key press means, if anything. */
export function shortcutFor(e: KeyInfo, singleKeys: boolean): ShortcutAction | null {
  if (e.defaultPrevented || e.isComposing) return null;
  const mod = e.metaKey || e.ctrlKey;
  const key = e.key.toLowerCase();
  if (mod && !e.altKey && key === 'k') return 'switcher';
  if (mod && !e.altKey && !e.shiftKey && key === 'z') return isTyping(e.target) ? null : 'undo';
  if (mod || e.altKey || !singleKeys || isTyping(e.target)) return null;
  switch (e.key) {
    case '?':
      return 'help';
    case '/':
      return 'search';
    case 'n':
    case 'N':
      return 'new';
    case ']':
      return 'next-step';
    case '[':
      return 'prev-step';
    default:
      return null;
  }
}

/** The first visible element on the page marked data-shortcut="…". */
export function shortcutTarget(name: string, root: ParentNode = document): HTMLElement | null {
  for (const el of root.querySelectorAll<HTMLElement>(`[data-shortcut="${name}"]`)) {
    if (el.offsetParent !== null || el.getClientRects().length) return el;
  }
  return null;
}
