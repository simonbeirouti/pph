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
values
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'owner@example.test',
    extensions.crypt('Password123!', extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    now(),
    now(),
    '',
    '',
    '',
    ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    'employee@example.test',
    extensions.crypt('Password123!', extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    now(),
    now(),
    '',
    '',
    '',
    ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-4000-8000-000000000003',
    'authenticated',
    'authenticated',
    'inactive@example.test',
    extensions.crypt('Password123!', extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    now(),
    now(),
    '',
    '',
    '',
    ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-4000-8000-000000000004',
    'authenticated',
    'authenticated',
    'other-owner@example.test',
    extensions.crypt('Password123!', extensions.gen_salt('bf')),
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

insert into auth.identities (
  id,
  provider_id,
  user_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
)
select
  user_id,
  user_id::text,
  user_id,
  jsonb_build_object(
    'sub', user_id::text,
    'email', email,
    'email_verified', true,
    'phone_verified', false
  ),
  'email',
  now(),
  now(),
  now()
from (
  values
    ('00000000-0000-4000-8000-000000000001'::uuid, 'owner@example.test'),
    ('00000000-0000-4000-8000-000000000002'::uuid, 'employee@example.test'),
    ('00000000-0000-4000-8000-000000000003'::uuid, 'inactive@example.test'),
    ('00000000-0000-4000-8000-000000000004'::uuid, 'other-owner@example.test')
) as seeded_users(user_id, email);

insert into public.organisations (id, name, timezone)
overriding system value
values
  (1001, 'Harbour Operations', 'Australia/Melbourne'),
  (2001, 'Other Organisation', 'Australia/Melbourne');

insert into public.memberships (
  id,
  organisation_id,
  user_id,
  email,
  role,
  status,
  invited_at,
  activated_at,
  deactivated_at
)
overriding system value
values
  (
    1101,
    1001,
    '00000000-0000-4000-8000-000000000001',
    'owner@example.test',
    'owner',
    'active',
    now(),
    now(),
    null
  ),
  (
    1102,
    1001,
    null,
    'invited@example.test',
    'employee',
    'invited',
    now(),
    null,
    null
  ),
  (
    1103,
    1001,
    '00000000-0000-4000-8000-000000000002',
    'employee@example.test',
    'employee',
    'active',
    now(),
    now(),
    null
  ),
  (
    1104,
    1001,
    '00000000-0000-4000-8000-000000000003',
    'inactive@example.test',
    'employee',
    'inactive',
    now(),
    now(),
    now()
  ),
  (
    2101,
    2001,
    '00000000-0000-4000-8000-000000000004',
    'other-owner@example.test',
    'owner',
    'active',
    now(),
    now(),
    null
  );

insert into public.employee_profiles (
  id,
  organisation_id,
  membership_id,
  first_name,
  last_name,
  phone,
  job_title
)
overriding system value
values
  (1201, 1001, 1102, 'Indie', 'Invited', '0400 000 001', 'Team Member'),
  (1202, 1001, 1103, 'Alex', 'Employee', '0400 000 002', 'Operator'),
  (1203, 1001, 1104, 'Casey', 'Inactive', '0400 000 003', 'Former Operator'),
  (1204, 1001, 1101, 'Olivia', 'Owner', '0400 000 004', 'Owner'),
  (2201, 2001, 2101, 'Morgan', 'Owner', '0400 000 005', 'Owner');

update public.memberships
set
  invite_delivery_status = 'sent',
  invite_last_attempted_at = invited_at;

select setval(
  pg_get_serial_sequence('public.organisations', 'id'),
  (select max(id) from public.organisations),
  true
);
select setval(
  pg_get_serial_sequence('public.memberships', 'id'),
  (select max(id) from public.memberships),
  true
);
select setval(
  pg_get_serial_sequence('public.employee_profiles', 'id'),
  (select max(id) from public.employee_profiles),
  true
);
