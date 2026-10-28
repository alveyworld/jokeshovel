import type { Assumption, Association, JokeAttempt, Reinterpretation, Setup, Topic } from '@jokeshovel/shared';
import type { PendingOp } from '../lib/outbox/outbox';

/** A topic plus its counts, as shown on cards. Mirrors the topic_stats view. */
export interface TopicSummary {
  id: string;
  title: string;
  description: string;
  status: 'active' | 'archived';
  is_favorite: boolean;
  last_activity_at: string;
  association_count: number;
  setup_count: number;
  unfinished_attempt_count: number;
  deleted_at?: string | null;
}

// Builders for rows that exist locally but haven't reached the server yet.
// Defaults mirror the column defaults in the Phase 1 migration.

export function newTopicRow(op: PendingOp, userId: string): Topic {
  return {
    id: op.id,
    user_id: userId,
    title: '',
    description: '',
    notes: '',
    status: 'active',
    is_favorite: false,
    last_activity_at: op.queuedAt,
    created_at: op.queuedAt,
    updated_at: op.queuedAt,
    archived_at: null,
    deleted_at: null,
    ...op.values,
  } as Topic;
}

export function newSummaryRow(op: PendingOp): TopicSummary {
  return {
    title: '',
    description: '',
    status: 'active',
    is_favorite: false,
    association_count: 0,
    setup_count: 0,
    unfinished_attempt_count: 0,
    last_activity_at: op.queuedAt,
    ...op.values,
    id: op.id,
  } as TopicSummary;
}

export function newAssociationRow(op: PendingOp, userId: string): Association {
  return {
    id: op.id,
    user_id: userId,
    topic_id: '',
    text: '',
    sort_order: 0,
    is_starred: false,
    created_at: op.queuedAt,
    updated_at: op.queuedAt,
    deleted_at: null,
    ...op.values,
  } as Association;
}

export function newSetupRow(op: PendingOp, userId: string): Setup {
  return {
    id: op.id,
    user_id: userId,
    topic_id: '',
    parent_setup_id: null,
    text: '',
    notes: '',
    status: 'active',
    is_favorite: false,
    sort_order: 0,
    created_at: op.queuedAt,
    updated_at: op.queuedAt,
    archived_at: null,
    deleted_at: null,
    ...op.values,
  } as Setup;
}

export function newAssumptionRow(op: PendingOp, userId: string): Assumption {
  return {
    id: op.id,
    user_id: userId,
    setup_id: '',
    text: '',
    sort_order: 0,
    created_at: op.queuedAt,
    updated_at: op.queuedAt,
    deleted_at: null,
    ...op.values,
  } as Assumption;
}

export function newAttemptRow(op: PendingOp, userId: string): JokeAttempt {
  return {
    id: op.id,
    user_id: userId,
    setup_id: '',
    topic_id: '',
    status: 'in_progress',
    current_step: 'target',
    target_assumption_id: null,
    connector: '',
    connector_note: '',
    selected_reinterpretation_id: null,
    second_story: '',
    punch: '',
    notes: '',
    started_at: op.queuedAt,
    last_step_at: op.queuedAt,
    completed_at: null,
    created_at: op.queuedAt,
    updated_at: op.queuedAt,
    deleted_at: null,
    ...op.values,
  } as JokeAttempt;
}

export function newReinterpretationRow(op: PendingOp, userId: string): Reinterpretation {
  return {
    id: op.id,
    user_id: userId,
    attempt_id: '',
    text: '',
    is_starred: false,
    sort_order: 0,
    created_at: op.queuedAt,
    updated_at: op.queuedAt,
    deleted_at: null,
    ...op.values,
  } as Reinterpretation;
}

/** Child tables: the column that links each row to the list it appears in. */
export const LIST_PARENT = {
  associations: 'topic_id',
  setups: 'topic_id',
  assumptions: 'setup_id',
  joke_attempts: 'setup_id',
  reinterpretations: 'attempt_id',
} as const;

export const LIST_BUILDERS = {
  associations: newAssociationRow,
  setups: newSetupRow,
  assumptions: newAssumptionRow,
  joke_attempts: newAttemptRow,
  reinterpretations: newReinterpretationRow,
} as const;

/** Query-key names for single-row caches, e.g. ['joke_attempt', id]. */
export const SINGLE_KEY = {
  topics: 'topics',
  setups: 'setup',
  joke_attempts: 'joke_attempt',
} as const;

export const SINGLE_BUILDERS = {
  topics: newTopicRow,
  setups: newSetupRow,
  joke_attempts: newAttemptRow,
} as const;

/** Fractional ordering: a value after every existing item. */
export function nextSortOrder(items: readonly { sort_order: number }[]): number {
  return items.reduce((max, item) => Math.max(max, item.sort_order), 0) + 1;
}

/** Fractional ordering: a value between two neighbours. */
export function between(before: number | undefined, after: number | undefined): number {
  if (before === undefined && after === undefined) return 1;
  if (before === undefined) return after! - 1;
  if (after === undefined) return before + 1;
  return (before + after) / 2;
}
