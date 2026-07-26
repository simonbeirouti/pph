begin;

select plan(24);

select has_table('public', 'organisations', 'organisations exists');
select has_table('public', 'memberships', 'memberships exists');
select has_table('public', 'employee_profiles', 'employee profiles exists');
select col_is_pk('public', 'organisations', 'id', 'organisations uses id as its primary key');
select has_type('public', 'membership_role', 'membership role enum exists');
select has_type('public', 'membership_status', 'membership status enum exists');

select throws_like(
  $$
    insert into public.memberships (
      organisation_id,
      email,
      role,
      status,
      invited_at
    )
    values (1001, 'Uppercase@Example.test', 'employee', 'invited', now())
  $$,
  '%memberships_email_normalised%',
  'membership email must be normalised'
);

select throws_like(
  $$
    insert into public.memberships (
      organisation_id,
      user_id,
      email,
      role,
      status,
      activated_at
    )
    values (
      2001,
      '00000000-0000-4000-8000-000000000001',
      'duplicate-user@example.test',
      'owner',
      'active',
      now()
    )
  $$,
  '%memberships_user_id_unique%',
  'an Auth user can have only one V1 membership'
);

insert into public.memberships (
  id,
  organisation_id,
  email,
  role,
  status,
  invited_at
)
overriding system value
values (1199, 1001, 'constraint-check@example.test', 'employee', 'invited', now());

select throws_like(
  $$
    insert into public.employee_profiles (
      organisation_id,
      membership_id,
      first_name,
      last_name
    )
    values (2001, 1199, 'Cross', 'Organisation')
  $$,
  '%employee_profiles_membership_organisation_fkey%',
  'employee profiles cannot reference a membership in another organisation'
);

delete from public.memberships where id = 1199;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000001',
  true
);
select is((select count(*) from public.organisations), 1::bigint, 'owner sees one organisation');
select is((select count(*) from public.memberships), 4::bigint, 'owner sees organisation memberships');
select is((select count(*) from public.employee_profiles), 3::bigint, 'owner sees organisation profiles');

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000002',
  true
);
select is((select count(*) from public.memberships), 1::bigint, 'employee sees only their membership');
select is((select count(*) from public.employee_profiles), 1::bigint, 'employee sees only their profile');
select is(
  (select count(*) from public.organisations where id = 2001),
  0::bigint,
  'employee cannot see another organisation'
);

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000003',
  true
);
select is((select count(*) from public.organisations), 0::bigint, 'inactive user sees no organisation data');

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000099',
  true
);
select is((select count(*) from public.organisations), 0::bigint, 'an unlinked invited identity sees no organisation');
select is((select count(*) from public.memberships), 0::bigint, 'an unlinked invited identity sees no memberships');
select is((select count(*) from public.employee_profiles), 0::bigint, 'an unlinked invited identity sees no profiles');

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000004',
  true
);
select is((select count(*) from public.organisations), 1::bigint, 'second owner sees only their organisation');
select is((select count(*) from public.memberships), 1::bigint, 'second owner sees only their membership');
select is((select count(*) from public.employee_profiles), 0::bigint, 'second owner sees no first-organisation profiles');

reset role;
select results_eq(
  $$
    select table_name, privilege_type
    from information_schema.role_table_grants
    where grantee = 'authenticated'
      and table_schema = 'public'
      and table_name in ('organisations', 'memberships', 'employee_profiles')
    order by table_name, privilege_type
  $$,
  $$
    values
      ('employee_profiles'::information_schema.sql_identifier, 'SELECT'::information_schema.character_data),
      ('memberships'::information_schema.sql_identifier, 'SELECT'::information_schema.character_data),
      ('organisations'::information_schema.sql_identifier, 'SELECT'::information_schema.character_data)
  $$,
  'authenticated receives only explicit select privileges'
);

select is_empty(
  $$
    select 1
    from information_schema.role_table_grants
    where grantee = 'anon'
      and table_schema = 'public'
      and table_name in ('organisations', 'memberships', 'employee_profiles')
  $$,
  'anonymous receives no application table privileges'
);

select * from finish();
rollback;
