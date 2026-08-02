begin;

select plan(7);

select has_column(
  'public',
  'organisation_sync_changes',
  'related_job_id',
  'the private sync feed records a parent job target'
);

insert into public.jobs (
  organisation_id,
  assignee_membership_id,
  created_by,
  title
)
values (1001, 1101, 1101, 'Offline sync target test job');

insert into public.job_updates (
  organisation_id,
  job_id,
  author_membership_id,
  body,
  type
)
select 1001, id, 1101, 'Targeted detail change', 'note'
from public.jobs
where title = 'Offline sync target test job';

insert into public.job_assets (
  organisation_id,
  job_id,
  mime_type,
  size_bytes,
  storage_path,
  submission_version,
  uploaded_by_membership_id
)
select
  1001,
  id,
  'image/jpeg',
  1,
  'offline-sync-target-test.jpg',
  0,
  1101
from public.jobs
where title = 'Offline sync target test job';

insert into public.job_notification_deliveries (
  organisation_id,
  job_id,
  recipient_email,
  status,
  submission_update_id
)
select
  1001,
  job.id,
  'owner@example.test',
  'queued',
  update.id
from public.jobs as job
join public.job_updates as update
  on update.job_id = job.id
  and update.type = 'note'
where job.title = 'Offline sync target test job';

select is(
  (
    select related_job_id
    from public.organisation_sync_changes
    where entity_type = 'jobs'
      and entity_id = (
        select id from public.jobs where title = 'Offline sync target test job'
      )
    order by revision desc
    limit 1
  ),
  (
    select id from public.jobs where title = 'Offline sync target test job'
  ),
  'job changes target their own job detail'
);

select is(
  (
    select related_job_id
    from public.organisation_sync_changes
    where entity_type = 'job_updates'
      and entity_id = (
        select id
        from public.job_updates
        where body = 'Targeted detail change'
      )
    order by revision desc
    limit 1
  ),
  (
    select id from public.jobs where title = 'Offline sync target test job'
  ),
  'job update changes target their parent job detail'
);

select is(
  (
    select related_job_id
    from public.organisation_sync_changes
    where entity_type = 'job_assets'
      and entity_id = (
        select id
        from public.job_assets
        where storage_path = 'offline-sync-target-test.jpg'
      )
    order by revision desc
    limit 1
  ),
  (
    select id from public.jobs where title = 'Offline sync target test job'
  ),
  'job asset changes target their parent job detail'
);

select is(
  (
    select related_job_id
    from public.organisation_sync_changes
    where entity_type = 'job_notification_deliveries'
      and entity_id = (
        select id
        from public.job_notification_deliveries
        where recipient_email = 'owner@example.test'
      )
    order by revision desc
    limit 1
  ),
  (
    select id from public.jobs where title = 'Offline sync target test job'
  ),
  'notification deliveries target their parent job detail'
);

insert into public.organisations (name, timezone)
values ('Offline sync isolation test organisation', 'Australia/Melbourne');

insert into public.organisation_sync_changes (
  entity_id,
  entity_type,
  operation,
  organisation_id,
  related_job_id
)
select id, 'job_updates', 'upsert', id, 999999
from public.organisations
where name = 'Offline sync isolation test organisation';

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000001',
  true
);
select is(
  (
    select related_job_id
    from public.get_offline_sync_changes(0)
    where entity_type = 'job_updates'
      and entity_id = (
        select id
        from public.job_updates
        where body = 'Targeted detail change'
      )
    limit 1
  ),
  (
    select id from public.jobs where title = 'Offline sync target test job'
  ),
  'the role-scoped RPC exposes only the authorised parent job target'
);

select is(
  (
    select count(*)
    from public.get_offline_sync_changes(0)
    where related_job_id = 999999
  ),
  0::bigint,
  'the role-scoped RPC does not expose a different organisation parent job target'
);

select * from finish();
rollback;
