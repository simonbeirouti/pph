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
  '00000000-0000-4000-8000-000000000001',
  'authenticated',
  'authenticated',
  'hello@simonbeirouti.com',
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
values (
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000001',
  jsonb_build_object(
    'sub', '00000000-0000-4000-8000-000000000001',
    'email', 'hello@simonbeirouti.com',
    'email_verified', true,
    'phone_verified', false
  ),
  'email',
  now(),
  now(),
  now()
);

insert into public.organisations (id, name, timezone)
overriding system value
values (1001, 'Pure Peninsula Honey', 'Australia/Melbourne');

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
values (
  1101,
  1001,
  '00000000-0000-4000-8000-000000000001',
  'hello@simonbeirouti.com',
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
values (
  1201,
  1001,
  1101,
  'Simon',
  'Beirouti',
  '',
  'Owner'
);

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
