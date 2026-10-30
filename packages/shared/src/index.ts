export type { Database, Json } from './database.types';
export { LIMITS } from './limits';
export { ASSOCIATION_PROMPTS, ASSUMPTION_PROMPTS } from './prompts';
export {
  keepTitle,
  keywordCandidates,
  setupKeywords,
  suggestKeepTitle,
  suggestTitle,
  uniqueTitle,
  type KeywordCandidate,
  type KeywordInput,
} from './keywords';
export {
  DEFAULT_INCLUDE,
  formatNoteBody,
  formatNoteDate,
  isTimeZone,
  noteText,
  parseInclude,
  type IncludeOptions,
  type NoteJoke,
  type NoteOptions,
} from './note';
export { MINE_STEPS, isMineStep, selectedWordIndexes, setupWords, toggleConnectorWord, type MineStepKey } from './mine';

import type { Database } from './database.types';

type Tables = Database['public']['Tables'];
export type Profile = Tables['profiles']['Row'];
export type Topic = Tables['topics']['Row'];
export type Association = Tables['associations']['Row'];
export type Setup = Tables['setups']['Row'];
export type Assumption = Tables['assumptions']['Row'];
export type JokeAttempt = Tables['joke_attempts']['Row'];
export type Reinterpretation = Tables['reinterpretations']['Row'];
export type Joke = Tables['jokes']['Row'];
export type Publication = Tables['publications']['Row'];
export type SearchResult = Database['public']['Functions']['search_all']['Returns'][number];
export type AttemptStep = Database['public']['Enums']['attempt_step'];
export type TopicStats = Database['public']['Views']['topic_stats']['Row'];
export type DraftRow = Database['public']['Views']['drafts_feed']['Row'];

/** Where "Resume digging" takes the user. Stored in profiles.last_location. */
export interface LastLocation {
  route: string;
  label: string;
  at: string;
}
