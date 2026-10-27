-- The Joke Shovel — Phase 1 schema
-- Profiles, topics, association lists, setups, and the topic statistics view.
-- Later phases add joke_attempts, assumptions, reinterpretations, jokes,
-- tags, publications and google_connections (see docs/DESIGN.md §7).

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.topic_status as enum ('active', 'archived');
create type public.setup_status as enum ('active', 'archived');

-- ---------------------------------------------------------------------------
-- Shared trigger functions
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Bumps topics.last_activity_at whenever something underneath a topic changes.
-- Runs as the invoking user, so RLS still applies to the topic update.
create or replace function public.touch_topic_activity()
returns trigger
language plpgsql
as $$
declare
  rec jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
begin
  update public.topics
     set last_activity_at = now()
   where id = (rec ->> 'topic_id')::uuid;
  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles: one row per auth user, created on sign-up
-- ---------------------------------------------------------------------------
create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  display_name  text check (char_length(display_name) <= 80),
  timezone      text not null default 'UTC',
  preferences   jsonb not null default '{}'::jsonb,
  -- "Resume digging" pointer: {"route": "/topics/<id>/setups/<id>", "at": "..."}
  last_location jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Create a profile automatically when Supabase Auth creates a user.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'), 80)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- topics
-- ---------------------------------------------------------------------------
create table public.topics (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title            text not null check (char_length(btrim(title)) between 1 and 120),
  description      text not null default '' check (char_length(description) <= 2000),
  notes            text not null default '' check (char_length(notes) <= 10000),
  status           public.topic_status not null default 'active',
  is_favorite      boolean not null default false,
  last_activity_at timestamptz not null default now(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  archived_at      timestamptz,
  deleted_at       timestamptz,
  -- Lets children use (topic_id, user_id) composite FKs so a row can never
  -- point at another user's topic.
  unique (id, user_id)
);

create index topics_user_activity_idx
  on public.topics (user_id, status, last_activity_at desc)
  where deleted_at is null;

create trigger topics_set_updated_at
  before update on public.topics
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- associations: the brainstormed association list for a topic
-- ---------------------------------------------------------------------------
create table public.associations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid(),
  topic_id    uuid not null,
  text        text not null check (char_length(btrim(text)) between 1 and 200),
  sort_order  double precision not null default 0,
  is_starred  boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  foreign key (topic_id, user_id) references public.topics (id, user_id) on delete cascade
);

create index associations_topic_idx
  on public.associations (topic_id, sort_order)
  where deleted_at is null;
create index associations_user_idx on public.associations (user_id);

create trigger associations_set_updated_at
  before update on public.associations
  for each row execute function public.set_updated_at();
create trigger associations_touch_topic
  after insert or update or delete on public.associations
  for each row execute function public.touch_topic_activity();

-- ---------------------------------------------------------------------------
-- setups
-- ---------------------------------------------------------------------------
create table public.setups (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid(),
  topic_id        uuid not null,
  -- Phase 5 "branch a setup": the setup this one was copied from.
  parent_setup_id uuid references public.setups (id) on delete set null,
  -- Empty text is allowed so a half-typed draft can be saved immediately.
  text            text not null default '' check (char_length(text) <= 1000),
  notes           text not null default '' check (char_length(notes) <= 10000),
  status          public.setup_status not null default 'active',
  is_favorite     boolean not null default false,
  sort_order      double precision not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  archived_at     timestamptz,
  deleted_at      timestamptz,
  unique (id, user_id),
  foreign key (topic_id, user_id) references public.topics (id, user_id) on delete cascade
);

create index setups_topic_idx
  on public.setups (topic_id, status, updated_at desc)
  where deleted_at is null;
create index setups_user_recent_idx
  on public.setups (user_id, updated_at desc)
  where deleted_at is null;
create index setups_parent_idx on public.setups (parent_setup_id);

create trigger setups_set_updated_at
  before update on public.setups
  for each row execute function public.set_updated_at();
create trigger setups_touch_topic
  after insert or update or delete on public.setups
  for each row execute function public.touch_topic_activity();

-- ---------------------------------------------------------------------------
-- Row Level Security: every row belongs to exactly one user.
-- ---------------------------------------------------------------------------
alter table public.profiles     enable row level security;
alter table public.topics       enable row level security;
alter table public.associations enable row level security;
alter table public.setups       enable row level security;

create policy "own profile" on public.profiles
  for all to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "own topics" on public.topics
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "own associations" on public.associations
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "own setups" on public.setups
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- topic_stats: Phase 1 subset. Phase 2–4 migrations replace this view with
-- unfinished-attempt, completed-joke, Keep-published and completion columns.
-- security_invoker makes the view obey the caller's RLS.
-- ---------------------------------------------------------------------------
create view public.topic_stats
with (security_invoker = true) as
select
  t.id as topic_id,
  t.user_id,
  t.title,
  t.description,
  t.status,
  t.is_favorite,
  t.last_activity_at,
  (select count(*) from public.associations a
    where a.topic_id = t.id and a.deleted_at is null)::int as association_count,
  (select count(*) from public.setups s
    where s.topic_id = t.id and s.deleted_at is null and s.status = 'active')::int as setup_count
from public.topics t
where t.deleted_at is null;

grant select on public.topic_stats to authenticated;
