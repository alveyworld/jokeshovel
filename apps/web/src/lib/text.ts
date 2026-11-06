/** Shortens text to about `max` characters at a word boundary. */
export function excerpt(text: string, max = 60): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const space = cut.lastIndexOf(' ');
  return `${(space > max * 0.5 ? cut.slice(0, space) : cut).replace(/[\s,.;:!?-]+$/, '')}…`;
}

/**
 * A topic title made from an association (ASSOC-5). Associations can be longer
 * than a topic title, so long text is cut at the last whole word that fits.
 */
export function topicTitleFromText(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const endsOnWord = clean[max] === ' ';
  const space = cut.lastIndexOf(' ');
  const whole = endsOnWord ? cut : space > 0 ? cut.slice(0, space) : cut;
  return whole.replace(/[\s,;:-]+$/, '');
}

/** Whether two titles match, ignoring case and extra spaces. */
export function sameTitle(a: string, b: string): boolean {
  const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLocaleLowerCase();
  return norm(a) === norm(b);
}

export function wordCount(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}
