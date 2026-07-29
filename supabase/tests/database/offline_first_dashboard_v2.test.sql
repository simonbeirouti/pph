begin;

select plan(14);

select has_table(
  'public',
  'organisation_sync_changes',
  'offline v2 has an organisation revision feed'
);
select has_table(
  'public',
  'offline_operation_receipts',
  'offline v2 has a general receipt ledger'
);
select has_function(
  'public',
  'get_offline_sync_changes',
  array['bigint'],
  'role-filtered incremental sync is exposed'
);
select has_function(
  'public',
  'claim_offline_operation',
  array['uuid', 'text', 'text', 'text'],
  'general operation UUIDs can be reserved'
);
select has_function(
  'public',
  'complete_offline_operation',
  array['uuid', 'jsonb'],
  'general operation results can be completed'
);
select ok(
  not has_table_privilege(
    'authenticated',
    'public.offline_operation_receipts',
    'INSERT'
  ),
  'clients cannot forge general operation receipts'
);
select has_column('public', 'memberships', 'version', 'memberships are versioned');
select has_column(
  'public',
  'roster_shifts',
  'version',
  'roster shifts are versioned'
);
select has_column(
  'public',
  'job_templates',
  'version',
  'templates are versioned'
);
select has_column(
  'public',
  'job_schedules',
  'version',
  'schedules are versioned'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000001',
  true
);

select is(
  (
    select claimed
    from public.claim_offline_operation(
      '30000000-0000-4000-8000-000000000001',
      'profile',
      '1101',
      'profile.update'
    )
  ),
  true,
  'the first replay reserves its UUID'
);
select is(
  (
    select claimed
    from public.claim_offline_operation(
      '30000000-0000-4000-8000-000000000001',
      'profile',
      '1101',
      'profile.update'
    )
  ),
  false,
  'a concurrent or repeated replay cannot reserve the UUID twice'
);
select is(
  public.complete_offline_operation(
    '30000000-0000-4000-8000-000000000001',
    '{"status":"acknowledged","version":2}'::jsonb
  ) ->> 'status',
  'acknowledged',
  'the authoritative replay result is retained'
);

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000002',
  true
);
select lives_ok(
  $$ select * from public.get_offline_sync_changes(0) $$,
  'an employee can read the role-filtered incremental feed'
);

select * from finish();
rollback;
