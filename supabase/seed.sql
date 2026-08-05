-- Local development fixture data. All account passwords below are Password123!.

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-4000-8000-000000000001',
    'authenticated', 'authenticated', 'hello@simonbeirouti.com',
    extensions.crypt('Password123!', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-4000-8000-000000000002',
    'authenticated', 'authenticated', 'taylor.green@example.test',
    extensions.crypt('Password123!', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-4000-8000-000000000003',
    'authenticated', 'authenticated', 'morgan.lee@example.test',
    extensions.crypt('Password123!', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
  );

insert into auth.identities (
  id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
)
values
  (
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000001',
    jsonb_build_object('sub', '00000000-0000-4000-8000-000000000001', 'email', 'hello@simonbeirouti.com', 'email_verified', true, 'phone_verified', false),
    'email', now(), now(), now()
  ),
  (
    '00000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000002',
    jsonb_build_object('sub', '00000000-0000-4000-8000-000000000002', 'email', 'taylor.green@example.test', 'email_verified', true, 'phone_verified', false),
    'email', now(), now(), now()
  ),
  (
    '00000000-0000-4000-8000-000000000003',
    '00000000-0000-4000-8000-000000000003',
    '00000000-0000-4000-8000-000000000003',
    jsonb_build_object('sub', '00000000-0000-4000-8000-000000000003', 'email', 'morgan.lee@example.test', 'email_verified', true, 'phone_verified', false),
    'email', now(), now(), now()
  );

insert into public.organisations (id, name, timezone)
overriding system value
values (1001, 'Pure Peninsula Honey', 'Australia/Melbourne');

insert into public.memberships (
  id, organisation_id, user_id, email, role, status, invited_at, activated_at,
  deactivated_at, invite_delivery_status, invite_last_attempted_at
)
overriding system value
values
  (1101, 1001, '00000000-0000-4000-8000-000000000001', 'hello@simonbeirouti.com', 'owner', 'active', now(), now(), null, 'sent', now()),
  (1102, 1001, '00000000-0000-4000-8000-000000000002', 'taylor.green@example.test', 'employee', 'active', now() - interval '14 days', now() - interval '14 days', null, 'sent', now() - interval '14 days'),
  (1103, 1001, '00000000-0000-4000-8000-000000000003', 'morgan.lee@example.test', 'employee', 'active', now() - interval '7 days', now() - interval '7 days', null, 'sent', now() - interval '7 days'),
  (1104, 1001, null, 'jamie.invited@example.test', 'employee', 'invited', now(), null, null, 'pending', null);

insert into public.employee_profiles (
  id, organisation_id, membership_id, first_name, last_name, phone, job_title
)
overriding system value
values
  (1201, 1001, 1101, 'Simon', 'Beirouti', '', 'Owner'),
  (1202, 1001, 1102, 'Taylor', 'Green', '0400 111 222', 'Apiary Technician'),
  (1203, 1001, 1103, 'Morgan', 'Lee', '0400 333 444', 'Field Operations'),
  (1204, 1001, 1104, 'Jamie', 'Invited', '0400 555 666', 'Seasonal Worker');

-- One submitted job waiting for review, active work for both employees, and an unassigned queue.
insert into public.jobs (
  id, organisation_id, assignee_membership_id, title, description, location, priority,
  status, scheduled_at, due_at, started_at, submitted_at, requires_completion_note,
  minimum_completion_photos, created_by
)
overriding system value
values
  (1301, 1001, 1102, 'Review: extract honey supers', 'Completed extraction is ready for owner review.', 'Shed A', 'high', 'in_review', now() - interval '2 days', now() - interval '1 day', now() - interval '2 days', now() - interval '1 day', true, 0, 1101),
  (1302, 1001, 1102, 'Inspect hive frames', 'Check brood pattern and note any queen cells.', 'North apiary', 'normal', 'assigned', now(), now() + interval '1 day', null, null, false, 0, 1101),
  (1303, 1001, 1103, 'Prepare market stock', 'Pack jars and labels for the weekend market.', 'Packing room', 'high', 'in_progress', now() - interval '2 hours', now() + interval '6 hours', now() - interval '1 hour', null, true, 0, 1101),
  (1304, 1001, null, 'Repair fence at south paddock', 'Replace damaged posts beside the south gate.', 'South paddock', 'urgent', 'assigned', null, now() + interval '2 days', null, null, false, 0, 1101),
  (1305, 1001, null, 'Order replacement jars', 'Confirm quantities and place the next packaging order.', 'Office', 'low', 'assigned', null, now() + interval '5 days', null, null, false, 0, 1101);

insert into public.job_updates (organisation_id, job_id, author_membership_id, type, body, metadata)
values
  (1001, 1301, 1102, 'note', 'Extraction completed; ready for review.', '{}'::jsonb),
  (1001, 1301, 1102, 'status_change', 'Submitted for review.', jsonb_build_object('from', 'in_progress', 'to', 'in_review')),
  (1001, 1303, 1103, 'note', 'Labels are being applied now.', '{}'::jsonb);

-- Each active employee has an active and an inactive reusable template, plus matching enabled and paused schedules.
insert into public.job_templates (
  id, organisation_id, assignee_membership_id, title, description, location, priority,
  requires_completion_note, minimum_completion_photos, is_active, created_by
)
overriding system value
values
  (1401, 1001, 1102, 'Taylor weekly hive inspection', 'Inspect hive health and record findings.', 'North apiary', 'normal', true, 1, true, 1101),
  (1402, 1001, 1102, 'Taylor retired smoker check', 'Legacy smoker maintenance checklist.', 'Shed A', 'low', false, 0, false, 1101),
  (1403, 1001, 1103, 'Morgan weekly stock count', 'Count packed jars and update stock levels.', 'Packing room', 'normal', true, 0, true, 1101),
  (1404, 1001, 1103, 'Morgan retired market setup', 'Legacy market setup checklist.', 'Storage bay', 'low', false, 0, false, 1101);

insert into public.job_schedules (
  id, organisation_id, template_id, assignee_membership_id, recurrence_type, weekdays,
  local_time, starts_on, ends_on, timezone, is_enabled, next_occurrence_at, created_by
)
overriding system value
values
  (1501, 1001, 1401, 1102, 'weekly', array[1, 3]::smallint[], '08:30', current_date, null, 'Australia/Melbourne', true, now() + interval '1 day', 1101),
  (1502, 1001, 1402, 1102, 'weekly', array[5]::smallint[], '08:30', current_date - 30, null, 'Australia/Melbourne', false, now() + interval '3 days', 1101),
  (1503, 1001, 1403, 1103, 'weekly', array[2, 4]::smallint[], '09:00', current_date, null, 'Australia/Melbourne', true, now() + interval '2 days', 1101),
  (1504, 1001, 1404, 1103, 'weekly', array[6]::smallint[], '09:00', current_date - 30, null, 'Australia/Melbourne', false, now() + interval '4 days', 1101);

-- Weekday shifts for both active employees, using the current Melbourne week.
insert into public.roster_shifts (
  organisation_id, employee_membership_id, starts_at, ends_at, notes, created_by
)
select
  1001,
  employee.membership_id,
  ((date_trunc('week', current_date)::date + weekday.day_offset) + employee.start_time) at time zone 'Australia/Melbourne',
  ((date_trunc('week', current_date)::date + weekday.day_offset) + employee.end_time) at time zone 'Australia/Melbourne',
  employee.notes,
  1101
from (values (0), (1), (2), (3), (4)) as weekday(day_offset)
cross join (
  values
    (1102::bigint, time '08:00', time '16:00', 'Taylor weekday field shift'),
    (1103::bigint, time '09:00', time '17:00', 'Morgan weekday operations shift')
) as employee(membership_id, start_time, end_time, notes);

select setval(pg_get_serial_sequence('public.organisations', 'id'), (select max(id) from public.organisations), true);
select setval(pg_get_serial_sequence('public.memberships', 'id'), (select max(id) from public.memberships), true);
select setval(pg_get_serial_sequence('public.employee_profiles', 'id'), (select max(id) from public.employee_profiles), true);
select setval(pg_get_serial_sequence('public.jobs', 'id'), (select max(id) from public.jobs), true);
select setval(pg_get_serial_sequence('public.job_templates', 'id'), (select max(id) from public.job_templates), true);
select setval(pg_get_serial_sequence('public.job_schedules', 'id'), (select max(id) from public.job_schedules), true);
select setval(pg_get_serial_sequence('public.roster_shifts', 'id'), (select max(id) from public.roster_shifts), true);
