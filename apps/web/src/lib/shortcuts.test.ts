import { describe, expect, it } from 'vitest';
import { isTyping, shortcutFor } from './shortcuts';

const key = (k: string, extra: Partial<KeyboardEvent> = {}, target: EventTarget | null = document.body) =>
  ({
    key: k,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    defaultPrevented: false,
    isComposing: false,
    target,
    ...extra,
  }) as KeyboardEvent;

describe('shortcutFor', () => {
  it('maps the single-key shortcuts outside text fields', () => {
    expect(shortcutFor(key('?', { shiftKey: true }), true)).toBe('help');
    expect(shortcutFor(key('/'), true)).toBe('search');
    expect(shortcutFor(key('n'), true)).toBe('new');
    expect(shortcutFor(key('N', { shiftKey: true }), true)).toBe('new');
    expect(shortcutFor(key(']'), true)).toBe('next-step');
    expect(shortcutFor(key('['), true)).toBe('prev-step');
    expect(shortcutFor(key('x'), true)).toBeNull();
  });

  it('never steals keys from text fields, and single keys can be turned off (WCAG 2.1.4)', () => {
    const input = document.createElement('input');
    const textarea = document.createElement('textarea');
    expect(shortcutFor(key('n', {}, input), true)).toBeNull();
    expect(shortcutFor(key('/', {}, textarea), true)).toBeNull();
    expect(shortcutFor(key('n'), false)).toBeNull();
    const checkbox = Object.assign(document.createElement('input'), { type: 'checkbox' });
    expect(isTyping(checkbox)).toBe(false);
    expect(shortcutFor(key('n', {}, checkbox), true)).toBe('new');
  });

  it('opens the switcher with ⌘K or Ctrl-K anywhere, even when single keys are off', () => {
    const input = document.createElement('input');
    expect(shortcutFor(key('k', { metaKey: true }, input), false)).toBe('switcher');
    expect(shortcutFor(key('K', { ctrlKey: true }), false)).toBe('switcher');
  });

  it('undoes with ⌘Z only outside text fields, where the field needs its own undo', () => {
    expect(shortcutFor(key('z', { metaKey: true }), true)).toBe('undo');
    expect(shortcutFor(key('z', { ctrlKey: true }, document.createElement('textarea')), true)).toBeNull();
    expect(shortcutFor(key('z', { metaKey: true, shiftKey: true }), true)).toBeNull();
  });

  it('ignores key presses already handled or mid-composition (IME)', () => {
    expect(shortcutFor(key('n', { defaultPrevented: true }), true)).toBeNull();
    expect(shortcutFor(key('n', { isComposing: true }), true)).toBeNull();
    expect(shortcutFor(key('n', { altKey: true }), true)).toBeNull();
  });
});
