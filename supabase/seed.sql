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

insert into public.roster_shifts (
  id,
  organisation_id,
  employee_membership_id,
  starts_at,
  ends_at,
  notes,
  created_by
)
overriding system value
values (
  1301,
  1001,
  1103,
  now() - interval '2 hours',
  now() + interval '6 hours',
  'Seeded current shift',
  1101
);

insert into public.jobs (
  id,
  organisation_id,
  assignee_membership_id,
  title,
  description,
  location,
  priority,
  status,
  scheduled_at,
  due_at,
  requires_completion_note,
  minimum_completion_photos,
  submitted_at,
  archived_at,
  created_by
)
overriding system value
values
  (
    1401,
    1001,
    1103,
    'Inspect loading bay',
    'Check the loading bay and record any safety issues.',
    'Loading bay',
    'urgent',
    'assigned',
    now() - interval '30 minutes',
    now() + interval '2 hours',
    true,
    2,
    null,
    null,
    1101
  ),
  (
    1402,
    1001,
    null,
    'Restock first aid station',
    'Replace used supplies and confirm expiry dates.',
    'Main office',
    'normal',
    'assigned',
    null,
    now() + interval '1 day',
    false,
    0,
    null,
    null,
    1101
  ),
  (
    1403,
    1001,
    1103,
    'Review submitted checklist',
    '',
    '',
    'high',
    'in_review',
    now() - interval '1 day',
    now() - interval '2 hours',
    true,
    1,
    now() - interval '1 hour',
    null,
    1101
  ),
  (
    1404,
    1001,
    1104,
    'Historical equipment audit',
    '',
    'Warehouse',
    'low',
    'archived',
    now() - interval '14 days',
    now() - interval '13 days',
    false,
    0,
    now() - interval '12 days',
    now() - interval '11 days',
    1101
  );

insert into public.job_updates (
  organisation_id,
  job_id,
  author_membership_id,
  type,
  metadata,
  created_at
)
select
  job.organisation_id,
  job.id,
  job.created_by,
  'system',
  jsonb_build_object('event', 'created'),
  job.created_at
from public.jobs as job;

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
select setval(
  pg_get_serial_sequence('public.roster_shifts', 'id'),
  (select max(id) from public.roster_shifts),
  true
);
select setval(
  pg_get_serial_sequence('public.jobs', 'id'),
  (select max(id) from public.jobs),
  true
);
select setval(
  pg_get_serial_sequence('public.job_updates', 'id'),
  (select max(id) from public.job_updates),
  true
);
