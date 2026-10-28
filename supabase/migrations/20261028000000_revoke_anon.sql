-- Signed-out visitors never touch app data. RLS already returns nothing to
-- `anon` (every policy is `to authenticated`), but revoking the default
-- grants makes that explicit and fails loudly instead of returning [].
revoke all on public.profiles, public.topics, public.associations, public.setups, public.topic_stats from anon;
alter default privileges in schema public revoke all on tables from anon;
