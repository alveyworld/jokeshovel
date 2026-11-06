-- The Joke Shovel — ASSOC-5: turn an association into its own topic.
-- A topic made from an association remembers where it came from, so each can
-- link to the other (docs/DESIGN.md §14 ASSOC-5, §15 AC-28 to AC-34).

-- A unique (id, user_id) lets topics point at an association with a composite
-- foreign key, so a topic can only link to an association its owner owns.
alter table public.associations
  add constraint associations_id_user_id_key unique (id, user_id);

-- Deleting the association for good (the Trash purge, or deleting its topic)
-- keeps the new topic and only clears the link.
alter table public.topics
  add column source_association_id uuid,
  add constraint topics_source_association_fkey
    foreign key (source_association_id, user_id)
    references public.associations (id, user_id)
    on delete set null (source_association_id);

-- At most one live topic per association.
create unique index topics_source_association_idx
  on public.topics (source_association_id)
  where source_association_id is not null and deleted_at is null;

-- The app opens an association's existing topic instead of making another, so
-- a second live topic for the same association only happens when it was
-- already converted on another device, or when a topic is restored from the
-- Trash after its association was converted again. Rather than reject that
-- save and lose the topic, keep it and drop its link.
create or replace function public.topics_release_taken_source()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.source_association_id is not null
     and new.deleted_at is null
     and exists (
       select 1 from public.topics t
       where t.source_association_id = new.source_association_id
         and t.deleted_at is null
         and t.id <> new.id
     ) then
    new.source_association_id := null;
  end if;
  return new;
end;
$$;

create trigger topics_release_taken_source
  before insert or update of source_association_id, deleted_at on public.topics
  for each row execute function public.topics_release_taken_source();
