-- Phase 3: completing jokes, the jokes collection, search and completion %.
begin;
select plan(26);

insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'alice@example.com'),
  ('22222222-2222-4222-8222-222222222222', 'bob@example.com');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}', true);

-- Topic with 5 setups; 3 of them will produce completed jokes (AC-19).
insert into public.topics (id, title) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'Airports'),
  ('aaaaaaaa-0000-4000-8000-000000000002', 'Empty topic');
insert into public.setups (id, topic_id, text) values
  ('bbbbbbbb-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'My flight had a six-hour layover.'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001', 'Security took my shampoo.'),
  ('bbbbbbbb-0000-4000-8000-000000000003', 'aaaaaaaa-0000-4000-8000-000000000001', 'The gate agent smiled at me.'),
  ('bbbbbbbb-0000-4000-8000-000000000004', 'aaaaaaaa-0000-4000-8000-000000000001', 'I love airport food.'),
  ('bbbbbbbb-0000-4000-8000-000000000005', 'aaaaaaaa-0000-4000-8000-000000000001', '');
insert into public.assumptions (id, setup_id, text) values
  ('cccccccc-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000001', 'The speaker is a passenger.');
insert into public.joke_attempts (id, setup_id, target_assumption_id, connector) values
  ('dddddddd-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000001', 'cccccccc-0000-4000-8000-000000000001', 'my flight'),
  ('dddddddd-0000-4000-8000-000000000002', 'bbbbbbbb-0000-4000-8000-000000000002', null, ''),
  ('dddddddd-0000-4000-8000-000000000003', 'bbbbbbbb-0000-4000-8000-000000000003', null, ''),
  ('dddddddd-0000-4000-8000-000000000004', 'bbbbbbbb-0000-4000-8000-000000000004', null, ''),
  ('dddddddd-0000-4000-8000-000000000005', 'bbbbbbbb-0000-4000-8000-000000000005', null, '');
insert into public.reinterpretations (id, attempt_id, text) values
  ('eeeeeeee-0000-4000-8000-000000000001', 'dddddddd-0000-4000-8000-000000000001', 'the flight I''m piloting');
update public.joke_attempts
   set selected_reinterpretation_id = 'eeeeeeee-0000-4000-8000-000000000001',
       second_story = 'I''m the pilot.'
 where id = 'dddddddd-0000-4000-8000-000000000001';

-- Completing requires a punch (and a setup).
select throws_ok(
  $$ select public.complete_attempt('dddddddd-0000-4000-8000-000000000001') $$,
  '23514', 'write a punch before completing the joke',
  'an attempt without a punch cannot be completed'
);
update public.joke_attempts set punch = 'So I did loop-de-loops on the tarmac.'
 where id = 'dddddddd-0000-4000-8000-000000000005';
select throws_ok(
  $$ select public.complete_attempt('dddddddd-0000-4000-8000-000000000005') $$,
  '23514', 'write a setup before completing the joke',
  'an attempt whose setup is empty cannot be completed'
);

update public.joke_attempts set punch = '  So I did loop-de-loops on the tarmac.  '
 where id = 'dddddddd-0000-4000-8000-000000000001';
select lives_ok(
  $$ select public.complete_attempt('dddddddd-0000-4000-8000-000000000001', 'Airports — Flight Layover') $$,
  'Alice can complete an attempt with a setup and a punch'
);
select results_eq(
  $$ select title, setup_text, punch_text, target_assumption_text, connector_text,
            reinterpretation_text, second_story_text, status::text
       from public.jokes where attempt_id = 'dddddddd-0000-4000-8000-000000000001' $$,
  $$ values ('Airports — Flight Layover', 'My flight had a six-hour layover.', 'So I did loop-de-loops on the tarmac.',
             'The speaker is a passenger.', 'my flight', 'the flight I''m piloting', 'I''m the pilot.', 'complete') $$,
  'the joke snapshots the dig path (trimmed)'
);
select results_eq(
  $$ select status::text, current_step::text, completed_at is not null
       from public.joke_attempts where id = 'dddddddd-0000-4000-8000-000000000001' $$,
  $$ values ('completed', 'review', true) $$,
  'completing marks the attempt completed, at the review step'
);
select is(
  (public.complete_attempt('dddddddd-0000-4000-8000-000000000001', 'A different title')).id,
  (select id from public.jokes where attempt_id = 'dddddddd-0000-4000-8000-000000000001'),
  'completing again returns the same joke (idempotent)'
);
select is(
  (select count(*)::int from public.jokes where attempt_id = 'dddddddd-0000-4000-8000-000000000001'),
  1,
  'retrying never creates a second joke'
);
select is(
  (select count(*)::int from public.drafts_feed where attempt_id = 'dddddddd-0000-4000-8000-000000000001'),
  0,
  'a completed attempt leaves the drafts list'
);

-- Two more setups get jokes: 3 of 5 active setups → 60% (AC-19).
update public.joke_attempts set punch = 'Now I smell like the TSA.' where id = 'dddddddd-0000-4000-8000-000000000002';
update public.joke_attempts set punch = 'Then she closed the gate.' where id = 'dddddddd-0000-4000-8000-000000000003';
select public.complete_attempt('dddddddd-0000-4000-8000-000000000002');
select public.complete_attempt('dddddddd-0000-4000-8000-000000000003');

select results_eq(
  $$ select setup_count, completed_joke_count, setups_with_joke_count, completion_percent
       from public.topic_stats where topic_id = 'aaaaaaaa-0000-4000-8000-000000000001' $$,
  $$ values (5, 3, 3, 60) $$,
  'completion is setups with a completed joke ÷ active setups (3 of 5 = 60%)'
);
select is(
  (select completion_percent from public.topic_stats where topic_id = 'aaaaaaaa-0000-4000-8000-000000000002'),
  null,
  'a topic with no setups has no completion percentage'
);
select is(
  (select unfinished_attempt_count from public.topic_stats where topic_id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  2,
  'completed attempts no longer count as unfinished'
);

-- Editing the joke card doesn't touch the attempt (AC-17).
update public.jokes set punch_text = 'Loop-de-loops. On the tarmac.'
 where attempt_id = 'dddddddd-0000-4000-8000-000000000001';
select is(
  (select punch from public.joke_attempts where id = 'dddddddd-0000-4000-8000-000000000001'),
  '  So I did loop-de-loops on the tarmac.  ',
  'editing the joke''s punch leaves the attempt''s punch as it was'
);
select throws_ok(
  $$ update public.jokes set rating = 6 where attempt_id = 'dddddddd-0000-4000-8000-000000000001' $$,
  '23514', null, 'ratings are 1–5'
);
select lives_ok(
  $$ update public.jokes set rating = 4, is_favorite = true where attempt_id = 'dddddddd-0000-4000-8000-000000000001' $$,
  'Alice can rate and favorite a joke'
);

-- Search (AC-18): substrings and near-misses, grouped by kind.
update public.joke_attempts set punch = 'The dentist bit about waiting rooms' where id = 'dddddddd-0000-4000-8000-000000000004';
select ok(
  exists (select 1 from public.search_all('layovr') where kind = 'joke' and title = 'Airports — Flight Layover'),
  'a typo ("layovr") finds the joke containing "layover"'
);
select ok(
  exists (select 1 from public.search_all('layovr') where kind = 'setup' and title = 'My flight had a six-hour layover.'),
  'the same search finds the setup'
);
select ok(
  exists (select 1 from public.search_all('dentist') where kind = 'draft'),
  'search finds unfinished drafts by their punch'
);
select ok(
  exists (select 1 from public.search_all('airport') where kind = 'topic'),
  'search finds topics by title'
);
select is_empty($$ select 1 from public.search_all('a') $$, 'one-letter searches return nothing');
select is_empty($$ select 1 from public.search_all('zzzzqqq') $$, 'unrelated text returns nothing');

-- Bob sees none of it.
select set_config('request.jwt.claims', '{"sub": "22222222-2222-4222-8222-222222222222", "role": "authenticated"}', true);
select is_empty($$ select 1 from public.jokes $$, 'Bob sees no jokes');
select is_empty($$ select 1 from public.search_all('layover') $$, 'Bob''s searches never return Alice''s material');
select throws_ok(
  $$ select public.complete_attempt('dddddddd-0000-4000-8000-000000000004') $$,
  'P0002', 'joke attempt not found',
  'Bob cannot complete Alice''s attempt'
);
select is_empty(
  $$ update public.jokes set punch_text = 'hacked' returning 1 $$,
  'Bob cannot edit Alice''s jokes'
);

set local role anon;
select set_config('request.jwt.claims', '{"role": "anon"}', true);
select throws_ok($$ select public.search_all('layover') $$, '42501', null, 'anon cannot search');

-- Hard-deleting the attempt keeps the joke.
reset role;
delete from public.joke_attempts where id = 'dddddddd-0000-4000-8000-000000000001';
select is(
  (select count(*)::int from public.jokes where punch_text = 'Loop-de-loops. On the tarmac.' and attempt_id is null),
  1,
  'a joke outlives its attempt'
);

select * from finish();
rollback;
