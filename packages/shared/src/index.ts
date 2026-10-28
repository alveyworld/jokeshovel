export type { Database, Json } from './database.types';
export { LIMITS } from './limits';
export { ASSOCIATION_PROMPTS } from './prompts';

import type { Database } from './database.types';

type Tables = Database['public']['Tables'];
export type Profile = Tables['profiles']['Row'];
export type Topic = Tables['topics']['Row'];
export type Association = Tables['associations']['Row'];
export type Setup = Tables['setups']['Row'];
export type TopicStats = Database['public']['Views']['topic_stats']['Row'];

/** Where "Resume digging" takes the user. Stored in profiles.last_location. */
export interface LastLocation {
  route: string;
  label: string;
  at: string;
}
