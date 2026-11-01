-- Phase 5: tags, branching setups, the Trash purge and account deletion.
begin;
select plan(30);

insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'alice@example.com'),
  ('22222222-2222-4222-8222-222222222222', 'bob@example.com');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}', true);

insert into public.topics (id, title) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'Airports'),
  ('aaaaaaaa-0000-4000-8000-000000000002', 'Old topic');
insert into public.setups (id, topic_id, text, sort_order) values
  ('bbbbbbbb-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'My flight had a six-hour layover.', 1),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001', 'Security took my shampoo.', 2),
  ('bbbbbbbb-0000-4000-8000-000000000003', 'aaaaaaaa-0000-4000-8000-000000000002', 'Under the old topic.', 1);
insert into public.assumptions (setup_id, text, deleted_at) values
  ('bbbbbbbb-0000-4000-8000-000000000001', 'The speaker is a passenger.', null),
  ('bbbbbbbb-0000-4000-8000-000000000001', 'The layover was boring.', null),
  ('bbbbbbbb-0000-4000-8000-000000000001', 'Deleted one.', now());
insert into public.joke_attempts (id, setup_id, punch) values
  ('dddddddd-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000002', 'Now I smell like the TSA.');
select public.complete_attempt('dddddddd-0000-4000-8000-000000000001', 'Airports — Security Shampoo');
create temp table ids as
  select (select id from public.jokes where attempt_id = 'dddddddd-0000-4000-8000-000000000001') as joke;
grant select on ids to authenticated;

-- Tags --------------------------------------------------------------------
select results_eq(
  $$ select name from public.set_joke_tags((select joke from ids), array['  Opener ', 'clean', 'OPENER', '']) $$,
  $$ values ('clean'), ('Opener') $$,
  'tags are trimmed, de-duplicated ignoring case (first spelling wins) and created as needed'
);
select is((select count(*)::int from public.tags), 2, 'two tags exist');
select results_eq(
  $$ select name from public.set_topic_tags('aaaaaaaa-0000-4000-8000-000000000001', array['opener']) $$,
  $$ values ('Opener') $$,
  'a topic reuses an existing tag whatever its case'
);
select is((select count(*)::int from public.tags), 2, 'no duplicate tag was created');
select results_eq(
  $$ select name from public.set_joke_tags((select joke from ids), array['clean']) $$,
  $$ values ('clean') $$,
  'setting tags replaces the old set'
);
select is_empty($$ select * from public.set_joke_tags((select joke from ids), '{}') $$, 'an empty list clears a joke''s tags');
select throws_ok(
  $$ select public.set_joke_tags((select joke from ids), (select array_agg('t' || g) from generate_series(1, 21) g)) $$,
  '23514', 'at most 20 tags', 'an item has at most 20 tags'
);
select throws_ok(
  $$ select public.set_joke_tags((select joke from ids), array[repeat('x', 41)]) $$,
  '23514', null, 'tag names are at most 40 characters'
);
select throws_ok($$ insert into public.tags (name) values ('CLEAN') $$, '23505', null, 'tag names are unique per user, ignoring case');
select public.set_joke_tags((select joke from ids), array['clean', 'Opener']);
delete from public.tags where name = 'clean';
select results_eq(
  $$ select t.name from public.joke_tags jt join public.tags t on t.id = jt.tag_id $$,
  $$ values ('Opener') $$,
  'deleting a tag removes it from jokes'
);

-- Branch and duplicate ------------------------------------------------------
select results_eq(
  $$ select text, parent_setup_id, sort_order
       from public.branch_setup('bbbbbbbb-0000-4000-8000-000000000001') $$,
  $$ values ('My flight had a six-hour layover.', 'bbbbbbbb-0000-4000-8000-000000000001'::uuid, 1.5::float8) $$,
  'a branch copies the text, remembers its parent and sits right after it'
);
select is(
  (select count(*)::int from public.assumptions a join public.setups s on s.id = a.setup_id
    where s.parent_setup_id = 'bbbbbbbb-0000-4000-8000-000000000001'),
  0,
  'a branch starts with no assumptions'
);
select is(
  (select count(*)::int from public.assumptions
    where setup_id = (public.branch_setup('bbbbbbbb-0000-4000-8000-000000000002', true)).id),
  0,
  'duplicating a setup with no assumptions copies none'
);
-- A separate statement: a query can't see rows inserted by a function it calls.
create temp table dup as select * from public.branch_setup('bbbbbbbb-0000-4000-8000-000000000001', true);
select is(
  (select count(*)::int from public.assumptions where setup_id = (select id from dup)),
  2,
  'a duplicate copies the live assumptions (not deleted ones)'
);

-- Bob -----------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub": "22222222-2222-4222-8222-222222222222", "role": "authenticated"}', true);
select is_empty($$ select 1 from public.tags $$, 'Bob sees none of Alice''s tags');
select throws_ok(
  $$ select public.set_joke_tags((select joke from ids), array['mine']) $$,
  'P0002', 'joke not found', 'Bob can''t tag Alice''s joke'
);
select throws_ok(
  $$ select public.branch_setup('bbbbbbbb-0000-4000-8000-000000000001') $$,
  'P0002', 'setup not found', 'Bob can''t branch Alice''s setup'
);
select lives_ok($$ insert into public.tags (name) values ('Opener') $$, 'Bob has his own tag names');

-- Trash purge ---------------------------------------------------------------
reset role;
update public.topics set deleted_at = now() - interval '31 days' where id = 'aaaaaaaa-0000-4000-8000-000000000002';
update public.setups set deleted_at = now() - interval '31 days' where id = 'bbbbbbbb-0000-4000-8000-000000000002';
update public.jokes set deleted_at = now() - interval '10 days';
select is(
  (public.purge_trash() ->> 'topics')::int,
  1,
  'the purge removes topics deleted more than 30 days ago'
);
select is_empty(
  $$ select 1 from public.setups where id in ('bbbbbbbb-0000-4000-8000-000000000002', 'bbbbbbbb-0000-4000-8000-000000000003') $$,
  'setups in a purged topic, and setups deleted 31 days ago, are gone'
);
select results_eq(
  $$ select count(*)::int, bool_and(setup_id is null) from public.jokes
      where user_id = '11111111-1111-4111-8111-111111111111' $$,
  $$ values (1, true) $$,
  'a joke deleted 10 days ago is kept, and outlives its purged setup'
);
select ok(
  exists (select 1 from cron.job where jobname = 'purge-trash' and schedule = '23 3 * * *'),
  'the purge runs nightly with pg_cron'
);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}', true);
select throws_ok($$ select public.purge_trash() $$, '42501', null, 'users can''t run the purge');

-- Account deletion ----------------------------------------------------------
select throws_ok(
  $$ select public.delete_account('delete my account') $$,
  '42501', 'sign in again to confirm', 'deleting an account needs a recent sign-in'
);
select set_config('request.jwt.claims', json_build_object(
  'sub', '11111111-1111-4111-8111-111111111111', 'role', 'authenticated',
  'amr', json_build_array(json_build_object('method', 'oauth', 'timestamp', extract(epoch from now())::bigint - 600))
)::text, true);
select throws_ok(
  $$ select public.delete_account('delete my account') $$,
  '42501', 'sign in again to confirm', 'a sign-in 10 minutes ago is too old'
);
select set_config('request.jwt.claims', json_build_object(
  'sub', '11111111-1111-4111-8111-111111111111', 'role', 'authenticated',
  'amr', json_build_array(json_build_object('method', 'oauth', 'timestamp', extract(epoch from now())::bigint - 30))
)::text, true);
select throws_ok(
  $$ select public.delete_account('delete') $$,
  '22023', 'type "delete my account" to confirm', 'the confirmation phrase must match exactly'
);
select lives_ok($$ select public.delete_account('delete my account') $$, 'Alice can delete her account right after signing in');

reset role;
select is(
  (select count(*)::int from auth.users where id = '11111111-1111-4111-8111-111111111111')
  + (select count(*)::int from public.profiles where id = '11111111-1111-4111-8111-111111111111')
  + (select count(*)::int from public.topics where user_id = '11111111-1111-4111-8111-111111111111')
  + (select count(*)::int from public.setups where user_id = '11111111-1111-4111-8111-111111111111')
  + (select count(*)::int from public.jokes where user_id = '11111111-1111-4111-8111-111111111111')
  + (select count(*)::int from public.tags where user_id = '11111111-1111-4111-8111-111111111111'),
  0,
  'nothing of Alice''s remains'
);
select is(
  (select count(*)::int from public.tags where user_id = '22222222-2222-4222-8222-222222222222'),
  1,
  'Bob''s data is untouched'
);
set local role anon;
select set_config('request.jwt.claims', '{"role": "anon"}', true);
select throws_ok($$ select public.delete_account('delete my account') $$, '42501', null, 'anon can''t delete accounts');

select * from finish();
rollback;
