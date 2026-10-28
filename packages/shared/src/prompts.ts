/**
 * Rotating placeholder questions for the association brainstorm. They ask;
 * they never answer. Written for The Joke Shovel (not quoted from any book).
 */
export const ASSOCIATION_PROMPTS = [
  'Who would you find here?',
  'What objects can you hold?',
  'Where does it happen?',
  'What annoys you about it?',
  'What do people say about it?',
  'What does it smell or sound like?',
  'What goes wrong?',
  'What opinions do people have?',
  'What would a kid notice?',
  'What words or phrases go with it?',
] as const;

/**
 * Nudges for listing a setup's assumptions. Each chip turns the input's
 * placeholder into a question; the comedian writes the answer.
 */
export const ASSUMPTION_PROMPTS = [
  { label: 'Who?', question: 'Who does the audience assume is speaking or involved?' },
  { label: 'Where?', question: 'Where do they picture this happening?' },
  { label: 'When?', question: 'When do they assume it happens?' },
  { label: 'What’s happening?', question: 'What do they picture going on?' },
  { label: 'Why?', question: 'Why do they think it happened?' },
  { label: 'Which meaning?', question: 'What do they assume a word or phrase means?' },
] as const;
