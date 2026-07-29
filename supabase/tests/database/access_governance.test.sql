begin;

select plan(25);

create temporary table role_audit_baseline as
select count(*)::bigint as row_count
from public.membership_role_audit
where organisation_id = 1001;
grant select on role_audit_baseline to authenticated;

select enum_has_labels(
  'public',
  'membership_role',
  array['owner', 'manager', 'employee'],
  'membership roles are ordered owner, manager, employee'
);
select has_table(
  'public',
  'membership_role_audit',
  'role changes have an immutable audit ledger'
);
select has_function(
  'public',
  'create_team_member',
  array['text', 'text', 'text', 'text', 'text', 'membership_role'],
  'guarded team invitation function exists'
);
select has_function(
  'public',
  'change_membership_role',
  array['bigint', 'membership_role'],
  'owner-only role transition function exists'
);
select has_function(
  'public',
  'set_membership_active',
  array['bigint', 'boolean'],
  'guarded lifecycle function exists'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000001',
  true
);

select lives_ok(
  $$
    select * from public.create_team_member(
      'manager@example.test',
      'Morgan',
      'Manager',
      '0400 222 222',
      'Operations manager',
      'manager'
    )
  $$,
  'owner invites a manager'
);
select lives_ok(
  $$
    select * from public.create_team_member(
      'backup-owner@example.test',
      'Backup',
      'Owner',
      '0400 333 333',
      'Owner',
      'owner'
    )
  $$,
  'owner reserves the second owner seat'
);
select throws_like(
  $$
    select * from public.create_team_member(
      'third-owner@example.test',
      'Third',
      'Owner',
      '0400 444 444',
      'Owner',
      'owner'
    )
  $$,
  '%at most two owners%',
  'database rejects a third invited or active owner'
);
select throws_like(
  $$ select public.set_membership_active(1101, false) $$,
  '%at least one active owner%',
  'database prevents deactivating the final active owner'
);
select ok(
  public.delete_invited_team_member(
    (select id from public.memberships where email = 'backup-owner@example.test')
  ),
  'owner can remove an unused backup-owner invitation'
);

reset role;
insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change
)
values (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-4000-8000-000000000090',
  'authenticated',
  'authenticated',
  'manager@example.test',
  '',
  now(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  now(),
  now(),
  '',
  '',
  '',
  ''
);
update public.memberships
set
  user_id = '00000000-0000-4000-8000-000000000090',
  status = 'active',
  activated_at = now()
where email = 'manager@example.test';
delete from realtime.messages;
select private.send_realtime_invalidation(
  'org:1001:operations',
  'membership',
  'update',
  (select id from public.memberships where email = 'manager@example.test')
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000090',
  true
);
select set_config('realtime.topic', 'org:1001:operations', true);
select is(
  (select count(*) from realtime.messages),
  1::bigint,
  'manager receives the organisation operations topic'
);
select lives_ok(
  $$
    select * from public.create_team_member(
      'managed-employee@example.test',
      'Emery',
      'Employee',
      '0400 555 555',
      'Operator',
      'employee'
    )
  $$,
  'manager can invite an employee'
);
select throws_like(
  $$
    select * from public.create_team_member(
      'forbidden-manager@example.test',
      'No',
      'Manager',
      '0400 666 666',
      'Manager',
      'manager'
    )
  $$,
  '%team member management is not permitted%',
  'manager cannot invite another manager'
);
select throws_like(
  $$ select public.change_membership_role(1103, 'manager') $$,
  '%owner membership required%',
  'manager cannot change roles'
);
select lives_ok(
  $$
    select public.create_job(
      p_title => 'Manager assigned work',
      p_assignee_membership_id => (
        select id from public.memberships where email = 'manager@example.test'
      )
    )
  $$,
  'manager is an assignable operational worker'
);
select lives_ok(
  $$
    select public.submit_job(
      (select id from public.jobs where title = 'Manager assigned work')
    )
  $$,
  'manager submits their assigned work'
);
select is(
  (
    select required_reviewer_role::text
    from public.jobs
    where title = 'Manager assigned work'
  ),
  'owner',
  'manager submission snapshots owner review'
);
select throws_like(
  $$
    select public.archive_job(
      (select id from public.jobs where title = 'Manager assigned work'),
      (select submission_version from public.jobs where title = 'Manager assigned work')
    )
  $$,
  '%higher-level reviewer%',
  'manager cannot review their own manager-level submission'
);

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000001',
  true
);
select throws_like(
  $$
    select public.archive_job(
      (select id from public.jobs where title = 'Manager assigned work'),
      (select submission_version - 1 from public.jobs where title = 'Manager assigned work')
    )
  $$,
  '%submission changed before review%',
  'shared review rejects a stale submission version'
);
select lives_ok(
  $$
    select public.archive_job(
      (select id from public.jobs where title = 'Manager assigned work'),
      (select submission_version from public.jobs where title = 'Manager assigned work')
    )
  $$,
  'owner reviews manager work'
);
select is(
  (
    select count(*) - (select row_count from role_audit_baseline)
    from public.membership_role_audit
    where organisation_id = 1001
  ),
  0::bigint,
  'invitations do not fabricate role-change audit events'
);

select lives_ok(
  $$
    select public.create_job(
      p_title => 'Employee shared review work',
      p_assignee_membership_id => 1103
    )
  $$,
  'owner creates employee work for the shared review queue'
);
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000002',
  true
);
select lives_ok(
  $$
    select public.submit_job(
      (select id from public.jobs where title = 'Employee shared review work')
    )
  $$,
  'employee submits work for manager-or-owner review'
);
reset role;
select is(
  (
    select count(*)
    from public.job_notification_deliveries
    where job_id = (
      select id from public.jobs where title = 'Employee shared review work'
    )
  ),
  2::bigint,
  'employee submission notifies every active manager and owner'
);
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000090',
  true
);
select lives_ok(
  $$
    select public.archive_job(
      (select id from public.jobs where title = 'Employee shared review work'),
      (select submission_version from public.jobs where title = 'Employee shared review work')
    )
  $$,
  'manager reviews employee work from the shared queue'
);

select * from finish();
rollback;
