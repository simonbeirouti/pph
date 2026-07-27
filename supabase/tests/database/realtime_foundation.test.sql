begin;

select plan(27);

select has_function(
  'private',
  'send_realtime_invalidation',
  array['text', 'text', 'text', 'bigint'],
  'private realtime sender exists'
);
select has_function(
  'private',
  'broadcast_realtime_invalidation',
  array['bigint', 'bigint[]', 'text', 'text', 'bigint'],
  'reusable realtime broadcast helper exists'
);
select has_trigger(
  'public',
  'memberships',
  'memberships_broadcast_realtime',
  'membership changes broadcast'
);
select has_trigger(
  'public',
  'employee_profiles',
  'employee_profiles_broadcast_realtime',
  'employee profile changes broadcast'
);
select has_trigger(
  'public',
  'jobs',
  'jobs_broadcast_realtime',
  'job changes broadcast'
);
select has_trigger(
  'public',
  'job_updates',
  'job_updates_broadcast_realtime',
  'job update changes broadcast'
);
select has_trigger(
  'public',
  'roster_shifts',
  'roster_shifts_broadcast_realtime',
  'roster changes broadcast'
);

delete from realtime.messages;
select private.send_realtime_invalidation(
  'org:1001:operations',
  'job',
  'update',
  1401
);
select private.send_realtime_invalidation(
  'member:1103:work',
  'job',
  'update',
  1401
);
select private.send_realtime_invalidation(
  'org:2001:operations',
  'job',
  'update',
  2401
);
select private.send_realtime_invalidation(
  'member:1104:work',
  'job',
  'update',
  1404
);

select is(
  (
    select count(*)
    from realtime.messages
    where event = 'invalidate'
      and extension = 'broadcast'
      and private is true
  ),
  4::bigint,
  'helper emits private invalidation broadcasts'
);
select is(
  (
    select payload - 'id'
    from realtime.messages
    where topic = 'org:1001:operations'
    limit 1
  ) ?& array[
    'version',
    'eventId',
    'domain',
    'action',
    'entityId',
    'occurredAt'
  ],
  true,
  'payload contains the versioned invalidation contract'
);
select is(
  (
    select payload ?| array[
      'email',
      'phone',
      'description',
      'notes',
      'evidence'
    ]
    from realtime.messages
    where topic = 'org:1001:operations'
    limit 1
  ),
  false,
  'payload excludes user and job content'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000001',
  true
);
select set_config('realtime.topic', 'org:1001:operations', true);
select is(
  (
    select count(*)
    from realtime.messages
    where topic = realtime.topic()
  ),
  1::bigint,
  'owner receives their organisation topic'
);
select set_config('realtime.topic', 'member:1103:work', true);
select is(
  (
    select count(*)
    from realtime.messages
    where topic = realtime.topic()
  ),
  0::bigint,
  'owner cannot join an employee topic'
);
select set_config('realtime.topic', 'org:2001:operations', true);
select is(
  (select count(*) from realtime.messages),
  0::bigint,
  'owner cannot join another organisation topic'
);

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000002',
  true
);
select set_config('realtime.topic', 'member:1103:work', true);
select is(
  (
    select count(*)
    from realtime.messages
    where topic = realtime.topic()
  ),
  1::bigint,
  'employee receives their own work topic'
);
select set_config('realtime.topic', 'member:1104:work', true);
select is(
  (select count(*) from realtime.messages),
  0::bigint,
  'employee cannot join another member topic'
);
select set_config('realtime.topic', 'org:1001:operations', true);
select is(
  (select count(*) from realtime.messages),
  0::bigint,
  'employee cannot join the organisation operations topic'
);

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000003',
  true
);
select set_config('realtime.topic', 'member:1104:work', true);
select is(
  (select count(*) from realtime.messages),
  0::bigint,
  'inactive employee receives no realtime messages'
);

reset role;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select set_config('realtime.topic', 'org:1001:operations', true);
select is(
  (select count(*) from realtime.messages),
  0::bigint,
  'anonymous users receive no realtime messages'
);

reset role;
delete from realtime.messages;
update public.memberships
set invite_delivery_status = 'sent'
where id = 1102;
select is(
  (
    select count(*)
    from realtime.messages
    where payload ->> 'domain' = 'membership'
      and topic in ('org:1001:operations', 'member:1102:work')
  ),
  2::bigint,
  'membership change invalidates organisation and member topics'
);

delete from realtime.messages;
update public.employee_profiles
set job_title = 'Senior Operator'
where id = 1202;
select is(
  (
    select count(*)
    from realtime.messages
    where payload ->> 'domain' = 'employee_profile'
      and topic in ('org:1001:operations', 'member:1103:work')
  ),
  2::bigint,
  'profile change invalidates organisation and member topics'
);

delete from realtime.messages;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000001',
  true
);
select public.reassign_job(1401, null);
reset role;
select is(
  (
    select count(*)
    from realtime.messages
    where payload ->> 'domain' = 'job'
      and topic in ('org:1001:operations', 'member:1103:work')
  ),
  2::bigint,
  'reassignment invalidates the organisation and previous assignee'
);

delete from realtime.messages;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000001',
  true
);
select public.reassign_job(1401, 1103);
reset role;
select is(
  (
    select count(*)
    from realtime.messages
    where payload ->> 'domain' = 'job'
      and topic in ('org:1001:operations', 'member:1103:work')
  ),
  2::bigint,
  'assignment invalidates the organisation and new assignee'
);

delete from realtime.messages;
update public.roster_shifts
set notes = 'Realtime roster update'
where id = 1301;
select is(
  (
    select count(*)
    from realtime.messages
    where payload ->> 'domain' = 'roster'
      and topic in ('org:1001:operations', 'member:1103:work')
  ),
  2::bigint,
  'roster change invalidates organisation and employee topics'
);

delete from realtime.messages;
insert into public.job_updates (
  organisation_id,
  job_id,
  author_membership_id,
  type,
  metadata
)
values (1001, 1401, 1101, 'comment', '{"test":true}');
select is(
  (
    select count(*)
    from realtime.messages
    where payload ->> 'domain' = 'job_update'
      and topic in ('org:1001:operations', 'member:1103:work')
  ),
  2::bigint,
  'job update invalidates organisation and assignee topics'
);

delete from realtime.messages;
savepoint before_realtime_rollback;
select private.send_realtime_invalidation(
  'org:1001:operations',
  'dashboard',
  'update',
  1001
);
rollback to savepoint before_realtime_rollback;
select is(
  (select count(*) from realtime.messages),
  0::bigint,
  'rolled back work leaves no committed invalidation'
);

select throws_like(
  $$
    select private.send_realtime_invalidation(
      'org:1001:operations',
      'private_note',
      'update',
      1
    )
  $$,
  '%invalid realtime invalidation%',
  'unsupported domains are rejected'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'private.send_realtime_invalidation(text,text,text,bigint)',
    'EXECUTE'
  ),
  'clients cannot invoke the private sender'
);

select * from finish();
rollback;
