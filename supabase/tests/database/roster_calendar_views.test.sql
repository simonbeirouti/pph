begin;

select plan(18);

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

select * from finish();
rollback;
