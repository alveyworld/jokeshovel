-- Phase 1: ownership, RLS, triggers and topic_stats.
-- Run with `pnpm db:test` (supabase test db).
begin;
select plan(24);

-- Two users. Inserting into auth.users fires handle_new_user().
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-4111-8111-111111111111', 'alice@example.com', '{"full_name": "Alice"}'),
  ('22222222-2222-4222-8222-222222222222', 'bob@example.com', '{}');

select is(
  (select display_name from public.profiles where id = '11111111-1111-4111-8111-111111111111'),
  'Alice',
  'a profile is created from the Google full_name on sign-up'
);
select is(
  (select count(*)::int from public.profiles
    where id in ('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222')),
  2,
  'every new user gets a profile'
);

-- ---------------------------------------------------------------------------
-- Act as Alice
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}', true);

select lives_ok(
  $$ insert into public.topics (id, title) values ('aaaaaaaa-0000-4000-8000-000000000001', 'Airports') $$,
  'Alice can create a topic (user_id defaults to auth.uid())'
);
select is(
  (select user_id::text from public.topics where id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  '11111111-1111-4111-8111-111111111111',
  'the topic is owned by Alice'
);
select lives_ok(
  $$ insert into public.associations (topic_id, text) values
       ('aaaaaaaa-0000-4000-8000-000000000001', 'TSA'),
       ('aaaaaaaa-0000-4000-8000-000000000001', 'layover'),
       ('aaaaaaaa-0000-4000-8000-000000000001', 'neck pillow') $$,
  'Alice can add associations'
);
select lives_ok(
  $$ insert into public.setups (id, topic_id, text) values
       ('bbbbbbbb-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', ''),
       ('bbbbbbbb-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001', 'My flight had a six-hour layover.') $$,
  'Alice can add setups, including an empty draft'
);
select throws_ok(
  $$ insert into public.topics (title) values ('   ') $$,
  '23514', null,
  'a blank topic title is rejected'
);

-- Soft-deleted and archived rows are excluded from counts.
update public.associations set deleted_at = now() where text = 'neck pillow';
insert into public.setups (topic_id, text, status) values ('aaaaaaaa-0000-4000-8000-000000000001', 'Old bit', 'archived');

select results_eq(
  $$ select association_count, setup_count from public.topic_stats
     where topic_id = 'aaaaaaaa-0000-4000-8000-000000000001' $$,
  $$ values (2, 2) $$,
  'topic_stats counts live associations and active setups only'
);

-- ---------------------------------------------------------------------------
-- Triggers (as the table owner, so the clock can be wound back)
-- ---------------------------------------------------------------------------
reset role;
update public.topics set last_activity_at = now() - interval '3 days', updated_at = now() - interval '3 days'
 where id = 'aaaaaaaa-0000-4000-8000-000000000001';
update public.setups set updated_at = now() - interval '3 days'
 where id = 'bbbbbbbb-0000-4000-8000-000000000002';

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}', true);

update public.setups set text = 'My flight had a seven-hour layover.' where id = 'bbbbbbbb-0000-4000-8000-000000000002';
select ok(
  (select updated_at > now() - interval '1 minute' from public.setups where id = 'bbbbbbbb-0000-4000-8000-000000000002'),
  'updating a setup refreshes its updated_at'
);
select ok(
  (select last_activity_at > now() - interval '1 minute' from public.topics where id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  'editing a setup bumps the topic''s last_activity_at'
);

-- ---------------------------------------------------------------------------
-- Act as Bob: he must not see or touch Alice's data
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub": "22222222-2222-4222-8222-222222222222", "role": "authenticated"}', true);

select is_empty($$ select 1 from public.topics $$, 'Bob sees no topics');
select is_empty($$ select 1 from public.associations $$, 'Bob sees no associations');
select is_empty($$ select 1 from public.setups $$, 'Bob sees no setups');
select is_empty($$ select 1 from public.topic_stats $$, 'Bob sees no topic_stats rows');
select results_eq(
  $$ select id::text from public.profiles $$,
  $$ values ('22222222-2222-4222-8222-222222222222') $$,
  'Bob sees only his own profile'
);

select throws_ok(
  $$ insert into public.setups (topic_id, text) values ('aaaaaaaa-0000-4000-8000-000000000001', 'sneaky') $$,
  '23503', null,
  'Bob cannot attach a setup to Alice''s topic (composite ownership FK)'
);
select throws_ok(
  $$ insert into public.associations (topic_id, text) values ('aaaaaaaa-0000-4000-8000-000000000001', 'sneaky') $$,
  '23503', null,
  'Bob cannot attach an association to Alice''s topic'
);
select throws_ok(
  $$ insert into public.setups (topic_id, user_id, text)
     values ('aaaaaaaa-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'sneaky') $$,
  '42501', null,
  'Bob cannot insert a row claiming to be Alice (RLS with check)'
);
select is_empty(
  $$ update public.topics set title = 'hacked' where id = 'aaaaaaaa-0000-4000-8000-000000000001' returning 1 $$,
  'Bob cannot update Alice''s topic'
);
select is_empty(
  $$ delete from public.setups where topic_id = 'aaaaaaaa-0000-4000-8000-000000000001' returning 1 $$,
  'Bob cannot delete Alice''s setups'
);
select is_empty(
  $$ update public.profiles set display_name = 'hacked' where id = '11111111-1111-4111-8111-111111111111' returning 1 $$,
  'Bob cannot update Alice''s profile'
);

-- ---------------------------------------------------------------------------
-- Signed-out visitors have no access at all
-- ---------------------------------------------------------------------------
set local role anon;
select set_config('request.jwt.claims', '{"role": "anon"}', true);

select throws_ok($$ select 1 from public.topics $$, '42501', null, 'anon cannot read topics');
select throws_ok($$ select 1 from public.topic_stats $$, '42501', null, 'anon cannot read topic_stats');

-- ---------------------------------------------------------------------------
-- Alice's data is intact after Bob's attempts
-- ---------------------------------------------------------------------------
reset role;
select is(
  (select title from public.topics where id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  'Airports',
  'Alice''s topic title is unchanged'
);

select * from finish();
rollback;
