begin;

select plan(54);

select has_table('public', 'job_templates', 'job templates exist');
select has_table('public', 'job_schedules', 'job schedules exist');
select has_table('public', 'job_schedule_occurrences', 'occurrence ledger exists');
select has_type('public', 'job_schedule_recurrence', 'recurrence enum exists');
select has_type('public', 'job_schedule_occurrence_status', 'occurrence status enum exists');
select ok((select relrowsecurity from pg_class where oid = 'public.job_templates'::regclass), 'templates use RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.job_schedules'::regclass), 'schedules use RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.job_schedule_occurrences'::regclass), 'occurrences use RLS');
select ok(
  exists(select 1 from pg_constraint where conname = 'job_schedule_occurrences_schedule_at_unique'),
  'occurrences are idempotent'
);
select ok(
  exists(select 1 from pg_constraint where conname = 'jobs_schedule_organisation_fkey'),
  'job schedule provenance is organisation safe'
);
select is((select count(*) from cron.job where jobname = 'pph-generate-job-schedules'), 1::bigint, 'one scheduler cron is installed');

select is(
  private.next_job_schedule_occurrence(
    'daily', array[]::smallint[], '02:30', '2030-10-06', '2030-10-06',
    'Australia/Melbourne', '2030-10-05T00:00:00Z'
  ),
  '2030-10-05T16:30:00Z'::timestamptz,
  'spring gap shifts forward using PostgreSQL timezone rules'
);
select is(
  private.next_job_schedule_occurrence(
    'daily', array[]::smallint[], '02:30', '2030-04-07', '2030-04-07',
    'Australia/Melbourne', '2030-04-06T00:00:00Z'
  ),
  '2030-04-06T16:30:00Z'::timestamptz,
  'repeated time resolves once using standard time'
);

select throws_like(
  $$
    insert into public.job_templates (
      id, organisation_id, title, assignee_membership_id, created_by
    ) overriding system value values (8991, 1001, 'Foreign assignee', 2101, 1101)
  $$,
  '%job_templates_assignee_organisation_fkey%',
  'template assignee cannot cross organisations'
);
select throws_like(
  $$
    insert into public.job_schedules (
      organisation_id, template_id, assignee_membership_id, recurrence_type,
      weekdays, local_time, starts_on, timezone, is_enabled, next_occurrence_at,
      created_by
    ) values (
      1001, 2991, 1103, 'daily', '{}', '09:00', '2035-01-01',
      'Australia/Melbourne', true, '2034-12-31T22:00:00Z', 1101
    )
  $$,
  '%job_schedules_template_organisation_fkey%',
  'schedule template cannot cross organisations'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);

select lives_ok(
  $$
    select public.create_job_template(
      p_title => 'S08 recurring clean',
      p_description => 'Clean the entry',
      p_location => 'Front foyer',
      p_priority => 'high',
      p_assignee_membership_id => 1103,
      p_requires_completion_note => true,
      p_minimum_completion_photos => 2
    )
  $$,
  'owner creates a reusable template'
);
select lives_ok(
  $$
    select public.create_job_schedule(
      p_template_id => (select id from public.job_templates where title = 'S08 recurring clean'),
      p_assignee_membership_id => 1103,
      p_recurrence_type => 'weekly',
      p_weekdays => array[1,3,5]::smallint[],
      p_local_time => '09:00',
      p_starts_on => '2035-01-01',
      p_ends_on => '2035-01-31'
    )
  $$,
  'owner creates a multi-weekday schedule'
);
select lives_ok(
  $$ select public.create_job_template(p_title => 'S08 unassigned recurring work') $$,
  'owner creates a template for unassigned recurring work'
);
select lives_ok(
  $$
    select public.create_job_schedule(
      p_template_id => (
        select id from public.job_templates
        where title = 'S08 unassigned recurring work'
      ),
      p_assignee_membership_id => null,
      p_recurrence_type => 'daily',
      p_weekdays => array[]::smallint[],
      p_local_time => '09:00',
      p_starts_on => '2035-01-01',
      p_ends_on => '2035-01-01'
    )
  $$,
  'owner creates an unassigned schedule'
);
select lives_ok(
  $$
    select public.create_job(
      p_title => 'Manual override',
      p_priority => 'urgent',
      p_template_id => (select id from public.job_templates where title = 'S08 recurring clean')
    )
  $$,
  'manual job accepts a template and overrides defaults'
);
select is(
  (select template_id from public.jobs where title = 'Manual override'),
  (select id from public.job_templates where title = 'S08 recurring clean'),
  'manual job stores template provenance'
);
select lives_ok(
  $$
    select public.upsert_job_template(
      p_template_id => (select id from public.job_templates where title = 'S08 recurring clean'),
      p_title => 'S08 updated clean',
      p_description => 'Updated future default',
      p_assignee_membership_id => 1103
    )
  $$,
  'template defaults can be edited'
);
select is((select title from public.jobs where title = 'Manual override'), 'Manual override', 'existing jobs remain immutable after template edits');
select lives_ok(
  $$ select public.set_job_template_active((select id from public.job_templates where title = 'S08 updated clean'), false) $$,
  'template can be deactivated'
);
select throws_like(
  $$
    select public.create_job(
      p_title => 'Inactive template job',
      p_template_id => (select id from public.job_templates where title = 'S08 updated clean')
    )
  $$,
  '%template must be active%',
  'inactive templates cannot create new manual jobs'
);
select ok(
  (
    select schedule.is_enabled
    from public.job_schedules as schedule
    join public.job_templates as template on template.id = schedule.template_id
    where template.title = 'S08 updated clean'
  ),
  'deactivation does not pause an existing schedule'
);
select lives_ok(
  $$
    select public.set_job_schedule_enabled((
      select schedule.id
      from public.job_schedules as schedule
      join public.job_templates as template on template.id = schedule.template_id
      where template.title = 'S08 updated clean'
    ), false)
  $$,
  'schedule can be paused'
);
select is(
  (
    select schedule.next_occurrence_at
    from public.job_schedules as schedule
    join public.job_templates as template on template.id = schedule.template_id
    where template.title = 'S08 updated clean'
  ),
  null::timestamptz,
  'pausing clears the occurrence cursor'
);
select lives_ok(
  $$
    select public.set_job_schedule_enabled((
      select schedule.id
      from public.job_schedules as schedule
      join public.job_templates as template on template.id = schedule.template_id
      where template.title = 'S08 updated clean'
    ), true)
  $$,
  'schedule can be resumed without backfill'
);
select lives_ok(
  $$ select public.create_job_template(p_title => 'S08 inclusive end') $$,
  'owner creates an inclusive-end template'
);
select lives_ok(
  $$
    select public.create_job_schedule(
      p_template_id => (select id from public.job_templates where title = 'S08 inclusive end'),
      p_assignee_membership_id => 1103,
      p_recurrence_type => 'daily',
      p_weekdays => array[]::smallint[],
      p_local_time => '09:00',
      p_starts_on => '2035-01-01',
      p_ends_on => '2035-01-01'
    )
  $$,
  'inclusive end date retains its final occurrence'
);
select lives_ok(
  $$ select public.create_job_template(p_title => 'S08 retry failure') $$,
  'owner creates a retry template'
);
select lives_ok(
  $$
    select public.create_job_schedule(
      p_template_id => (select id from public.job_templates where title = 'S08 retry failure'),
      p_assignee_membership_id => 1103,
      p_recurrence_type => 'daily',
      p_weekdays => array[]::smallint[],
      p_local_time => '09:00',
      p_starts_on => '2035-01-02',
      p_ends_on => '2035-01-02'
    )
  $$,
  'owner creates a schedule that can exercise retry'
);

set local role service_role;
select lives_ok($$ select public.run_due_job_schedules('2035-01-01T00:00:00Z', 100) $$, 'production generator processes due work');
select lives_ok($$ select public.run_due_job_schedules('2035-01-01T00:00:00Z', 100) $$, 'repeated generator invocation is safe');
select is(
  (
    select count(*)
    from public.jobs as job
    join public.job_schedules as schedule on schedule.id = job.schedule_id
    join public.job_templates as template on template.id = schedule.template_id
    where template.title = 'S08 updated clean'
  ),
  1::bigint,
  'repeated generation creates one job'
);
select is(
  (
    select count(*)
    from public.job_schedule_occurrences as occurrence
    join public.job_schedules as schedule on schedule.id = occurrence.schedule_id
    join public.job_templates as template on template.id = schedule.template_id
    where template.title = 'S08 updated clean'
  ),
  1::bigint,
  'repeated generation creates one ledger record'
);
select is(
  (
    select count(*)
    from public.job_updates as update
    join public.jobs as job on job.id = update.job_id
    join public.job_schedules as schedule on schedule.id = job.schedule_id
    join public.job_templates as template on template.id = schedule.template_id
    where template.title = 'S08 updated clean'
  ),
  2::bigint,
  'generated job includes system and assignment audit events'
);
select is(
  (
    select schedule.next_occurrence_at
    from public.job_schedules as schedule
    join public.job_templates as template on template.id = schedule.template_id
    where template.title = 'S08 inclusive end'
  ),
  null::timestamptz,
  'completed schedules have no future cursor'
);
select is(
  (
    select count(*)
    from public.jobs as job
    join public.job_templates as template on template.id = job.template_id
    where template.title = 'S08 inclusive end'
  ),
  1::bigint,
  'inclusive final occurrence generates exactly one job'
);
select is(
  (
    select job.assignee_membership_id
    from public.jobs as job
    join public.job_templates as template on template.id = job.template_id
    where template.title = 'S08 unassigned recurring work'
  ),
  null::bigint,
  'unassigned schedules generate unassigned jobs'
);
select is(
  (
    select occurrence.status::text
    from public.job_schedule_occurrences as occurrence
    join public.job_schedules as schedule on schedule.id = occurrence.schedule_id
    join public.job_templates as template on template.id = schedule.template_id
    where template.title = 'S08 unassigned recurring work'
  ),
  'generated',
  'unassigned schedule occurrences are generated successfully'
);
select lives_ok(
  $$
    update public.memberships
    set status = 'inactive', deactivated_at = clock_timestamp()
    where id = 1103
  $$,
  'test assignee can be made inactive'
);
select lives_ok(
  $$ select public.run_due_job_schedules('2035-01-01T23:00:00Z', 100) $$,
  'generator records failure without rolling back the ledger'
);
select is(
  (
    select occurrence.status::text
    from public.job_schedule_occurrences as occurrence
    join public.job_schedules as schedule on schedule.id = occurrence.schedule_id
    join public.job_templates as template on template.id = schedule.template_id
    where template.title = 'S08 retry failure'
  ),
  'failed',
  'failed generation persists outside the failed job subtransaction'
);
select is(
  (
    select occurrence.attempt_count
    from public.job_schedule_occurrences as occurrence
    join public.job_schedules as schedule on schedule.id = occurrence.schedule_id
    join public.job_templates as template on template.id = schedule.template_id
    where template.title = 'S08 retry failure'
  ),
  1,
  'failed generation records its retry count'
);
select lives_ok(
  $$
    update public.memberships
    set status = 'active', deactivated_at = null
    where id = 1103
  $$,
  'test assignee can be restored'
);
select lives_ok(
  $$ select public.run_due_job_schedules('2035-01-01T23:00:00Z', 100) $$,
  'enabled failed occurrence retries automatically'
);
select is(
  (
    select occurrence.status::text
    from public.job_schedule_occurrences as occurrence
    join public.job_schedules as schedule on schedule.id = occurrence.schedule_id
    join public.job_templates as template on template.id = schedule.template_id
    where template.title = 'S08 retry failure'
  ),
  'generated',
  'automatic retry links the occurrence to a generated job'
);
select is(
  (
    select occurrence.attempt_count
    from public.job_schedule_occurrences as occurrence
    join public.job_schedules as schedule on schedule.id = occurrence.schedule_id
    join public.job_templates as template on template.id = schedule.template_id
    where template.title = 'S08 retry failure'
  ),
  2,
  'successful retry retains the full attempt count'
);
select is(
  (
    select count(*)
    from public.jobs as job
    join public.job_templates as template on template.id = job.template_id
    where template.title = 'S08 retry failure'
  ),
  1::bigint,
  'failure and retry still create exactly one job'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);
select is((select count(*) from public.job_templates), 0::bigint, 'employees cannot read templates');
select is((select count(*) from public.job_schedules), 0::bigint, 'employees cannot read schedules');
select is((select count(*) from public.job_schedule_occurrences), 0::bigint, 'employees cannot read occurrence history');

select * from finish();
rollback;
