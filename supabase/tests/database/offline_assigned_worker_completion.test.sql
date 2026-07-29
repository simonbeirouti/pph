begin;

select plan(15);

select has_column('public', 'jobs', 'version', 'jobs expose a canonical version');
select has_table(
  'public',
  'job_operation_receipts',
  'offline replay has an operation receipt ledger'
);
select col_is_pk(
  'public',
  'job_operation_receipts',
  'id',
  'operation receipts have a primary key'
);
select has_function(
  'public',
  'replay_job_operation',
  array['bigint', 'uuid', 'integer', 'job_operation_type', 'jsonb'],
  'the typed offline replay RPC exists'
);
select ok(
  not has_table_privilege(
    'authenticated',
    'public.job_operation_receipts',
    'INSERT'
  ),
  'clients cannot forge operation receipts'
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
      p_title => 'S11 replay journey',
      p_assignee_membership_id => 1103,
      p_requires_completion_note => true
    )
  $$,
  'owner creates an assigned offline-capable job'
);

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000002',
  true
);
select is(
  (
    select operation_status
    from public.replay_job_operation(
      (select id from public.jobs where title = 'S11 replay journey'),
      '10000000-0000-4000-8000-000000000001',
      (select version from public.jobs where title = 'S11 replay journey'),
      'start',
      '{}'::jsonb
    )
  ),
  'acknowledged',
  'employee replays an offline start'
);
select is(
  (
    select operation_status
    from public.replay_job_operation(
      (select id from public.jobs where title = 'S11 replay journey'),
      '10000000-0000-4000-8000-000000000001',
      1,
      'start',
      '{}'::jsonb
    )
  ),
  'acknowledged',
  'replaying an acknowledged UUID returns its receipt'
);
select is(
  (
    select count(*)
    from public.job_operation_receipts
    where client_operation_id = '10000000-0000-4000-8000-000000000001'
  ),
  1::bigint,
  'repeated start creates one receipt'
);
select is(
  (
    select count(*)
    from public.job_updates
    where job_id = (select id from public.jobs where title = 'S11 replay journey')
      and metadata ->> 'client_operation_id' =
        '10000000-0000-4000-8000-000000000001'
  ),
  1::bigint,
  'repeated start creates one audit event'
);
select is(
  (
    select operation_status
    from public.replay_job_operation(
      (select id from public.jobs where title = 'S11 replay journey'),
      '10000000-0000-4000-8000-000000000002',
      1,
      'note',
      '{"body":"Merged field note"}'::jsonb
    )
  ),
  'acknowledged',
  'a stale note safely merges while assignment remains valid'
);
select is(
  (
    select operation_status
    from public.replay_job_operation(
      (select id from public.jobs where title = 'S11 replay journey'),
      '10000000-0000-4000-8000-000000000003',
      1,
      'submit',
      '{}'::jsonb
    )
  ),
  'conflict',
  'submission returns a typed version conflict'
);

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000001',
  true
);
select lives_ok(
  $$
    select public.reassign_job(
      p_job_id => (select id from public.jobs where title = 'S11 replay journey'),
      p_assignee_membership_id => null
    )
  $$,
  'owner reassigns the job'
);

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000002',
  true
);
select is(
  (
    select operation_status
    from public.replay_job_operation(
      (select id from public.jobs where title = 'S11 replay journey'),
      '10000000-0000-4000-8000-000000000004',
      1,
      'note',
      '{"body":"Preserve locally"}'::jsonb
    )
  ),
  'needs_attention',
  'reassigned work stops replay with a recoverable state'
);
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000001',
  true
);
select cmp_ok(
  (
    select version
    from public.jobs
    where title = 'S11 replay journey'
  ),
  '>',
  1,
  'authoritative mutations monotonically advance the job version'
);

select * from finish();
rollback;
