begin;

select plan(12);

select has_table(
  'public',
  'web_push_subscriptions',
  'web push subscriptions are durable'
);
select has_table(
  'public',
  'push_notification_events',
  'push events are durable'
);
select has_table(
  'public',
  'push_notification_deliveries',
  'push delivery attempts are durable'
);
select ok(
  not has_table_privilege(
    'authenticated',
    'public.push_notification_deliveries',
    'INSERT'
  ),
  'clients cannot forge push deliveries'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000002',
  true
);
insert into public.web_push_subscriptions (
  organisation_id,
  membership_id,
  endpoint,
  p256dh,
  auth
)
values (1001, 1103, 'https://push.example.test/employee', 'p256dh', 'auth');
select is(
  (
    select count(*)
    from public.web_push_subscriptions
    where membership_id = 1103
      and active
  ),
  1::bigint,
  'an active member can register their browser'
);

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000001',
  true
);
insert into public.web_push_subscriptions (
  organisation_id,
  membership_id,
  endpoint,
  p256dh,
  auth
)
values (1001, 1101, 'https://push.example.test/owner', 'p256dh', 'auth');
select public.create_job(
  p_title => 'Push recipient test',
  p_assignee_membership_id => 1103
);

reset role;
select is(
  (
    select count(*)
    from public.push_notification_deliveries delivery
    join public.push_notification_events event on event.id = delivery.event_id
    where event.event_type = 'job_assignment'
      and event.job_id = (
        select id from public.jobs where title = 'Push recipient test'
      )
      and delivery.recipient_membership_id = 1103
  ),
  1::bigint,
  'job assignment queues the affected worker once'
);
select is(
  (
    select count(*)
    from public.push_notification_deliveries delivery
    join public.push_notification_events event on event.id = delivery.event_id
    where event.event_type = 'job_assignment'
      and event.job_id = (
        select id from public.jobs where title = 'Push recipient test'
      )
      and delivery.recipient_membership_id = 1101
  ),
  0::bigint,
  'the assigning actor is excluded'
);
select is(
  (
    select label
    from public.push_notification_events
    where job_id = (select id from public.jobs where title = 'Push recipient test')
      and event_type = 'job_assignment'
  ),
  'Job assigned',
  'the stored payload label contains no job details'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000002',
  true
);
select public.start_job(
  (select id from public.jobs where title = 'Push recipient test')
);
select public.submit_job(
  (select id from public.jobs where title = 'Push recipient test')
);

reset role;
select is(
  (
    select count(*)
    from public.push_notification_deliveries delivery
    join public.push_notification_events event on event.id = delivery.event_id
    where event.event_type = 'job_submission'
      and event.job_id = (
        select id from public.jobs where title = 'Push recipient test'
      )
      and delivery.recipient_membership_id = 1101
  ),
  1::bigint,
  'submission queues the eligible reviewer'
);
select is(
  (
    select count(*)
    from public.push_notification_deliveries delivery
    join public.push_notification_events event on event.id = delivery.event_id
    where event.event_type = 'job_submission'
      and event.job_id = (
        select id from public.jobs where title = 'Push recipient test'
      )
      and delivery.recipient_membership_id = 1103
  ),
  0::bigint,
  'submission excludes its actor'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000001',
  true
);
select public.create_roster_shift_with_jobs(
  1103,
  now() + interval '30 days',
  now() + interval '30 days 8 hours',
  '',
  '{}'::bigint[]
);

reset role;
select is(
  (
    select count(*)
    from public.push_notification_deliveries delivery
    join public.push_notification_events event on event.id = delivery.event_id
    where event.event_type = 'roster_assignment'
      and delivery.recipient_membership_id = 1103
      and event.roster_shift_id = (
        select max(id) from public.roster_shifts
        where starts_at > now() + interval '29 days'
      )
  ),
  1::bigint,
  'roster assignment queues the affected employee'
);
select is(
  (
    select count(*)
    from (
      select event_id, subscription_id
      from public.push_notification_deliveries
      group by event_id, subscription_id
      having count(*) > 1
    ) duplicates
  ),
  0::bigint,
  'event and device deliveries are deduplicated'
);

select * from finish();
rollback;
