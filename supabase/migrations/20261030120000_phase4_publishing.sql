-- The Joke Shovel — Phase 4: publishing jokes to Google Keep (share sheet or
-- copy and open) and, behind a flag, to a Google Docs "Joke Book".
-- See docs/DESIGN.md §7.3 (publications, google_connections), §7.6 and §9.

create type public.publication_destination as enum ('google_keep', 'google_docs', 'markdown');
create type public.publication_method as enum ('share_sheet', 'copy_open', 'docs_api', 'download');
create type public.publication_status as enum ('pending', 'succeeded', 'failed', 'user_confirmed', 'cancelled');
create type public.google_connection_status as enum ('active', 'revoked', 'error');

-- ---------------------------------------------------------------------------
-- publications: every attempt to send a joke somewhere, with exactly what was
-- sent. Readable by the owner; written only through the functions below
-- (share sheet, copy and open) or by the Worker with the service role (Docs).
-- ---------------------------------------------------------------------------
create table public.publications (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid(),
  joke_id           uuid not null,
  client_request_id uuid not null,
  destination       public.publication_destination not null,
  method            public.publication_method not null,
  status            public.publication_status not null default 'pending',
  title             text not null check (char_length(btrim(title)) between 1 and 200),
  body              text not null check (char_length(body) <= 20000),
  include_options   jsonb not null default '{}'::jsonb check (octet_length(include_options::text) <= 2000),
  external_id       text,
  external_url      text,
  error_code        text,
  error_message     text,
  attempt_count     int not null default 1,
  requested_at      timestamptz not null default now(),
  completed_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (user_id, client_request_id),
  foreign key (joke_id, user_id) references public.jokes (id, user_id) on delete cascade,
  check (
    (destination = 'google_keep' and method in ('share_sheet', 'copy_open'))
    or (destination = 'google_docs' and method = 'docs_api')
    or (destination = 'markdown' and method = 'download')
  )
);

create index publications_joke_idx on public.publications (joke_id, created_at desc);
create index publications_user_status_idx on public.publications (user_id, status);

create trigger publications_set_updated_at
  before update on public.publications
  for each row execute function public.set_updated_at();

alter table public.publications enable row level security;
create policy "read own publications" on public.publications
  for select to authenticated
  using (user_id = (select auth.uid()));
revoke all on public.publications from anon;
revoke insert, update, delete on public.publications from authenticated;

-- ---------------------------------------------------------------------------
-- start_publication: records a share-sheet or copy-and-open publish as
-- pending, before the share sheet opens. Idempotent on client_request_id.
-- ---------------------------------------------------------------------------
create or replace function public.start_publication(
  p_joke_id uuid,
  p_method public.publication_method,
  p_title text,
  p_body text,
  p_include jsonb,
  p_client_request_id uuid
)
returns public.publications
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  result public.publications;
begin
  if uid is null then
    raise exception 'sign in to publish' using errcode = 'insufficient_privilege';
  end if;
  if p_method not in ('share_sheet', 'copy_open') then
    raise exception 'only share-sheet and copy publishes are recorded here' using errcode = 'invalid_parameter_value';
  end if;
  if not exists (select 1 from public.jokes j where j.id = p_joke_id and j.user_id = uid and j.deleted_at is null) then
    raise exception 'joke not found' using errcode = 'no_data_found';
  end if;

  insert into public.publications (user_id, joke_id, client_request_id, destination, method, title, body, include_options)
  values (uid, p_joke_id, p_client_request_id, 'google_keep', p_method, btrim(p_title), p_body, coalesce(p_include, '{}'::jsonb))
  on conflict (user_id, client_request_id) do nothing
  returning * into result;

  if not found then
    select * into result from public.publications p
     where p.user_id = uid and p.client_request_id = p_client_request_id;
  end if;
  return result;
end;
$$;

-- ---------------------------------------------------------------------------
-- confirm_publication: the answer to "Did it save in Keep?". The app can't see
-- inside Keep, so this is the user's word; it can be corrected later.
-- ---------------------------------------------------------------------------
create or replace function public.confirm_publication(p_id uuid, p_saved boolean)
returns public.publications
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  result public.publications;
begin
  select * into result from public.publications p
   where p.id = p_id and p.user_id = uid
   for update;
  if not found then
    raise exception 'publication not found' using errcode = 'no_data_found';
  end if;
  if result.method not in ('share_sheet', 'copy_open') then
    raise exception 'only share-sheet and copy publishes are confirmed by hand' using errcode = 'invalid_parameter_value';
  end if;

  update public.publications p
     set status = (case when p_saved then 'user_confirmed' else 'cancelled' end)::public.publication_status,
         completed_at = now()
   where p.id = p_id
  returning * into result;
  return result;
end;
$$;

grant execute on function public.start_publication(uuid, public.publication_method, text, text, jsonb, uuid) to authenticated;
grant execute on function public.confirm_publication(uuid, boolean) to authenticated;
revoke execute on function public.start_publication(uuid, public.publication_method, text, text, jsonb, uuid) from anon, public;
revoke execute on function public.confirm_publication(uuid, boolean) from anon, public;

-- ---------------------------------------------------------------------------
-- google_connections: the Google Docs integration's encrypted refresh token.
-- RLS with no policies: only the Worker, with the service role, can reach it.
-- ---------------------------------------------------------------------------
create table public.google_connections (
  user_id                  uuid primary key references auth.users (id) on delete cascade,
  google_sub               text,
  google_email             text,
  granted_scopes           text[] not null default '{}',
  refresh_token_ciphertext text not null,
  status                   public.google_connection_status not null default 'active',
  joke_book_file_id        text,
  connected_at             timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  last_error               text
);

create trigger google_connections_set_updated_at
  before update on public.google_connections
  for each row execute function public.set_updated_at();

alter table public.google_connections enable row level security;
revoke all on public.google_connections from anon, authenticated;

-- ---------------------------------------------------------------------------
-- topic_stats v4: jokes sent to Keep (confirmed share/copy) and to the Docs
-- Joke Book, each counted once per joke (docs/DESIGN.md §7.6).
-- ---------------------------------------------------------------------------
create or replace view public.topic_stats
with (security_invoker = true) as
select
  base.*,
  case when base.setup_count = 0 then null
       else round(100.0 * base.setups_with_joke_count / base.setup_count)::int
  end as completion_percent,
  (select count(distinct p.joke_id) from public.publications p
     join public.jokes k on k.id = p.joke_id and k.deleted_at is null
    where k.topic_id = base.topic_id
      and p.destination = 'google_keep'
      and p.status in ('succeeded', 'user_confirmed'))::int as published_to_keep_count,
  (select count(distinct p.joke_id) from public.publications p
     join public.jokes k on k.id = p.joke_id and k.deleted_at is null
    where k.topic_id = base.topic_id
      and p.destination = 'google_docs'
      and p.status = 'succeeded')::int as published_to_docs_count
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
