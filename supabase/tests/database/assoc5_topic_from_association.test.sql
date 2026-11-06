-- ASSOC-5: a topic made from an association links back to it (AC-30, AC-33, AC-34).
begin;
select plan(17);

insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'alice@example.com'),
  ('22222222-2222-4222-8222-222222222222', 'bob@example.com');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}', true);

insert into public.topics (id, title) values ('aaaaaaaa-0000-4000-8000-000000000001', 'Airports');
insert into public.associations (id, topic_id, text) values
  ('cccccccc-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'TSA'),
  ('cccccccc-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001', 'Layover');

create temp view src as
  select id, source_association_id as source, deleted_at from public.topics;
grant select on src to authenticated;

-- Linking -------------------------------------------------------------------
select lives_ok(
  $$ insert into public.topics (id, title, source_association_id)
     values ('aaaaaaaa-0000-4000-8000-000000000002', 'TSA', 'cccccccc-0000-4000-8000-000000000001') $$,
  'a topic can be made from one of my associations'
);
select is(
  (select source from src where id = 'aaaaaaaa-0000-4000-8000-000000000002'),
  'cccccccc-0000-4000-8000-000000000001'::uuid,
  'the new topic links to its association'
);
-- The app's outbox writes inserts as upserts, so a retry repeats the same row.
insert into public.topics (id, title, source_association_id)
  values ('aaaaaaaa-0000-4000-8000-000000000002', 'TSA', 'cccccccc-0000-4000-8000-000000000001')
  on conflict (id) do update set title = excluded.title, source_association_id = excluded.source_association_id;
select is(
  (select count(*)::int from public.topics where title = 'TSA'),
  1,
  'retrying the save doesn''t create a second topic'
);
select is(
  (select source from src where id = 'aaaaaaaa-0000-4000-8000-000000000002'),
  'cccccccc-0000-4000-8000-000000000001'::uuid,
  'a retried save keeps the link'
);

-- One live topic per association -------------------------------------------
select has_index('public', 'topics', 'topics_source_association_idx', 'at most one live topic per association');
select lives_ok(
  $$ insert into public.topics (id, title, source_association_id)
     values ('aaaaaaaa-0000-4000-8000-000000000003', 'TSA again', 'cccccccc-0000-4000-8000-000000000001') $$,
  'a second topic for the same association (another device) still saves'
);
select is(
  (select source from src where id = 'aaaaaaaa-0000-4000-8000-000000000003'),
  null::uuid,
  '... without the link, which the first topic keeps'
);

-- Trash ---------------------------------------------------------------------
update public.topics set deleted_at = now() where id = 'aaaaaaaa-0000-4000-8000-000000000002';
insert into public.topics (id, title, source_association_id)
  values ('aaaaaaaa-0000-4000-8000-000000000004', 'TSA', 'cccccccc-0000-4000-8000-000000000001');
select is(
  (select source from src where id = 'aaaaaaaa-0000-4000-8000-000000000004'),
  'cccccccc-0000-4000-8000-000000000001'::uuid,
  'once the first topic is in the Trash, the association can become a topic again'
);
select lives_ok(
  $$ update public.topics set deleted_at = null where id = 'aaaaaaaa-0000-4000-8000-000000000002' $$,
  'the first topic can still be restored'
);
select results_eq(
  $$ select id, source from src
     where id in ('aaaaaaaa-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000004') order by id $$,
  $$ values ('aaaaaaaa-0000-4000-8000-000000000002'::uuid, null::uuid),
            ('aaaaaaaa-0000-4000-8000-000000000004'::uuid, 'cccccccc-0000-4000-8000-000000000001'::uuid) $$,
  'the restored topic drops its link; the newer topic keeps it'
);

-- Deleting the association --------------------------------------------------
update public.associations set deleted_at = now() where id = 'cccccccc-0000-4000-8000-000000000001';
select is(
  (select source from src where id = 'aaaaaaaa-0000-4000-8000-000000000004'),
  'cccccccc-0000-4000-8000-000000000001'::uuid,
  'moving the association to the Trash keeps the link, so restoring it brings the link back'
);
delete from public.associations where id = 'cccccccc-0000-4000-8000-000000000001';
select results_eq(
  $$ select id, source from src where id = 'aaaaaaaa-0000-4000-8000-000000000004' $$,
  $$ values ('aaaaaaaa-0000-4000-8000-000000000004'::uuid, null::uuid) $$,
  'deleting the association for good keeps the topic and clears the link'
);

insert into public.topics (id, title, source_association_id)
  values ('aaaaaaaa-0000-4000-8000-000000000005', 'Layover', 'cccccccc-0000-4000-8000-000000000002');
delete from public.topics where id = 'aaaaaaaa-0000-4000-8000-000000000001';
select results_eq(
  $$ select id, source from src where id = 'aaaaaaaa-0000-4000-8000-000000000005' $$,
  $$ values ('aaaaaaaa-0000-4000-8000-000000000005'::uuid, null::uuid) $$,
  'deleting the original topic for good keeps the new topic and clears the link'
);

-- Ownership (AC-34) ---------------------------------------------------------
insert into public.topics (id, title) values ('aaaaaaaa-0000-4000-8000-000000000006', 'Dentists');
insert into public.associations (id, topic_id, text)
  values ('cccccccc-0000-4000-8000-000000000003', 'aaaaaaaa-0000-4000-8000-000000000006', 'Floss');

select set_config('request.jwt.claims', '{"sub": "22222222-2222-4222-8222-222222222222", "role": "authenticated"}', true);
select throws_ok(
  $$ insert into public.topics (title, source_association_id) values ('Floss', 'cccccccc-0000-4000-8000-000000000003') $$,
  '23503', null,
  'Bob can''t make a topic from Alice''s association'
);
insert into public.topics (id, title) values ('aaaaaaaa-0000-4000-8000-000000000007', 'Bob''s topic');
select throws_ok(
  $$ update public.topics set source_association_id = 'cccccccc-0000-4000-8000-000000000003'
     where id = 'aaaaaaaa-0000-4000-8000-000000000007' $$,
  '23503', null,
  'Bob can''t link his topic to Alice''s association'
);
select is_empty(
  $$ select 1 from public.topics where source_association_id is not null $$,
  'Bob sees none of Alice''s linked topics'
);

select set_config('request.jwt.claims', '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}', true);
select is(
  (select count(*)::int from public.topics where source_association_id = 'cccccccc-0000-4000-8000-000000000003'),
  0,
  'Alice''s association is still unlinked'
);

select * from finish();
rollback;
