-- The Joke Shovel — Phase 3: completed jokes, search and statistics.
-- See docs/DESIGN.md §7.3 (jokes), §7.6 (statistics) and §13 (Phase 3).

create extension if not exists pg_trgm with schema extensions;

create type public.joke_status as enum ('complete', 'archived');

-- ---------------------------------------------------------------------------
-- jokes: the comedian's collection. A snapshot of a finished attempt that can
-- be polished, rated and tagged without rewriting how it was dug.
-- ---------------------------------------------------------------------------
create table public.jokes (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null default auth.uid(),
  topic_id               uuid not null,
  setup_id               uuid,
  attempt_id             uuid unique,
  title                  text not null default '' check (char_length(title) <= 120),
  setup_text             text not null check (char_length(btrim(setup_text)) between 1 and 1000),
  punch_text             text not null check (char_length(btrim(punch_text)) between 1 and 1000),
  target_assumption_text text not null default '' check (char_length(target_assumption_text) <= 300),
  connector_text         text not null default '' check (char_length(connector_text) <= 200),
  reinterpretation_text  text not null default '' check (char_length(reinterpretation_text) <= 300),
  second_story_text      text not null default '' check (char_length(second_story_text) <= 4000),
  notes                  text not null default '' check (char_length(notes) <= 10000),
  status                 public.joke_status not null default 'complete',
  is_favorite            boolean not null default false,
  rating                 smallint check (rating between 1 and 5),
  completed_at           timestamptz not null default now(),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  archived_at            timestamptz,
  deleted_at             timestamptz,
  unique (id, user_id),
  foreign key (topic_id, user_id) references public.topics (id, user_id) on delete cascade,
  foreign key (setup_id, user_id) references public.setups (id, user_id) on delete set null (setup_id),
  foreign key (attempt_id, user_id) references public.joke_attempts (id, user_id) on delete set null (attempt_id)
);

create index jokes_user_status_idx on public.jokes (user_id, status, completed_at desc) where deleted_at is null;
create index jokes_topic_idx on public.jokes (topic_id) where deleted_at is null;
create index jokes_setup_idx on public.jokes (setup_id);

create trigger jokes_set_updated_at
  before update on public.jokes
  for each row execute function public.set_updated_at();
create trigger jokes_touch_topic
  after insert or update or delete on public.jokes
  for each row execute function public.touch_topic_activity();

alter table public.jokes enable row level security;
create policy "own jokes" on public.jokes
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
revoke all on public.jokes from anon;

-- ---------------------------------------------------------------------------
-- Trigram indexes for search (typo-tolerant, also used by ILIKE).
-- ---------------------------------------------------------------------------
create index jokes_setup_trgm on public.jokes using gin (setup_text extensions.gin_trgm_ops);
create index jokes_punch_trgm on public.jokes using gin (punch_text extensions.gin_trgm_ops);
create index jokes_title_trgm on public.jokes using gin (title extensions.gin_trgm_ops);
create index setups_text_trgm on public.setups using gin (text extensions.gin_trgm_ops);
create index topics_title_trgm on public.topics using gin (title extensions.gin_trgm_ops);
create index associations_text_trgm on public.associations using gin (text extensions.gin_trgm_ops);
create index joke_attempts_punch_trgm on public.joke_attempts using gin (punch extensions.gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- complete_attempt: turns a joke attempt into a completed joke in one
-- transaction. Idempotent: completing the same attempt again returns the
-- joke it already produced. Runs as the caller, so RLS applies throughout.
-- ---------------------------------------------------------------------------
create or replace function public.complete_attempt(p_attempt_id uuid, p_title text default null)
returns public.jokes
language plpgsql
security invoker
set search_path = ''
as $$
declare
  a public.joke_attempts;
  s public.setups;
  result public.jokes;
begin
  select * into a from public.joke_attempts
   where id = p_attempt_id and deleted_at is null
   for update;
  if not found then
    raise exception 'joke attempt not found' using errcode = 'no_data_found';
  end if;

  select * into result from public.jokes where attempt_id = a.id;
  if found then
    return result;
  end if;

  select * into s from public.setups where id = a.setup_id;
  if s.text is null or btrim(s.text) = '' then
    raise exception 'write a setup before completing the joke' using errcode = 'check_violation';
  end if;
  if btrim(a.punch) = '' then
    raise exception 'write a punch before completing the joke' using errcode = 'check_violation';
  end if;

  insert into public.jokes (
    user_id, topic_id, setup_id, attempt_id, title, setup_text, punch_text,
    target_assumption_text, connector_text, reinterpretation_text, second_story_text
  )
  values (
    a.user_id, a.topic_id, a.setup_id, a.id,
    left(btrim(coalesce(p_title, '')), 120),
    btrim(s.text), btrim(a.punch),
    coalesce((select x.text from public.assumptions x
               where x.id = a.target_assumption_id and x.deleted_at is null), ''),
    btrim(a.connector),
    coalesce((select r.text from public.reinterpretations r
               where r.id = a.selected_reinterpretation_id and r.deleted_at is null), ''),
    btrim(a.second_story)
  )
  returning * into result;

  update public.joke_attempts
     set status = 'completed', completed_at = now(), current_step = 'review'
   where id = a.id;

  return result;
end;
$$;

grant execute on function public.complete_attempt(uuid, text) to authenticated;
revoke execute on function public.complete_attempt(uuid, text) from anon, public;

-- ---------------------------------------------------------------------------
-- search_all: one search box over jokes, drafts, setups, topics and
-- associations. Matches substrings and near-misses ("layovr" finds
-- "layover"); runs as the caller, so it only ever sees the caller's rows.
-- ---------------------------------------------------------------------------
create or replace function public.search_all(q text)
returns table (
  kind text,
  id uuid,
  topic_id uuid,
  topic_title text,
  title text,
  snippet text,
  score real
)
language sql
stable
security invoker
set search_path = public, extensions
set pg_trgm.word_similarity_threshold = 0.45
as $$
  with term as (select lower(btrim(q)) as t)
  select * from (
    select 'joke'::text, j.id, j.topic_id, tp.title, j.title,
           j.setup_text || ' — ' || j.punch_text,
           greatest(word_similarity(term.t, j.setup_text), word_similarity(term.t, j.punch_text),
                    word_similarity(term.t, j.title))
      from jokes j
      join topics tp on tp.id = j.topic_id and tp.deleted_at is null
     cross join term
     where j.deleted_at is null
       and (term.t <% j.setup_text or term.t <% j.punch_text or term.t <% j.title)
    union all
    select 'draft', ja.id, ja.topic_id, tp.title, s.text, ja.punch,
           greatest(word_similarity(term.t, ja.punch), word_similarity(term.t, s.text))
      from joke_attempts ja
      join setups s on s.id = ja.setup_id and s.deleted_at is null
      join topics tp on tp.id = ja.topic_id and tp.deleted_at is null
     cross join term
     where ja.deleted_at is null and ja.status = 'in_progress' and ja.punch <> ''
       and term.t <% ja.punch
    union all
    select 'setup', s.id, s.topic_id, tp.title, s.text, '', word_similarity(term.t, s.text)
      from setups s
      join topics tp on tp.id = s.topic_id and tp.deleted_at is null
     cross join term
     where s.deleted_at is null and term.t <% s.text
    union all
    select 'topic', tp.id, tp.id, tp.title, tp.title, tp.description, word_similarity(term.t, tp.title)
      from topics tp
     cross join term
     where tp.deleted_at is null and term.t <% tp.title
    union all
    select 'association', a.id, a.topic_id, tp.title, a.text, '', word_similarity(term.t, a.text)
      from associations a
      join topics tp on tp.id = a.topic_id and tp.deleted_at is null
     cross join term
     where a.deleted_at is null and term.t <% a.text
  ) results (kind, id, topic_id, topic_title, title, snippet, score)
  where char_length((select t from term)) >= 2
  order by score desc, title
  limit 60;
$$;

grant execute on function public.search_all(text) to authenticated;
revoke execute on function public.search_all(text) from anon, public;

-- ---------------------------------------------------------------------------
-- topic_stats v3: completed jokes and completion % (docs/DESIGN.md §7.6).
-- Completion = setups that produced at least one completed joke ÷ active
-- setups; null when there are no setups (shown as "—").
-- ---------------------------------------------------------------------------
create or replace view public.topic_stats
with (security_invoker = true) as
select
  base.*,
  case when base.setup_count = 0 then null
       else round(100.0 * base.setups_with_joke_count / base.setup_count)::int
  end as completion_percent
from (
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
      where j.topic_id = t.id and j.deleted_at is null and j.status = 'in_progress')::int as unfinished_attempt_count,
    (select count(*) from public.jokes k
      where k.topic_id = t.id and k.deleted_at is null and k.status = 'complete')::int as completed_joke_count,
    (select count(*) from public.setups s
      where s.topic_id = t.id and s.deleted_at is null and s.status = 'active'
        and exists (select 1 from public.jokes k
                     where k.setup_id = s.id and k.deleted_at is null))::int as setups_with_joke_count
  from public.topics t
  where t.deleted_at is null
) base;

grant select on public.topic_stats to authenticated;
