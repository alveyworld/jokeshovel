/** Text limits. Keep in sync with the CHECK constraints in supabase/migrations. */
export const LIMITS = {
  topicTitle: 120,
  topicDescription: 2000,
  notes: 10000,
  association: 200,
  setup: 1000,
  displayName: 80,
  assumption: 300,
  connector: 200,
  connectorNote: 2000,
  reinterpretation: 300,
  secondStory: 4000,
  punch: 1000,
} as const;
