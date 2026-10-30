-- Phase 4: publications (share sheet, copy and open, Docs), google_connections
-- and the Keep counts in topic_stats.
begin;
select plan(25);

insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'alice@example.com'),
  ('22222222-2222-4222-8222-222222222222', 'bob@example.com');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}', true);

insert into public.topics (id, title) values ('aaaaaaaa-0000-4000-8000-000000000001', 'Airports');
insert into public.setups (id, topic_id, text) values
  ('bbbbbbbb-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'My flight had a six-hour layover.'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001', 'Security took my shampoo.');
insert into public.joke_attempts (id, setup_id, punch) values
  ('dddddddd-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000001', 'So I did loop-de-loops on the tarmac.'),
  ('dddddddd-0000-4000-8000-000000000002', 'bbbbbbbb-0000-4000-8000-000000000002', 'Now I smell like the TSA.');
select public.complete_attempt('dddddddd-0000-4000-8000-000000000001', 'Airports — Flight Layover');
select public.complete_attempt('dddddddd-0000-4000-8000-000000000002', 'Airports — Security Shampoo');

create temp table ids as
  select (select id from public.jokes where attempt_id = 'dddddddd-0000-4000-8000-000000000001') as joke1,
         (select id from public.jokes where attempt_id = 'dddddddd-0000-4000-8000-000000000002') as joke2;
grant select on ids to authenticated;

-- Starting a share-sheet publish records exactly what was sent, as pending.
select lives_ok(
  $$ select public.start_publication((select joke1 from ids), 'share_sheet', ' Airports — Flight Layover — Joke ',
       E'My flight had a six-hour layover.\nSo I did loop-de-loops on the tarmac.', '{"dateAndLink": true}',
       'cccccccc-0000-4000-8000-000000000001') $$,
  'Alice can start a share-sheet publish of her joke'
);
select results_eq(
  $$ select destination::text, method::text, status::text, title, include_options
       from public.publications where client_request_id = 'cccccccc-0000-4000-8000-000000000001' $$,
  $$ values ('google_keep', 'share_sheet', 'pending', 'Airports — Flight Layover — Joke', '{"dateAndLink": true}'::jsonb) $$,
  'the publication is a pending Keep share with the trimmed title and include options'
);
select is(
  (public.start_publication((select joke1 from ids), 'share_sheet', 'Another title', 'x', '{}',
     'cccccccc-0000-4000-8000-000000000001')).title,
  'Airports — Flight Layover — Joke',
  'retrying with the same request id returns the original publication'
);
select is(
  (select count(*)::int from public.publications where client_request_id = 'cccccccc-0000-4000-8000-000000000001'),
  1,
  'retrying never records a second publication'
);
select throws_ok(
  $$ select public.start_publication((select joke1 from ids), 'docs_api', 'T', 'B', '{}', gen_random_uuid()) $$,
  '22023', 'only share-sheet and copy publishes are recorded here',
  'Docs publishes can''t be recorded from the browser'
);
select throws_ok(
  $$ select public.start_publication((select joke1 from ids), 'copy_open', '   ', 'B', '{}', gen_random_uuid()) $$,
  '23514', null,
  'a publish needs a title'
);
select throws_ok(
  $$ select public.start_publication((select joke1 from ids), 'copy_open', 'T', 'B',
       jsonb_build_object('x', repeat('a', 3000)), gen_random_uuid()) $$,
  '23514', null,
  'include options are capped in size'
);

-- The browser can't write publications directly.
select throws_ok(
  $$ insert into public.publications (joke_id, client_request_id, destination, method, status, title, body)
     values ((select joke1 from ids), gen_random_uuid(), 'google_keep', 'share_sheet', 'user_confirmed', 'T', 'B') $$,
  '42501', null,
  'Alice can''t insert a publication directly'
);
select throws_ok(
  $$ update public.publications set status = 'user_confirmed' $$,
  '42501', null,
  'Alice can''t update a publication directly'
);

-- Pending doesn't count; confirming does, once per joke.
select is(
  (select published_to_keep_count from public.topic_stats where topic_id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  0,
  'a pending share isn''t counted as sent to Keep'
);
select results_eq(
  $$ select status::text, completed_at is not null
       from public.confirm_publication(
         (select id from public.publications where client_request_id = 'cccccccc-0000-4000-8000-000000000001'), true) $$,
  $$ values ('user_confirmed', true) $$,
  '"Yes, it''s in Keep" confirms the publication'
);
select public.confirm_publication(
  (public.start_publication((select joke1 from ids), 'copy_open', 'Again', 'B', '{}', 'cccccccc-0000-4000-8000-000000000002')).id,
  true
);
select is(
  (select published_to_keep_count from public.topic_stats where topic_id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  1,
  'two confirmed publishes of the same joke count as one joke sent to Keep'
);
select results_eq(
  $$ select status::text from public.confirm_publication(
       (public.start_publication((select joke2 from ids), 'share_sheet', 'Shampoo', 'B', '{}',
          'cccccccc-0000-4000-8000-000000000003')).id, false) $$,
  $$ values ('cancelled') $$,
  'answering "No" cancels the publication'
);
select is(
  (select published_to_keep_count from public.topic_stats where topic_id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  1,
  'a cancelled publish doesn''t count'
);
select results_eq(
  $$ select status::text from public.confirm_publication(
       (select id from public.publications where client_request_id = 'cccccccc-0000-4000-8000-000000000003'), true) $$,
  $$ values ('user_confirmed') $$,
  'a mistaken "No" can be corrected'
);
select is(
  (select published_to_keep_count from public.topic_stats where topic_id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  2,
  'the corrected publish now counts'
);

-- Docs publishes are written by the Worker (service role) and counted separately.
reset role;
insert into public.publications (user_id, joke_id, client_request_id, destination, method, status, title, body)
values ('11111111-1111-4111-8111-111111111111', (select joke1 from ids), 'cccccccc-0000-4000-8000-000000000004',
        'google_docs', 'docs_api', 'succeeded', 'Airports — Flight Layover — Joke', 'B');
set local role authenticated;
select is(
  (select published_to_docs_count from public.topic_stats where topic_id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  1,
  'a successful Joke Book publish counts toward the Docs total'
);
select throws_ok(
  $$ select public.confirm_publication(
       (select id from public.publications where client_request_id = 'cccccccc-0000-4000-8000-000000000004'), true) $$,
  '22023', 'only share-sheet and copy publishes are confirmed by hand',
  'Docs publishes can''t be confirmed by hand'
);

-- Bob sees and touches none of it.
select set_config('request.jwt.claims', '{"sub": "22222222-2222-4222-8222-222222222222", "role": "authenticated"}', true);
select is_empty($$ select 1 from public.publications $$, 'Bob sees none of Alice''s publications');
select throws_ok(
  $$ select public.start_publication((select joke1 from ids), 'share_sheet', 'T', 'B', '{}', gen_random_uuid()) $$,
  'P0002', 'joke not found',
  'Bob can''t publish Alice''s joke'
);
select throws_ok(
  $$ select public.confirm_publication(
       (select id from public.publications limit 1), true) $$,
  'P0002', 'publication not found',
  'Bob can''t confirm Alice''s publication'
);

-- google_connections is server-only.
select throws_ok($$ select * from public.google_connections $$, '42501', null, 'signed-in users can''t read Google connections');
set local role anon;
select set_config('request.jwt.claims', '{"role": "anon"}', true);
select throws_ok(
  $$ select public.start_publication(gen_random_uuid(), 'share_sheet', 'T', 'B', '{}', gen_random_uuid()) $$,
  '42501', null,
  'anon can''t publish'
);

-- Deleting a joke takes it out of the counts; hard-deleting removes its history.
reset role;
update public.jokes set deleted_at = now() where id = (select joke2 from ids);
select is(
  (select published_to_keep_count from public.topic_stats where topic_id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  1,
  'a deleted joke no longer counts as sent to Keep'
);
delete from public.jokes where id = (select joke2 from ids);
select is(
  (select count(*)::int from public.publications where client_request_id = 'cccccccc-0000-4000-8000-000000000003'),
  0,
  'hard-deleting a joke removes its publications'
);

select * from finish();
rollback;
