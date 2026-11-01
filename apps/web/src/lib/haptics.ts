/** A short buzz on phones that support it (Android; iOS Safari has no vibration API). */
export function haptic(ms = 15) {
  const reduce =
    document.documentElement.hasAttribute('data-reduce-motion') ||
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (!reduce) navigator.vibrate?.(ms);
}
