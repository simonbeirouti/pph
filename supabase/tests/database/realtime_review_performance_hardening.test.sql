begin;

select plan(14);

select has_function(
  'public',
  'list_employee_job_summary_rows',
  array[]::text[],
  'bounded employee job summary RPC exists'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.list_employee_job_summary_rows()',
    'EXECUTE'
  ),
  'active members can call the RLS-scoped summary RPC'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.list_employee_job_summary_rows()',
    'EXECUTE'
  ),
  'anonymous users cannot call the summary RPC'
);
select ok(
  exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'jobs'
      and indexname = 'jobs_organisation_active_updated_idx'
  ),
  'active jobs have a partial organisation/update index'
);

insert into public.jobs (
  organisation_id,
  assignee_membership_id,
  created_by,
  title
)
values (1001, 1103, 1101, 'Realtime parent target job');

delete from realtime.messages;
insert into public.job_updates (
  organisation_id,
  job_id,
  author_membership_id,
  body,
  type
)
select 1001, id, 1103, 'Parent target update', 'note'
from public.jobs
where title = 'Realtime parent target job';

select is(
  (
    select (payload ->> 'entityId')::bigint
    from realtime.messages
    where payload ->> 'domain' = 'job_update'
      and topic = 'org:1001:operations'
    limit 1
  ),
  (select id from public.jobs where title = 'Realtime parent target job'),
  'job update invalidations identify the parent job'
);

delete from realtime.messages;
insert into public.job_assets (
  organisation_id,
  job_id,
  mime_type,
  size_bytes,
  storage_path,
  submission_version,
  uploaded_by_membership_id
)
select 1001, id, 'image/jpeg', 1, 'realtime-parent-target.jpg', 0, 1103
from public.jobs
where title = 'Realtime parent target job';

select is(
  (
    select (payload ->> 'entityId')::bigint
    from realtime.messages
    where payload ->> 'domain' = 'evidence'
      and topic = 'org:1001:operations'
    limit 1
  ),
  (select id from public.jobs where title = 'Realtime parent target job'),
  'evidence invalidations identify the parent job'
);

delete from realtime.messages;
insert into public.job_notification_deliveries (
  organisation_id,
  job_id,
  recipient_email,
  status,
  submission_update_id
)
select 1001, job.id, 'reviewer@example.test', 'queued', update.id
from public.jobs as job
join public.job_updates as update on update.job_id = job.id
where job.title = 'Realtime parent target job';

select is(
  (
    select (payload ->> 'entityId')::bigint
    from realtime.messages
    where payload ->> 'domain' = 'review'
      and topic = 'org:1001:operations'
    limit 1
  ),
  (select id from public.jobs where title = 'Realtime parent target job'),
  'review invalidations identify the parent job'
);

delete from realtime.messages;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000002',
  true
);
select public.submit_job(
  (select id from public.jobs where title = 'Realtime parent target job')
);
reset role;

select is(
  (
    select status::text
    from public.jobs
    where title = 'Realtime parent target job'
  ),
  'in_review',
  'submission commits the job into review'
);
select is(
  (
    select count(*)
    from realtime.messages
    where payload ->> 'domain' in ('job', 'job_update', 'review')
      and (payload ->> 'entityId')::bigint <>
        (select id from public.jobs where title = 'Realtime parent target job')
  ),
  0::bigint,
  'all submission invalidations identify the parent job'
);
select is(
  (
    select count(distinct topic)
    from realtime.messages
    where payload ->> 'domain' in ('job', 'job_update')
      and topic in ('org:1001:operations', 'member:1103:work')
  ),
  2::bigint,
  'submission invalidates operations and assigned-worker topics'
);

insert into public.jobs (
  organisation_id,
  assignee_membership_id,
  created_by,
  title,
  status,
  archived_at,
  updated_at
)
select
  1001,
  1103,
  1101,
  format('Bounded archive %s', series),
  'archived',
  now(),
  now() - make_interval(mins => series)
from generate_series(1, 7) as series;

insert into public.jobs (
  organisation_id,
  assignee_membership_id,
  created_by,
  title
)
values (1001, 1103, 1101, 'Bounded active job');

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000001',
  true
);
select is(
  (
    select count(*)
    from public.list_employee_job_summary_rows()
    where title like 'Bounded archive %'
  ),
  5::bigint,
  'summary RPC returns at most five archived jobs per assignee'
);
select is(
  (
    select count(*)
    from public.list_employee_job_summary_rows()
    where title = 'Bounded active job'
  ),
  1::bigint,
  'summary RPC retains active jobs'
);
select is(
  (
    select count(*)
    from public.list_employee_job_summary_rows()
    where organisation_id <> 1001
  ),
  0::bigint,
  'summary RPC respects the caller organisation boundary'
);

reset role;
create function pg_temp.explain_active_jobs()
returns setof text
language plpgsql
as $$
begin
  return query execute $query$
    explain (costs off)
    select id
    from public.jobs
    where organisation_id = 1001
      and status <> 'archived'
    order by updated_at desc
  $query$;
end;
$$;
set local enable_seqscan = off;
select matches(
  (
    select string_agg(plan.line, E'\n')
    from pg_temp.explain_active_jobs() as plan(line)
  ),
  'jobs_organisation_active_updated_idx',
  'representative active-job query uses the partial index'
);

select * from finish();
rollback;
