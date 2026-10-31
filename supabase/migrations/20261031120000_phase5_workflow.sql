-- The Joke Shovel — Phase 5: tags, branching setups, the Trash purge and
-- account deletion. See docs/DESIGN.md §7.3 (tags), §7.7 (Trash), §11 and §13.

-- ---------------------------------------------------------------------------
-- tags: a user's own labels for topics and jokes ("Opener", "Clean set").
-- Names are unique per user, ignoring case.
-- ---------------------------------------------------------------------------
create table public.tags (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name       text not null check (char_length(btrim(name)) between 1 and 40),
  color      text check (color ~ '^#[0-9a-fA-F]{6}$'),
  created_at timestamptz not null default now(),
  unique (id, user_id)
);
create unique index tags_user_name_idx on public.tags (user_id, lower(name));

create table public.topic_tags (
  topic_id uuid not null,
  tag_id   uuid not null,
  user_id  uuid not null default auth.uid(),
  primary key (topic_id, tag_id),
  foreign key (topic_id, user_id) references public.topics (id, user_id) on delete cascade,
  foreign key (tag_id, user_id) references public.tags (id, user_id) on delete cascade
);
create index topic_tags_tag_idx on public.topic_tags (tag_id);

create table public.joke_tags (
  joke_id uuid not null,
  tag_id  uuid not null,
  user_id uuid not null default auth.uid(),
  primary key (joke_id, tag_id),
  foreign key (joke_id, user_id) references public.jokes (id, user_id) on delete cascade,
  foreign key (tag_id, user_id) references public.tags (id, user_id) on delete cascade
);
create index joke_tags_tag_idx on public.joke_tags (tag_id);

alter table public.tags enable row level security;
alter table public.topic_tags enable row level security;
alter table public.joke_tags enable row level security;
create policy "own tags" on public.tags
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own topic tags" on public.topic_tags
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own joke tags" on public.joke_tags
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.tags, public.topic_tags, public.joke_tags from anon;

-- ---------------------------------------------------------------------------
-- set_*_tags: replace an item's tags with these names in one call, creating
-- tags that don't exist yet. Whitespace is tidied and case-insensitive
-- duplicates are merged; the first spelling wins. Runs as the caller (RLS).
-- ---------------------------------------------------------------------------
create or replace function public.clean_tag_names(p_names text[])
returns text[]
language sql
immutable
set search_path = ''
as $$
  select coalesce(array_agg(n order by ord), '{}')
  from (
    select distinct on (lower(n)) n, ord
    from (
      select btrim(regexp_replace(x, '\s+', ' ', 'g')) as n, ord
      from unnest(coalesce(p_names, '{}')) with ordinality as u(x, ord)
    ) cleaned
    where n <> ''
    order by lower(n), ord
  ) unique_names;
$$;

create or replace function public.ensure_tags(p_names text[])
returns setof public.tags
language plpgsql
security invoker
set search_path = ''
as $$
declare
  names text[] := public.clean_tag_names(p_names);
begin
  if cardinality(names) > 20 then
    raise exception 'at most 20 tags' using errcode = 'check_violation';
  end if;
  insert into public.tags (name)
  select n from unnest(names) as n
  on conflict (user_id, (lower(name))) do nothing;
  return query
    select t.* from public.tags t
     where lower(t.name) in (select lower(n) from unnest(names) as n);
end;
$$;

create or replace function public.set_joke_tags(p_joke_id uuid, p_names text[])
returns setof public.tags
language plpgsql
security invoker
set search_path = ''
as $$
declare
  wanted uuid[];
begin
  if not exists (select 1 from public.jokes j where j.id = p_joke_id) then
    raise exception 'joke not found' using errcode = 'no_data_found';
  end if;
  select coalesce(array_agg(t.id), '{}') into wanted from public.ensure_tags(p_names) t;
  delete from public.joke_tags jt where jt.joke_id = p_joke_id and not (jt.tag_id = any (wanted));
  insert into public.joke_tags (joke_id, tag_id)
  select p_joke_id, id from unnest(wanted) as id
  on conflict do nothing;
  return query
    select t.* from public.tags t join public.joke_tags jt on jt.tag_id = t.id
     where jt.joke_id = p_joke_id
     order by lower(t.name);
end;
$$;

create or replace function public.set_topic_tags(p_topic_id uuid, p_names text[])
returns setof public.tags
language plpgsql
security invoker
set search_path = ''
as $$
declare
  wanted uuid[];
begin
  if not exists (select 1 from public.topics tp where tp.id = p_topic_id) then
    raise exception 'topic not found' using errcode = 'no_data_found';
  end if;
  select coalesce(array_agg(t.id), '{}') into wanted from public.ensure_tags(p_names) t;
  delete from public.topic_tags tt where tt.topic_id = p_topic_id and not (tt.tag_id = any (wanted));
  insert into public.topic_tags (topic_id, tag_id)
  select p_topic_id, id from unnest(wanted) as id
  on conflict do nothing;
  return query
    select t.* from public.tags t join public.topic_tags tt on tt.tag_id = t.id
     where tt.topic_id = p_topic_id
     order by lower(t.name);
end;
$$;

grant execute on function public.ensure_tags(text[]) to authenticated;
grant execute on function public.set_joke_tags(uuid, text[]) to authenticated;
grant execute on function public.set_topic_tags(uuid, text[]) to authenticated;
revoke execute on function public.ensure_tags(text[]) from anon, public;
revoke execute on function public.set_joke_tags(uuid, text[]) from anon, public;
revoke execute on function public.set_topic_tags(uuid, text[]) from anon, public;

-- ---------------------------------------------------------------------------
-- branch_setup: a copy of a setup placed right after it, remembering where
-- it came from (parent_setup_id). A branch (the default) starts with no
-- assumptions, because changed wording changes them; a duplicate copies them.
-- ---------------------------------------------------------------------------
create or replace function public.branch_setup(p_setup_id uuid, p_copy_assumptions boolean default false)
returns public.setups
language plpgsql
security invoker
set search_path = ''
as $$
declare
  s public.setups;
  next_order double precision;
  result public.setups;
begin
  select * into s from public.setups where id = p_setup_id and deleted_at is null;
  if not found then
    raise exception 'setup not found' using errcode = 'no_data_found';
  end if;

  select min(x.sort_order) into next_order
    from public.setups x
   where x.topic_id = s.topic_id and x.deleted_at is null and x.sort_order > s.sort_order;

  insert into public.setups (topic_id, parent_setup_id, text, notes, sort_order)
  values (s.topic_id, s.id, s.text, s.notes,
          case when next_order is null then s.sort_order + 1 else (s.sort_order + next_order) / 2 end)
  returning * into result;

  if p_copy_assumptions then
    insert into public.assumptions (setup_id, text, sort_order)
    select result.id, a.text, a.sort_order
      from public.assumptions a
     where a.setup_id = s.id and a.deleted_at is null;
  end if;
  return result;
end;
$$;

grant execute on function public.branch_setup(uuid, boolean) to authenticated;
revoke execute on function public.branch_setup(uuid, boolean) from anon, public;

-- ---------------------------------------------------------------------------
-- Trash: deleted rows are kept for 30 days, then purged nightly by pg_cron.
-- Deleting a topic or setup removes everything under it (FK cascades); a
-- completed joke outlives its setup and attempt.
-- ---------------------------------------------------------------------------
create or replace function public.purge_trash(p_older_than interval default interval '30 days')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  cutoff timestamptz := now() - p_older_than;
  counts jsonb := '{}'::jsonb;
  n int;
begin
  delete from public.topics where deleted_at < cutoff;
  get diagnostics n = row_count;
  counts := counts || jsonb_build_object('topics', n);
  delete from public.setups where deleted_at < cutoff;
  get diagnostics n = row_count;
  counts := counts || jsonb_build_object('setups', n);
  delete from public.joke_attempts where deleted_at < cutoff;
  get diagnostics n = row_count;
  counts := counts || jsonb_build_object('joke_attempts', n);
  delete from public.jokes where deleted_at < cutoff;
  get diagnostics n = row_count;
  counts := counts || jsonb_build_object('jokes', n);
  delete from public.associations where deleted_at < cutoff;
  get diagnostics n = row_count;
  counts := counts || jsonb_build_object('associations', n);
  delete from public.assumptions where deleted_at < cutoff;
  get diagnostics n = row_count;
  counts := counts || jsonb_build_object('assumptions', n);
  delete from public.reinterpretations where deleted_at < cutoff;
  get diagnostics n = row_count;
  counts := counts || jsonb_build_object('reinterpretations', n);
  return counts;
end;
$$;

revoke execute on function public.purge_trash(interval) from public, anon, authenticated;

create extension if not exists pg_cron;
select cron.schedule('purge-trash', '23 3 * * *', $$select public.purge_trash()$$);

-- ---------------------------------------------------------------------------
-- delete_account: removes the caller's auth user, which cascades to every row
-- they own. Needs the exact confirmation phrase and a sign-in within the last
-- 5 minutes (the newest `amr` timestamp in the session token, which a token
-- refresh doesn't change).
-- ---------------------------------------------------------------------------
create or replace function public.delete_account(p_confirm text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  signed_in_at bigint;
begin
  if uid is null then
    raise exception 'sign in first' using errcode = 'insufficient_privilege';
  end if;
  if p_confirm is distinct from 'delete my account' then
    raise exception 'type "delete my account" to confirm' using errcode = 'invalid_parameter_value';
  end if;

  select max((e ->> 'timestamp')::bigint) into signed_in_at
    from jsonb_array_elements(coalesce(auth.jwt() -> 'amr', '[]'::jsonb)) as e;
  if signed_in_at is null or signed_in_at < extract(epoch from now()) - 300 then
    raise exception 'sign in again to confirm' using errcode = 'insufficient_privilege', hint = 'reauthenticate';
  end if;

  delete from auth.users where id = uid;
end;
$$;

grant execute on function public.delete_account(text) to authenticated;
revoke execute on function public.delete_account(text) from anon, public;
