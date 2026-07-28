begin;

select plan(44);

insert into public.roster_shifts (
  id,
  organisation_id,
  employee_membership_id,
  starts_at,
  ends_at,
  notes,
  created_by,
  archived_at
)
overriding system value
values
  (
    1391,
    1001,
    1103,
    '2030-07-01T22:00:00Z',
    '2030-07-02T02:00:00Z',
    'Overnight',
    1101,
    null
  ),
  (
    1392,
    1001,
    1103,
    '2030-07-02T02:00:00Z',
    '2030-07-02T03:00:00Z',
    'Adjacent',
    1101,
    null
  ),
  (
    1393,
    1001,
    1102,
    '2030-07-02T09:00:00Z',
    '2030-07-02T17:00:00Z',
    'Second employee',
    1101,
    null
  ),
  (
    1394,
    1001,
    1102,
    '2030-07-03T09:00:00Z',
    '2030-07-03T17:00:00Z',
    'Archived',
    1101,
    now()
  ),
  (
    2391,
    2001,
    2101,
    '2030-07-02T09:00:00Z',
    '2030-07-02T17:00:00Z',
    'Other organisation',
    2101,
    null
  ),
  (
    1395,
    1001,
    1103,
    '2031-07-02T11:00:00Z',
    '2031-07-02T12:00:00Z',
    'Update overlap target',
    1101,
    null
  ),
  (
    1396,
    1001,
    1103,
    '2000-01-03T09:00:00Z',
    '2000-01-03T17:00:00Z',
    'Historical shift',
    1101,
    null
  );

select lives_ok(
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
      '2030-07-02T03:00:00Z',
      '2030-07-02T04:00:00Z',
      1101
    )
  $$,
  'adjacent shifts are accepted'
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
      '2030-07-02T01:00:00Z',
      '2030-07-02T02:30:00Z',
      1101
    )
  $$,
  '%roster_shifts_no_active_overlap%',
  'overlapping shifts are rejected'
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
      '2030-07-02T05:00:00Z',
      '2030-07-02T04:00:00Z',
      1101
    )
  $$,
  '%roster_shifts_valid_range%',
  'invalid ranges are rejected'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000001',
  true
);
select results_eq(
  $$
    select id
    from public.roster_shifts
    where starts_at < '2030-07-03T00:00:00Z'
      and ends_at > '2030-07-02T00:00:00Z'
      and id in (1391, 1392, 1393)
    order by id
  $$,
  $$ values (1391::bigint), (1392::bigint), (1393::bigint) $$,
  'owner range reads include overnight intersections and all rostered employees'
);
select is(
  (select count(*) from public.roster_shifts where id = 1394),
  0::bigint,
  'archived shifts are hidden by RLS'
);
select is(
  (select count(*) from public.roster_shifts where id = 2391),
  0::bigint,
  'owner cannot read another organisation shift'
);
select lives_ok(
  $$
    insert into public.roster_shifts (
      organisation_id,
      employee_membership_id,
      starts_at,
      ends_at,
      notes,
      created_by
    )
    values (
      1001,
      1103,
      '2031-07-02T09:00:00Z',
      '2031-07-02T10:00:00Z',
      'Owner mutation test',
      1101
    )
  $$,
  'owner creates a shift for an active employee'
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
      1104,
      '2031-07-03T09:00:00Z',
      '2031-07-03T10:00:00Z',
      1101
    )
  $$,
  '%row-level security%',
  'owner cannot roster an inactive employee'
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
      2001,
      2101,
      '2031-07-03T09:00:00Z',
      '2031-07-03T10:00:00Z',
      1101
    )
  $$,
  '%row-level security%',
  'owner cannot roster a cross-organisation membership'
);
select lives_ok(
  $$
    update public.roster_shifts
    set starts_at = '2031-07-02T10:00:00Z',
        ends_at = '2031-07-02T11:00:00Z'
    where notes = 'Owner mutation test'
  $$,
  'owner exactly edits a shift to an adjacent range'
);
select throws_like(
  $$
    update public.roster_shifts
    set starts_at = '2031-07-02T10:30:00Z',
        ends_at = '2031-07-02T11:30:00Z'
    where notes = 'Owner mutation test'
  $$,
  '%roster_shifts_no_active_overlap%',
  'owner edits still enforce overlap exclusion'
);

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000002',
  true
);
select results_eq(
  $$
    select id
    from public.roster_shifts
    where id between 1391 and 1394
    order by id
  $$,
  $$ values (1391::bigint), (1392::bigint) $$,
  'employee reads only their own non-archived shifts'
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
      '2031-07-04T09:00:00Z',
      '2031-07-04T10:00:00Z',
      1103
    )
  $$,
  '%row-level security%',
  'employees cannot create shifts'
);
select is_empty(
  $$
    update public.roster_shifts
    set notes = 'Forbidden employee edit'
    where id = 1391
    returning id
  $$,
  'employees cannot edit shifts'
);

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000003',
  true
);
select is(
  (select count(*) from public.roster_shifts),
  0::bigint,
  'inactive memberships cannot read shifts'
);

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000004',
  true
);
select results_eq(
  $$ select id from public.roster_shifts where id in (1391, 2391) $$,
  $$ values (2391::bigint) $$,
  'cross-organisation owner reads only their organisation shift'
);

reset role;
select isnt_empty(
  $$
    select 1
    from pg_indexes
    where schemaname = 'public'
      and indexname = 'roster_shifts_organisation_starts_idx'
      and indexdef like '%WHERE (archived_at IS NULL)%'
  $$,
  'team range reads retain the partial organisation/start index'
);
select isnt_empty(
  $$
    select 1
    from pg_indexes
    where schemaname = 'public'
      and indexname = 'roster_shifts_employee_starts_idx'
      and indexdef like '%WHERE (archived_at IS NULL)%'
  $$,
  'employee range reads retain the partial employee/start index'
);

select has_function(
  'public',
  'create_roster_shift_with_jobs',
  array[
    'bigint',
    'timestamp with time zone',
    'timestamp with time zone',
    'text',
    'bigint[]'
  ],
  'transactional roster creation exists'
);
select has_function(
  'public',
  'archive_roster_shift',
  array['bigint', 'timestamp with time zone'],
  'version-aware roster archive exists'
);
select has_column(
  'public',
  'roster_shifts',
  'locked_at',
  'roster shifts expose lock state'
);
select has_column(
  'public',
  'roster_shifts',
  'locked_by',
  'roster shifts retain the locking owner'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000001',
  true
);

select lives_ok(
  $$
    update public.roster_shifts
    set notes = 'Historical shift remains editable'
    where id = 1396
  $$,
  'owners can edit an unlocked historical shift'
);
select lives_ok(
  $$
    update public.roster_shifts
    set locked_at = now(),
        locked_by = 1101
    where id = 1396
  $$,
  'owners can lock a historical shift'
);
select throws_like(
  $$
    update public.roster_shifts
    set notes = 'Forbidden locked edit'
    where id = 1396
  $$,
  '%locked roster shifts must be unlocked%',
  'locked shifts reject direct edits'
);
select throws_like(
  $$
    select public.archive_roster_shift(
      p_shift_id => 1396,
      p_expected_updated_at => (
        select updated_at from public.roster_shifts where id = 1396
      )
    )
  $$,
  '%shift is unavailable, locked, or changed%',
  'locked historical shifts reject deletion'
);
select lives_ok(
  $$
    update public.roster_shifts
    set locked_at = null,
        locked_by = null
    where id = 1396
  $$,
  'owners can unlock a shift without mutating its roster details'
);
select lives_ok(
  $$
    select public.archive_roster_shift(
      p_shift_id => 1396,
      p_expected_updated_at => (
        select updated_at from public.roster_shifts where id = 1396
      )
    )
  $$,
  'owners can delete an unlocked historical shift'
);

select lives_ok(
  $$
    select public.create_roster_shift_with_jobs(
      p_employee_membership_id => 1103,
      p_starts_at => '2035-08-04T23:00:00Z',
      p_ends_at => '2035-08-05T03:00:00Z',
      p_notes => 'Calendar transaction',
      p_job_ids => array[1402, 1401, 1402]::bigint[]
    )
  $$,
  'owner creates a shift and assigns distinct not-started jobs'
);
select is(
  (
    select count(*)
    from public.roster_shifts
    where notes = 'Calendar transaction'
      and employee_membership_id = 1103
  ),
  1::bigint,
  'calendar transaction creates one shift'
);
select is(
  (
    select count(*)
    from public.jobs
    where id in (1401, 1402)
      and assignee_membership_id = 1103
      and scheduled_at = '2035-08-04T23:00:00Z'
      and due_at = '2035-08-05T03:00:00Z'
  ),
  2::bigint,
  'selected jobs use the shift employee and times'
);
select is(
  (
    select count(*)
    from public.job_updates
    where job_id in (1401, 1402)
      and type = 'assignment_change'
      and metadata ->> 'new_assignee_membership_id' = '1103'
  ),
  1::bigint,
  'only the changed assignment receives assignment history'
);
select is(
  (
    select count(*)
    from public.job_updates
    where job_id in (1401, 1402)
      and type = 'system'
      and metadata ->> 'event' = 'scheduled_from_roster_shift'
      and (metadata ->> 'roster_shift_id')::bigint = (
        select id
        from public.roster_shifts
        where notes = 'Calendar transaction'
        order by id desc
        limit 1
      )
  ),
  2::bigint,
  'every selected job receives roster scheduling history'
);
select is(
  (
    select count(distinct (metadata ->> 'roster_shift_id'))
    from public.job_updates
    where job_id in (1401, 1402)
      and metadata ->> 'event' = 'scheduled_from_roster_shift'
      and (metadata ->> 'roster_shift_id')::bigint = (
        select id
        from public.roster_shifts
        where notes = 'Calendar transaction'
        order by id desc
        limit 1
      )
  ),
  1::bigint,
  'job history identifies the created roster shift'
);

select throws_like(
  $$
    select public.create_roster_shift_with_jobs(
      p_employee_membership_id => 1103,
      p_starts_at => '2035-08-06T00:00:00Z',
      p_ends_at => '2035-08-06T01:00:00Z',
      p_notes => 'Must roll back',
      p_job_ids => array[1403]::bigint[]
    )
  $$,
  '%one or more jobs are no longer available%',
  'review jobs are rejected'
);
select is(
  (
    select count(*)
    from public.roster_shifts
    where notes = 'Must roll back'
  ),
  0::bigint,
  'an ineligible job rolls back shift creation'
);
select throws_like(
  $$
    select public.create_roster_shift_with_jobs(
      p_employee_membership_id => 1104,
      p_starts_at => '2035-08-06T00:00:00Z',
      p_ends_at => '2035-08-06T01:00:00Z'
    )
  $$,
  '%employee must be active in the organisation%',
  'inactive employees are rejected'
);
select throws_like(
  $$
    select public.create_roster_shift_with_jobs(
      p_employee_membership_id => 1103,
      p_starts_at => '2035-08-05T02:00:00Z',
      p_ends_at => '2035-08-05T04:00:00Z'
    )
  $$,
  '%roster_shifts_no_active_overlap%',
  'calendar creation retains overlap enforcement'
);

select lives_ok(
  $$
    select public.archive_roster_shift(
      p_shift_id => (
        select id
        from public.roster_shifts
        where notes = 'Calendar transaction'
      ),
      p_expected_updated_at => (
        select updated_at
        from public.roster_shifts
        where notes = 'Calendar transaction'
      )
    )
  $$,
  'owner can archive an active employee shift'
);
select is(
  (
    select count(*)
    from public.roster_shifts
    where notes = 'Calendar transaction'
  ),
  0::bigint,
  'archived shifts fail closed for owner reads'
);

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000002',
  true
);
select throws_like(
  $$
    select public.create_roster_shift_with_jobs(
      p_employee_membership_id => 1103,
      p_starts_at => '2035-08-07T00:00:00Z',
      p_ends_at => '2035-08-07T01:00:00Z'
    )
  $$,
  '%owner membership required%',
  'employees cannot call the calendar transaction'
);
select throws_like(
  $$
    select public.archive_roster_shift(
      p_shift_id => 1301,
      p_expected_updated_at => now()
    )
  $$,
  '%owner membership required%',
  'employees cannot archive roster shifts'
);

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000004',
  true
);
select throws_like(
  $$
    select public.create_roster_shift_with_jobs(
      p_employee_membership_id => 1103,
      p_starts_at => '2035-08-07T00:00:00Z',
      p_ends_at => '2035-08-07T01:00:00Z'
    )
  $$,
  '%employee must be active in the organisation%',
  'cross-organisation employees are rejected'
);

reset role;
select is(
  (
    select count(*)
    from public.roster_shifts
    where notes = 'Calendar transaction'
      and archived_at is not null
  ),
  1::bigint,
  'archived shift history is retained'
);

select * from finish();
rollback;
