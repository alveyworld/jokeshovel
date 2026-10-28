import type { Association, Setup, Topic } from '@jokeshovel/shared';
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
