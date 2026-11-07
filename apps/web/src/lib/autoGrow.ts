import { useEffect, useLayoutEffect, type RefObject } from 'react';

/**
 * Text boxes grow to fit their text, so nothing hides behind a scrollbar.
 * Phones can't drag a text box's corner to make it bigger, so this is the
 * only way to see everything there. Most browsers do it in CSS
 * (`field-sizing: content` in base.css); `useAutoGrow` does it for the rest.
 */
export const cssAutoGrow =
  typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports('field-sizing', 'content');

/** Sets a text box's height to fit its text, keeping the page where it was. */
export function fitToText(el: HTMLTextAreaElement) {
  const scrollY = window.scrollY;
  // No scrollbar while measuring, or its width would change the wrapping.
  el.style.overflowY = 'hidden';
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight + el.offsetHeight - el.clientHeight}px`;
  if (window.scrollY !== scrollY) window.scrollTo({ top: scrollY });
}

/** Grows the text box when its text or its width changes (browsers without field-sizing). */
export function useAutoGrow(ref: RefObject<HTMLTextAreaElement | null>, value: string, enabled = !cssAutoGrow) {
  useLayoutEffect(() => {
    if (enabled && ref.current) fitToText(ref.current);
  }, [enabled, ref, value]);

  useEffect(() => {
    const el = ref.current;
    if (!enabled || !el || typeof ResizeObserver === 'undefined') return;
    let width = el.clientWidth;
    const observer = new ResizeObserver(() => {
      if (el.clientWidth === width) return;
      width = el.clientWidth;
      fitToText(el);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [enabled, ref]);
}
