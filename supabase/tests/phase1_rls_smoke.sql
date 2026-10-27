\set ON_ERROR_STOP 1
insert into auth.users(id, raw_user_meta_data) values ('11111111-1111-1111-1111-111111111111','{"full_name":"Alice"}'),('22222222-2222-2222-2222-222222222222','{}');
select id, display_name from public.profiles order by id;
grant select, insert, update, delete on all tables in schema public to authenticated;
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
insert into topics(title) values ('Airports') returning id \gset
insert into associations(topic_id, text) values (:'id','TSA'),(:'id','layover');
insert into setups(topic_id, text) values (:'id',''),(:'id','I flew in from Chicago.');
select t.title, association_count, setup_count, t.last_activity_at > topics.created_at as touched from topic_stats t join topics on topics.id = t.topic_id;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select count(*) as bob_sees from topic_stats;
\set ON_ERROR_STOP 0
insert into setups(topic_id, text) values (:'id','sneaky');
insert into setups(topic_id, user_id, text) values (:'id','11111111-1111-1111-1111-111111111111','sneaky2');
update topics set title='hacked' where id = :'id';
select count(*) as updated_hacked from topics where title = 'hacked';
