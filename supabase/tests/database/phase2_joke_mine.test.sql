-- Phase 2: assumptions, joke attempts, reinterpretations — ownership, RLS,
-- consistency trigger, stats and the drafts feed.
begin;
select plan(27);

insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'alice@example.com'),
  ('22222222-2222-4222-8222-222222222222', 'bob@example.com');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}', true);

insert into public.topics (id, title) values ('aaaaaaaa-0000-4000-8000-000000000001', 'Airports');
insert into public.setups (id, topic_id, text) values
  ('bbbbbbbb-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'My flight had a six-hour layover.'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001', 'Another setup.');

select lives_ok(
  $$ insert into public.assumptions (id, setup_id, text) values
       ('cccccccc-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000001', 'The speaker is a passenger.'),
       ('cccccccc-0000-4000-8000-000000000002', 'bbbbbbbb-0000-4000-8000-000000000001', 'The layover was a nuisance.'),
       ('cccccccc-0000-4000-8000-000000000003', 'bbbbbbbb-0000-4000-8000-000000000002', 'Belongs to the other setup.') $$,
  'Alice can list assumptions for her setups'
);

select lives_ok(
  $$ insert into public.joke_attempts (id, setup_id) values
       ('dddddddd-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000001') $$,
  'an attempt can be started with only its setup'
);
select is(
  (select topic_id::text from public.joke_attempts where id = 'dddddddd-0000-4000-8000-000000000001'),
  'aaaaaaaa-0000-4000-8000-000000000001',
  'the attempt''s topic is copied from its setup'
);
select is(
  (select current_step::text || '/' || status::text from public.joke_attempts where id = 'dddddddd-0000-4000-8000-000000000001'),
  'target/in_progress',
  'a new attempt starts at the target step, in progress'
);

select lives_ok(
  $$ update public.joke_attempts set target_assumption_id = 'cccccccc-0000-4000-8000-000000000001',
            connector = 'my flight', current_step = 'reinterpretations'
      where id = 'dddddddd-0000-4000-8000-000000000001' $$,
  'Alice can target one of the setup''s assumptions'
);
select throws_ok(
  $$ update public.joke_attempts set target_assumption_id = 'cccccccc-0000-4000-8000-000000000003'
      where id = 'dddddddd-0000-4000-8000-000000000001' $$,
  '23514', 'target assumption must belong to the attempt''s setup',
  'an assumption from a different setup cannot be the target'
);

insert into public.joke_attempts (id, setup_id) values
  ('dddddddd-0000-4000-8000-000000000002', 'bbbbbbbb-0000-4000-8000-000000000001');

select lives_ok(
  $$ insert into public.reinterpretations (id, attempt_id, text) values
       ('eeeeeeee-0000-4000-8000-000000000001', 'dddddddd-0000-4000-8000-000000000001', 'the flight I''m piloting'),
       ('eeeeeeee-0000-4000-8000-000000000002', 'dddddddd-0000-4000-8000-000000000001', 'a flight of stairs'),
       ('eeeeeeee-0000-4000-8000-000000000003', 'dddddddd-0000-4000-8000-000000000002', 'other attempt''s idea') $$,
  'Alice can brainstorm reinterpretations'
);
select lives_ok(
  $$ update public.joke_attempts set selected_reinterpretation_id = 'eeeeeeee-0000-4000-8000-000000000001',
            second_story = 'I''m the pilot.', punch = 'So I did loop-de-loops on the tarmac.'
      where id = 'dddddddd-0000-4000-8000-000000000001' $$,
  'Alice can choose one of the attempt''s reinterpretations and write the rest'
);
select throws_ok(
  $$ update public.joke_attempts set selected_reinterpretation_id = 'eeeeeeee-0000-4000-8000-000000000003'
      where id = 'dddddddd-0000-4000-8000-000000000001' $$,
  '23514', 'selected reinterpretation must belong to this attempt',
  'a reinterpretation from another attempt cannot be chosen'
);
update public.joke_attempts set topic_id = 'aaaaaaaa-0000-4000-8000-000000000009'
 where id = 'dddddddd-0000-4000-8000-000000000001';
select is(
  (select topic_id::text from public.joke_attempts where id = 'dddddddd-0000-4000-8000-000000000001'),
  'aaaaaaaa-0000-4000-8000-000000000001',
  'topic_id cannot be pointed elsewhere: it is always re-copied from the setup'
);

-- Deleting the targeted assumption clears the target (FK on delete set null).
reset role;
delete from public.assumptions where id = 'cccccccc-0000-4000-8000-000000000002';
insert into public.assumptions (id, user_id, setup_id, text) values
  ('cccccccc-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111', 'bbbbbbbb-0000-4000-8000-000000000001', 'temp');
update public.joke_attempts set target_assumption_id = 'cccccccc-0000-4000-8000-000000000004'
 where id = 'dddddddd-0000-4000-8000-000000000002';
delete from public.assumptions where id = 'cccccccc-0000-4000-8000-000000000004';
select is(
  (select target_assumption_id from public.joke_attempts where id = 'dddddddd-0000-4000-8000-000000000002'),
  null,
  'hard-deleting the targeted assumption clears the attempt''s target'
);

-- Activity bumps via parents.
update public.topics set last_activity_at = now() - interval '3 days' where id = 'aaaaaaaa-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}', true);
update public.reinterpretations set is_starred = true where id = 'eeeeeeee-0000-4000-8000-000000000002';
select ok(
  (select last_activity_at > now() - interval '1 minute' from public.topics where id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  'editing a reinterpretation bumps the topic''s last activity'
);
reset role;
update public.topics set last_activity_at = now() - interval '3 days' where id = 'aaaaaaaa-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}', true);
update public.assumptions set text = 'The speaker is a passenger on that flight.' where id = 'cccccccc-0000-4000-8000-000000000001';
select ok(
  (select last_activity_at > now() - interval '1 minute' from public.topics where id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  'editing an assumption bumps the topic''s last activity'
);

-- Stats and drafts.
insert into public.joke_attempts (setup_id, status) values ('bbbbbbbb-0000-4000-8000-000000000002', 'abandoned');
update public.joke_attempts set deleted_at = now() where id = 'dddddddd-0000-4000-8000-000000000002';
select is(
  (select unfinished_attempt_count from public.topic_stats where topic_id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  1,
  'unfinished attempts count only live, in-progress attempts'
);
select results_eq(
  $$ select attempt_id::text, topic_title, setup_text, current_step::text, target_text
       from public.drafts_feed $$,
  $$ values ('dddddddd-0000-4000-8000-000000000001', 'Airports', 'My flight had a six-hour layover.',
             'reinterpretations', 'The speaker is a passenger on that flight.') $$,
  'drafts_feed lists the live in-progress attempt with its context'
);

-- ---------------------------------------------------------------------------
-- Bob
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub": "22222222-2222-4222-8222-222222222222", "role": "authenticated"}', true);
select is_empty($$ select 1 from public.assumptions $$, 'Bob sees no assumptions');
select is_empty($$ select 1 from public.joke_attempts $$, 'Bob sees no attempts');
select is_empty($$ select 1 from public.reinterpretations $$, 'Bob sees no reinterpretations');
select is_empty($$ select 1 from public.drafts_feed $$, 'Bob sees no drafts');
select throws_ok(
  $$ insert into public.assumptions (setup_id, text) values ('bbbbbbbb-0000-4000-8000-000000000001', 'sneaky') $$,
  '23503', null, 'Bob cannot add an assumption to Alice''s setup'
);
select throws_ok(
  $$ insert into public.joke_attempts (setup_id) values ('bbbbbbbb-0000-4000-8000-000000000001') $$,
  null, null, 'Bob cannot start an attempt on Alice''s setup'
);
select throws_ok(
  $$ insert into public.reinterpretations (attempt_id, text) values ('dddddddd-0000-4000-8000-000000000001', 'sneaky') $$,
  '23503', null, 'Bob cannot add a reinterpretation to Alice''s attempt'
);
select is_empty(
  $$ update public.joke_attempts set punch = 'hacked' where id = 'dddddddd-0000-4000-8000-000000000001' returning 1 $$,
  'Bob cannot edit Alice''s attempt'
);
select is_empty(
  $$ delete from public.assumptions where setup_id = 'bbbbbbbb-0000-4000-8000-000000000001' returning 1 $$,
  'Bob cannot delete Alice''s assumptions'
);

set local role anon;
select set_config('request.jwt.claims', '{"role": "anon"}', true);
select throws_ok($$ select 1 from public.joke_attempts $$, '42501', null, 'anon cannot read attempts');
select throws_ok($$ select 1 from public.drafts_feed $$, '42501', null, 'anon cannot read drafts');

reset role;
select is(
  (select punch from public.joke_attempts where id = 'dddddddd-0000-4000-8000-000000000001'),
  'So I did loop-de-loops on the tarmac.',
  'Alice''s punch is unchanged'
);

select * from finish();
rollback;
