begin;

select plan(41);

select has_type(
  'public',
  'invite_delivery_status',
  'invite delivery status enum exists'
);
select has_column(
  'public',
  'memberships',
  'invite_delivery_status',
  'memberships track invite delivery'
);
select has_column(
  'public',
  'memberships',
  'invite_last_attempted_at',
  'memberships track the last invite attempt'
);
select has_function(
  'public',
  'create_employee',
  array['text', 'text', 'text', 'text', 'text'],
  'transactional employee creation exists'
);
select has_function(
  'public',
  'link_invited_membership',
  array[]::text[],
  'invitation linking exists'
);
select has_function(
  'public',
  'activate_invited_membership',
  array[]::text[],
  'invitation activation exists'
);
select has_function(
  'public',
  'delete_invited_employee',
  array['bigint'],
  'invited employee deletion exists'
);
select results_eq(
  $$ select public from storage.buckets where id = 'avatars' $$,
  $$ values (false) $$,
  'avatars bucket is private'
);
select results_eq(
  $$ select file_size_limit from storage.buckets where id = 'avatars' $$,
  $$ values (5242880::bigint) $$,
  'avatars bucket limits files to 5 MB'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000001',
  true
);

select lives_ok(
  $$
    select *
    from public.create_employee(
      'CASE.TEST@EXAMPLE.TEST',
      'Case',
      'Test',
      '0400 111 111',
      'Tester'
    )
  $$,
  'owner creates an employee'
);
select is(
  (
    select count(*)
    from public.memberships
    where organisation_id = 1001
      and email = 'case.test@example.test'
  ),
  1::bigint,
  'employee email is normalised and unique'
);
select is(
  (
    select created
    from public.create_employee(
      'case.test@example.test',
      'Changed',
      'Name',
      '0400 999 999',
      'Changed'
    )
  ),
  false,
  'repeated employee creation is idempotent'
);
select is(
  (
    select count(*)
    from public.employee_profiles
    where membership_id = (
      select id
      from public.memberships
      where email = 'case.test@example.test'
    )
  ),
  1::bigint,
  'idempotent creation does not duplicate profiles'
);

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000002',
  true
);
select throws_like(
  $$
    select *
    from public.create_employee(
      'forbidden@example.test',
      'No',
      'Access',
      '0400 000 000',
      'None'
    )
  $$,
  '%owner membership required%',
  'employees cannot create employees'
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
  '00000000-0000-4000-8000-000000000099',
  'authenticated',
  'authenticated',
  'invited@example.test',
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

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000099',
  true
);
select is(
  public.link_invited_membership(),
  1102::bigint,
  'verified Auth identity links to its exact invitation'
);
reset role;
select is(
  (
    select user_id
    from public.memberships
    where id = 1102
  ),
  '00000000-0000-4000-8000-000000000099'::uuid,
  'linking stores the verified Auth user'
);
set local role authenticated;
select is(
  public.activate_invited_membership(),
  1102::bigint,
  'linked invitation activates'
);
select is(
  (
    select status::text
    from public.memberships
    where id = 1102
  ),
  'active',
  'activation changes membership state'
);
select is(
  (select count(*) from public.employee_profiles),
  1::bigint,
  'newly active employee sees only their own profile'
);

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000003',
  true
);
select is(
  (select count(*) from public.employee_profiles),
  0::bigint,
  'inactive employee remains blocked'
);
select is(
  private.can_access_avatar(
    '1001/1103/11111111-1111-4111-8111-111111111111.png'
  ),
  false,
  'inactive employees cannot read avatar objects'
);

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000004',
  true
);
select is(
  (select count(*) from public.employee_profiles where organisation_id = 1001),
  0::bigint,
  'other organisation owner cannot see employee profiles'
);
select is(
  private.can_access_avatar(
    '1001/1103/11111111-1111-4111-8111-111111111111.png'
  ),
  false,
  'cross-organisation owners cannot read avatar objects'
);

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000001',
  true
);
select is(
  private.can_access_avatar(
    '1001/1103/11111111-1111-4111-8111-111111111111.png'
  ),
  true,
  'owners can access employee avatars in their organisation'
);
select is(
  private.can_access_avatar('1001/not-a-membership/avatar.png'),
  false,
  'malformed avatar paths fail closed'
);
select is(
  public.delete_invited_employee(
    (
      select id
      from public.memberships
      where email = 'case.test@example.test'
    )
  ),
  true,
  'owner deletes an invited employee'
);
select is(
  (
    select count(*)
    from public.memberships
    where email = 'case.test@example.test'
  ),
  0::bigint,
  'invited employee membership is removed'
);
select is(
  public.delete_invited_employee(1103),
  false,
  'owner cannot delete an activated employee'
);

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000002',
  true
);
select is(
  private.can_access_avatar(
    '1001/1103/11111111-1111-4111-8111-111111111111.png'
  ),
  true,
  'active employees can access their own avatar'
);
select results_eq(
  $$
    update public.employee_profiles
    set phone = '0400 123 456'
    where membership_id = 1103
    returning membership_id
  $$,
  $$ values (1103::bigint) $$,
  'active employees can update their own profile'
);
select is_empty(
  $$
    update public.employee_profiles
    set phone = 'forbidden'
    where membership_id = 1104
    returning id
  $$,
  'employees cannot update another employee profile'
);

reset role;
select results_eq(
  $$
    select grantee, routine_name
    from information_schema.role_routine_grants
    where specific_schema = 'public'
      and routine_name in (
        'create_employee',
        'delete_invited_employee',
        'link_invited_membership',
        'activate_invited_membership'
      )
      and grantee in ('anon', 'authenticated')
    order by routine_name, grantee
  $$,
  $$
    values
      ('authenticated'::information_schema.sql_identifier, 'activate_invited_membership'::information_schema.sql_identifier),
      ('authenticated'::information_schema.sql_identifier, 'create_employee'::information_schema.sql_identifier),
      ('authenticated'::information_schema.sql_identifier, 'delete_invited_employee'::information_schema.sql_identifier),
      ('authenticated'::information_schema.sql_identifier, 'link_invited_membership'::information_schema.sql_identifier)
  $$,
  'only authenticated receives employee function execution'
);
select is(
  (
    select count(*)
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname like 'avatars_%'
  ),
  4::bigint,
  'avatars have select, insert, update, and delete policies'
);
select is(
  (
    select count(*)
    from public.memberships
    where organisation_id = 1001
      and status = 'active'
      and role = 'employee'
  ),
  2::bigint,
  'active employee option source excludes invited and inactive employees'
);
select isnt_empty(
  $$
    select 1
    from pg_indexes
    where schemaname = 'public'
      and indexname = 'memberships_organisation_status_idx'
  $$,
  'membership status lookups are indexed'
);
select is(
  (
    select invite_delivery_status::text
    from public.memberships
    where id = 1103
  ),
  'sent',
  'existing memberships receive a stable invite delivery state'
);
select is(
  (
    select count(*)
    from information_schema.role_table_grants
    where grantee = 'anon'
      and table_schema = 'public'
      and table_name in ('memberships', 'employee_profiles')
      and privilege_type in ('INSERT', 'UPDATE')
  ),
  0::bigint,
  'anonymous receives no employee mutation grants'
);
select ok(
  has_column_privilege(
    'authenticated',
    'public.memberships',
    'status',
    'UPDATE'
  ),
  'authenticated owners can update membership lifecycle state'
);
select ok(
  not has_column_privilege(
    'authenticated',
    'public.memberships',
    'email',
    'UPDATE'
  ),
  'employee email identity is immutable after creation'
);
select ok(
  not has_column_privilege(
    'authenticated',
    'public.memberships',
    'user_id',
    'UPDATE'
  ),
  'owners cannot relink an employee Auth identity'
);
select ok(
  not has_column_privilege(
    'authenticated',
    'public.employee_profiles',
    'membership_id',
    'UPDATE'
  ),
  'owners cannot move a profile between memberships'
);

select * from finish();
rollback;
