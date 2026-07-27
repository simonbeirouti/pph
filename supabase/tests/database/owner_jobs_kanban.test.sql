begin;

select plan(30);

select has_table('public', 'roster_shifts', 'roster shifts prerequisite exists');
select has_table('public', 'jobs', 'jobs exists');
select has_table('public', 'job_updates', 'job updates exists');
select has_type('public', 'job_priority', 'job priority enum exists');
select has_type('public', 'job_status', 'job status enum exists');
select has_type('public', 'job_update_type', 'job update type enum exists');
select has_function(
  'public',
  'create_job',
  array[
    'text',
    'text',
    'text',
    'job_priority',
    'bigint',
    'timestamp with time zone',
    'timestamp with time zone',
    'boolean',
    'integer'
  ],
  'transactional job creation exists'
);
select has_function(
  'public',
  'reassign_job',
  array['bigint', 'bigint'],
  'transactional reassignment exists'
);
select has_function(
  'public',
  'update_job',
  array[
    'bigint',
    'text',
    'text',
    'text',
    'job_priority',
    'bigint',
    'timestamp with time zone',
    'timestamp with time zone',
    'boolean',
    'integer'
  ],
  'transactional job editing exists'
);

select throws_like(
  $$
    insert into public.jobs (
      organisation_id,
      title,
      scheduled_at,
      due_at,
      created_by
    )
    values (1001, 'Invalid times', now(), now() - interval '1 hour', 1101)
  $$,
  '%jobs_due_after_scheduled%',
  'due time cannot precede scheduled time'
);
select throws_like(
  $$
    insert into public.jobs (
      organisation_id,
      title,
      minimum_completion_photos,
      created_by
    )
    values (1001, 'Invalid evidence', 11, 1101)
  $$,
  '%jobs_minimum_completion_photos_range%',
  'completion photo count is constrained'
);
select throws_like(
  $$
    insert into public.roster_shifts (
      organisation_id,
      employee_membership_id,
      starts_at,
      ends_at,
      created_by
    )
    values (
      1001,
      1103,
      now() - interval '1 hour',
      now() + interval '1 hour',
      1101
    )
  $$,
  '%roster_shifts_no_active_overlap%',
  'active roster shifts cannot overlap'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000001',
  true
);
select lives_ok(
  $$
    select public.create_job(
      p_title => 'Database test job',
      p_assignee_membership_id => 1103,
      p_priority => 'high',
      p_minimum_completion_photos => 2
    )
  $$,
  'owner creates an assigned job'
);
select is(
  (
    select count(*)
    from public.job_updates
    where job_id = (select id from public.jobs where title = 'Database test job')
      and type = 'system'
  ),
  1::bigint,
  'creation writes one system audit event'
);
select is(
  (
    select count(*)
    from public.job_updates
    where job_id = (select id from public.jobs where title = 'Database test job')
      and type = 'assignment_change'
  ),
  1::bigint,
  'assigned creation writes assignment history'
);
select lives_ok(
  $$
    select public.reassign_job(
      (select id from public.jobs where title = 'Database test job'),
      1103
    )
  $$,
  'reassigning to the current employee is idempotent'
);
select is(
  (
    select count(*)
    from public.job_updates
    where job_id = (select id from public.jobs where title = 'Database test job')
  ),
  2::bigint,
  'idempotent reassignment creates no duplicate audit'
);
select is(
  (
    select (public.reassign_job(
      (select id from public.jobs where title = 'Database test job'),
      null
    )).status::text
  ),
  'assigned',
  'reassignment returns the job to assigned'
);
select is(
  (
    select metadata ->> 'previous_assignee_membership_id'
    from public.job_updates
    where job_id = (select id from public.jobs where title = 'Database test job')
      and type = 'assignment_change'
    order by id desc
    limit 1
  ),
  '1103',
  'assignment history records the previous assignee'
);
select is(
  (
    select (public.update_job(
      p_job_id => (select id from public.jobs where title = 'Database test job'),
      p_title => 'Edited database test job',
      p_description => 'Updated safely',
      p_priority => 'urgent'
    )).title
  ),
  'Edited database test job',
  'owner edits job details'
);
select is(
  (
    select count(*)
    from public.job_updates
    where job_id = (
      select id from public.jobs where title = 'Edited database test job'
    )
      and type = 'system'
      and metadata ->> 'event' = 'edited'
  ),
  1::bigint,
  'editing appends an immutable system audit event'
);

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000002',
  true
);
select throws_like(
  $$ select public.create_job(p_title => 'Forbidden') $$,
  '%owner membership required%',
  'employees cannot create jobs'
);
select throws_like(
  $$
    select public.update_job(
      p_job_id => (
        select id from public.jobs where title = 'Edited database test job'
      ),
      p_title => 'Forbidden edit'
    )
  $$,
  '%owner membership required%',
  'employees cannot edit jobs'
);
select is(
  (
    select count(*)
    from public.jobs
    where id in (1401, 1402, 1403, 1404)
  ),
  2::bigint,
  'employee sees only their assigned seeded jobs'
);
select ok(
  not has_table_privilege('authenticated', 'public.jobs', 'UPDATE'),
  'authenticated users cannot update jobs directly'
);

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000004',
  true
);
select is(
  (select count(*) from public.jobs where organisation_id = 1001),
  0::bigint,
  'cross-organisation owners cannot read jobs'
);

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000003',
  true
);
select is((select count(*) from public.jobs), 0::bigint, 'inactive users see no jobs');

reset role;
select throws_like(
  $$
    update public.job_updates
    set metadata = jsonb_build_object('tampered', true)
    where id = (select min(id) from public.job_updates)
  $$,
  '%job updates are append-only%',
  'job updates cannot be edited'
);
select is(
  (
    select count(*)
    from information_schema.role_table_grants
    where grantee = 'anon'
      and table_schema = 'public'
      and table_name in ('jobs', 'job_updates', 'roster_shifts')
  ),
  0::bigint,
  'anonymous receives no job or roster privileges'
);
select isnt_empty(
  $$
    select 1
    from pg_indexes
    where schemaname = 'public'
      and indexname = 'jobs_organisation_assignee_status_idx'
  $$,
  'board assignee and status lookups are indexed'
);

select * from finish();
rollback;
