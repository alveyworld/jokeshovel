-- The Joke Shovel — Phase 2: the guided Joke Mine.
-- Assumptions (per setup), joke attempts (one path from a setup towards a
-- punch), and reinterpretations (per attempt). See docs/DESIGN.md §7.3.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.attempt_status as enum ('in_progress', 'completed', 'abandoned', 'archived');
create type public.attempt_step as enum (
  'target', 'connector', 'reinterpretations', 'choose', 'second_story', 'punch', 'review'
);

-- ---------------------------------------------------------------------------
-- touch_topic_activity: now also handles tables that reach their topic
-- through a parent (assumptions → setups, reinterpretations → joke_attempts).
-- ---------------------------------------------------------------------------
create or replace function public.touch_topic_activity()
returns trigger
language plpgsql
as $$
declare
  rec jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  target_topic uuid;
begin
  if tg_table_name = 'assumptions' then
    select s.topic_id into target_topic from public.setups s where s.id = (rec ->> 'setup_id')::uuid;
  elsif tg_table_name = 'reinterpretations' then
    select a.topic_id into target_topic from public.joke_attempts a where a.id = (rec ->> 'attempt_id')::uuid;
  else
    target_topic := (rec ->> 'topic_id')::uuid;
  end if;

  if target_topic is not null then
    update public.topics set last_activity_at = now() where id = target_topic;
  end if;
  return null;
end;
$$;

-- setups need unique (id, user_id) already (Phase 1); assumptions and
-- joke_attempts reference it.

-- ---------------------------------------------------------------------------
-- assumptions: what the audience takes for granted after hearing a setup.
-- They belong to the setup; each attempt targets one of them.
-- ---------------------------------------------------------------------------
create table public.assumptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid(),
  setup_id   uuid not null,
  text       text not null check (char_length(btrim(text)) between 1 and 300),
  sort_order double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, user_id),
  foreign key (setup_id, user_id) references public.setups (id, user_id) on delete cascade
);

create index assumptions_setup_idx on public.assumptions (setup_id, sort_order) where deleted_at is null;
create index assumptions_user_idx on public.assumptions (user_id);

create trigger assumptions_set_updated_at
  before update on public.assumptions
  for each row execute function public.set_updated_at();
create trigger assumptions_touch_topic
  after insert or update or delete on public.assumptions
  for each row execute function public.touch_topic_activity();

-- ---------------------------------------------------------------------------
-- joke_attempts: one dig from a setup towards a punch.
-- ---------------------------------------------------------------------------
create table public.joke_attempts (
  id                           uuid primary key default gen_random_uuid(),
  user_id                      uuid not null default auth.uid(),
  setup_id                     uuid not null,
  -- Denormalised for stats; always copied from the setup by a trigger.
  topic_id                     uuid not null,
  status                       public.attempt_status not null default 'in_progress',
  current_step                 public.attempt_step not null default 'target',
  target_assumption_id         uuid,
  connector                    text not null default '' check (char_length(connector) <= 200),
  connector_note               text not null default '' check (char_length(connector_note) <= 2000),
  selected_reinterpretation_id uuid,
  second_story                 text not null default '' check (char_length(second_story) <= 4000),
  punch                        text not null default '' check (char_length(punch) <= 1000),
  notes                        text not null default '' check (char_length(notes) <= 10000),
  started_at                   timestamptz not null default now(),
  last_step_at                 timestamptz not null default now(),
  completed_at                 timestamptz,
  created_at                   timestamptz not null default now(),
  updated_at                   timestamptz not null default now(),
  deleted_at                   timestamptz,
  unique (id, user_id),
  foreign key (setup_id, user_id) references public.setups (id, user_id) on delete cascade,
  foreign key (topic_id, user_id) references public.topics (id, user_id) on delete cascade,
  foreign key (target_assumption_id, user_id)
    references public.assumptions (id, user_id) on delete set null (target_assumption_id)
);

create index joke_attempts_user_status_idx
  on public.joke_attempts (user_id, status, updated_at desc) where deleted_at is null;
create index joke_attempts_setup_idx on public.joke_attempts (setup_id) where deleted_at is null;
create index joke_attempts_topic_idx on public.joke_attempts (topic_id, status) where deleted_at is null;
create index joke_attempts_target_idx on public.joke_attempts (target_assumption_id);

-- ---------------------------------------------------------------------------
-- reinterpretations: other ways to read the connector, brainstormed per attempt.
-- ---------------------------------------------------------------------------
create table public.reinterpretations (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid(),
  attempt_id uuid not null,
  text       text not null check (char_length(btrim(text)) between 1 and 300),
  is_starred boolean not null default false,
  sort_order double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, user_id),
  foreign key (attempt_id, user_id) references public.joke_attempts (id, user_id) on delete cascade
);

create index reinterpretations_attempt_idx
  on public.reinterpretations (attempt_id, sort_order) where deleted_at is null;
create index reinterpretations_user_idx on public.reinterpretations (user_id);

alter table public.joke_attempts
  add constraint joke_attempts_selected_reinterpretation_fkey
  foreign key (selected_reinterpretation_id, user_id)
  references public.reinterpretations (id, user_id) on delete set null (selected_reinterpretation_id);
create index joke_attempts_selected_idx on public.joke_attempts (selected_reinterpretation_id);

create trigger reinterpretations_set_updated_at
  before update on public.reinterpretations
  for each row execute function public.set_updated_at();
create trigger reinterpretations_touch_topic
  after insert or update or delete on public.reinterpretations
  for each row execute function public.touch_topic_activity();

-- ---------------------------------------------------------------------------
-- Keep an attempt consistent: topic copied from its setup; the target must be
-- one of the setup's assumptions; the chosen reinterpretation must be one of
-- the attempt's own.
-- ---------------------------------------------------------------------------
create or replace function public.check_joke_attempt()
returns trigger
language plpgsql
as $$
begin
  select s.topic_id into new.topic_id from public.setups s where s.id = new.setup_id;

  if new.target_assumption_id is not null and not exists (
    select 1 from public.assumptions a
     where a.id = new.target_assumption_id and a.setup_id = new.setup_id
  ) then
    raise exception 'target assumption must belong to the attempt''s setup'
      using errcode = 'check_violation';
  end if;

  if new.selected_reinterpretation_id is not null and not exists (
    select 1 from public.reinterpretations r
     where r.id = new.selected_reinterpretation_id and r.attempt_id = new.id
  ) then
    raise exception 'selected reinterpretation must belong to this attempt'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger joke_attempts_check
  before insert or update on public.joke_attempts
  for each row execute function public.check_joke_attempt();
create trigger joke_attempts_set_updated_at
  before update on public.joke_attempts
  for each row execute function public.set_updated_at();
create trigger joke_attempts_touch_topic
  after insert or update or delete on public.joke_attempts
  for each row execute function public.touch_topic_activity();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.assumptions       enable row level security;
alter table public.joke_attempts     enable row level security;
alter table public.reinterpretations enable row level security;

create policy "own assumptions" on public.assumptions
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "own joke attempts" on public.joke_attempts
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "own reinterpretations" on public.reinterpretations
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- topic_stats v2: adds unfinished joke attempts (new columns go last so the
-- view can be replaced in place).
-- ---------------------------------------------------------------------------
create or replace view public.topic_stats
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
    where s.topic_id = t.id and s.deleted_at is null and s.status = 'active')::int as setup_count,
  (select count(*) from public.joke_attempts j
    where j.topic_id = t.id and j.deleted_at is null and j.status = 'in_progress')::int as unfinished_attempt_count
from public.topics t
where t.deleted_at is null;

-- ---------------------------------------------------------------------------
-- drafts_feed: unfinished attempts across all topics, newest first, with the
-- context needed to resume (Drafts tab, Home "Open shafts").
-- ---------------------------------------------------------------------------
create view public.drafts_feed
with (security_invoker = true) as
select
  j.id as attempt_id,
  j.user_id,
  j.topic_id,
  t.title as topic_title,
  j.setup_id,
  s.text as setup_text,
  j.current_step,
  a.text as target_text,
  j.updated_at,
  j.last_step_at
from public.joke_attempts j
join public.setups s on s.id = j.setup_id and s.deleted_at is null
join public.topics t on t.id = j.topic_id and t.deleted_at is null
left join public.assumptions a on a.id = j.target_assumption_id and a.deleted_at is null
where j.deleted_at is null and j.status = 'in_progress';

grant select on public.topic_stats, public.drafts_feed to authenticated;
revoke all on public.assumptions, public.joke_attempts, public.reinterpretations, public.drafts_feed from anon;
