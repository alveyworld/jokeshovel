/** Text limits. Keep in sync with the CHECK constraints in supabase/migrations. */
export const LIMITS = {
  topicTitle: 120,
  topicDescription: 2000,
  notes: 10000,
  association: 200,
  setup: 1000,
  displayName: 80,
} as const;
