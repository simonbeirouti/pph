-- Core role helpers, invariants, lifecycle functions, review hierarchy, and RLS.
create function private.current_membership_actual()
returns table (
  membership_id bigint,
  organisation_id bigint,
  role public.membership_role,
  status public.membership_status
)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, m.organisation_id, m.role, m.status
  from public.memberships as m
  where m.user_id = (select auth.uid())
    and m.status = 'active'
  limit 1
$$;

revoke all on function private.current_membership_actual()
  from public, anon, authenticated, service_role;
grant execute on function private.current_membership_actual() to authenticated;

create function private.is_operations_role(p_role public.membership_role)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_role in ('owner', 'manager')
$$;

create function private.is_worker_role(p_role public.membership_role)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_role in ('manager', 'employee')
$$;

revoke all on function private.is_operations_role(public.membership_role),
  private.is_worker_role(public.membership_role)
  from public, anon, authenticated, service_role;

create table public.membership_role_audit (
  id bigint generated always as identity primary key,
  organisation_id bigint not null references public.organisations(id) on delete restrict,
  membership_id bigint not null,
  previous_role public.membership_role,
  new_role public.membership_role not null,
  actor_membership_id bigint,
  created_at timestamptz not null default now(),
  constraint membership_role_audit_membership_organisation_fkey
    foreign key (membership_id, organisation_id)
    references public.memberships(id, organisation_id)
    on delete restrict,
  constraint membership_role_audit_actor_organisation_fkey
    foreign key (actor_membership_id, organisation_id)
    references public.memberships(id, organisation_id)
    on delete restrict,
  constraint membership_role_audit_changed
    check (previous_role is null or previous_role <> new_role)
);

create index membership_role_audit_organisation_created_idx
  on public.membership_role_audit (organisation_id, created_at desc);
create index membership_role_audit_membership_created_idx
  on public.membership_role_audit (membership_id, created_at desc);

alter table public.membership_role_audit enable row level security;

create policy membership_role_audit_select_owner
on public.membership_role_audit
for select
to authenticated
using (
  organisation_id = (
    select context.organisation_id
    from private.current_membership_actual() as context
    where context.role = 'owner'
  )
);

revoke all on public.membership_role_audit from public, anon, authenticated;
grant select on public.membership_role_audit to authenticated;
grant all on public.membership_role_audit to service_role;

create function private.audit_membership_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id bigint;
begin
  if old.role is distinct from new.role then
    select context.membership_id
    into v_actor_id
    from private.current_membership_actual() as context
    where context.organisation_id = new.organisation_id;

    insert into public.membership_role_audit (
      organisation_id,
      membership_id,
      previous_role,
      new_role,
      actor_membership_id
    )
    values (
      new.organisation_id,
      new.id,
      old.role,
      new.role,
      v_actor_id
    );
  end if;
  return new;
end;
$$;

create trigger memberships_audit_role
after update of role on public.memberships
for each row execute function private.audit_membership_role();

create function private.enforce_owner_membership_invariants()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_organisation_id bigint := coalesce(new.organisation_id, old.organisation_id);
  v_active_count integer;
  v_reserved_count integer;
begin
  perform 1
  from public.organisations
  where id = v_organisation_id
  for update;

  select
    count(*) filter (where status = 'active'),
    count(*) filter (where status in ('invited', 'active'))
  into v_active_count, v_reserved_count
  from public.memberships
  where organisation_id = v_organisation_id
    and role = 'owner';

  if v_active_count < 1 then
    raise exception 'at least one active owner is required'
      using errcode = '23514';
  end if;
  if v_reserved_count > 2 then
    raise exception 'an organisation can have at most two owners'
      using errcode = '23514';
  end if;
  return null;
end;
$$;

create constraint trigger memberships_owner_invariants
after insert or update or delete on public.memberships
deferrable initially immediate
for each row execute function private.enforce_owner_membership_invariants();

revoke all on function private.audit_membership_role(),
  private.enforce_owner_membership_invariants()
  from public, anon, authenticated, service_role;

alter table public.jobs
  add column submitted_by_membership_id bigint,
  add column required_reviewer_role public.membership_role,
  add column reviewed_by_membership_id bigint,
  add column reviewed_by_role public.membership_role,
  add column reviewed_at timestamptz,
  add constraint jobs_submitter_organisation_fkey
    foreign key (submitted_by_membership_id, organisation_id)
    references public.memberships(id, organisation_id)
    on delete restrict,
  add constraint jobs_reviewer_organisation_fkey
    foreign key (reviewed_by_membership_id, organisation_id)
    references public.memberships(id, organisation_id)
    on delete restrict,
  add constraint jobs_required_reviewer_role_check
    check (required_reviewer_role is null or required_reviewer_role in ('owner', 'manager')),
  add constraint jobs_review_state_check
    check (
      (reviewed_by_membership_id is null and reviewed_by_role is null and reviewed_at is null)
      or
      (reviewed_by_membership_id is not null and reviewed_by_role is not null and reviewed_at is not null)
    );

create index jobs_submitted_by_membership_idx
  on public.jobs (submitted_by_membership_id)
  where submitted_by_membership_id is not null;
create index jobs_required_reviewer_status_idx
  on public.jobs (organisation_id, required_reviewer_role, submitted_at desc)
  where status = 'in_review';

alter table public.job_notification_deliveries
  drop constraint job_notification_submission_unique,
  add constraint job_notification_submission_recipient_unique
    unique (submission_update_id, recipient_membership_id);

-- Completed operational functions remain the source of their domain behaviour.
-- This controlled replacement widens only their role predicates.
do $$
declare
  v_definition text;
  v_function record;
begin
  for v_function in
    select p.oid
    from pg_proc as p
    join pg_namespace as n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = any (array[
        'create_job',
        'update_job',
        'reassign_job',
        'create_roster_shift_with_jobs',
        'archive_roster_shift',
        'upsert_job_template',
        'set_job_template_active',
        'create_job_template',
        'upsert_job_schedule',
        'set_job_schedule_enabled',
        'delete_job_schedule',
        'retry_job_schedule',
        'create_job_schedule',
        'add_job_comment',
        'retry_job_notification'
      ])
  loop
    v_definition := pg_get_functiondef(v_function.oid);
    v_definition := replace(
      v_definition,
      'where context.role = ''owner''',
      'where context.role in (''owner'', ''manager'')'
    );
    v_definition := replace(
      v_definition,
      'context.role = ''owner''',
      'context.role in (''owner'', ''manager'')'
    );
    v_definition := replace(
      v_definition,
      'context.role <> ''owner''',
      'context.role not in (''owner'', ''manager'')'
    );
    v_definition := replace(
      v_definition,
      'membership.role = ''employee''',
      'membership.role in (''employee'', ''manager'')'
    );
    execute v_definition;
  end loop;

  for v_function in
    select p.oid
    from pg_proc as p
    join pg_namespace as n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = any (array[
        'start_job',
        'add_job_note',
        'finalize_job_evidence',
        'archive_job_evidence'
      ])
  loop
    v_definition := pg_get_functiondef(v_function.oid);
    v_definition := replace(
      v_definition,
      'where context.role = ''employee''',
      'where context.role in (''employee'', ''manager'')'
    );
    v_definition := replace(
      v_definition,
      'employee membership required',
      'assigned worker membership required'
    );
    execute v_definition;
  end loop;
end;
$$;

create function public.create_team_member(
  p_email text,
  p_first_name text,
  p_last_name text,
  p_phone text,
  p_job_title text,
  p_role public.membership_role
)
returns table (
  membership_id bigint,
  profile_id bigint,
  created boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor record;
  v_email text := lower(btrim(p_email));
  v_membership_id bigint;
  v_profile_id bigint;
begin
  select *
  into v_actor
  from private.current_membership_actual() as context;

  if v_actor.membership_id is null
    or (
      v_actor.role = 'manager' and p_role <> 'employee'
    )
    or v_actor.role not in ('owner', 'manager') then
    raise exception 'team member management is not permitted'
      using errcode = '42501';
  end if;
  if p_role = 'owner' and v_actor.role <> 'owner' then
    raise exception 'owner membership required' using errcode = '42501';
  end if;

  perform 1
  from public.organisations
  where id = v_actor.organisation_id
  for update;

  select membership.id, profile.id
  into v_membership_id, v_profile_id
  from public.memberships as membership
  left join public.employee_profiles as profile
    on profile.membership_id = membership.id
  where membership.organisation_id = v_actor.organisation_id
    and membership.email = v_email;

  if v_membership_id is not null then
    return query select v_membership_id, v_profile_id, false;
    return;
  end if;

  insert into public.memberships (
    organisation_id,
    email,
    role,
    status,
    invited_at
  )
  values (
    v_actor.organisation_id,
    v_email,
    p_role,
    'invited',
    now()
  )
  returning id into v_membership_id;

  insert into public.employee_profiles (
    organisation_id,
    membership_id,
    first_name,
    last_name,
    phone,
    job_title
  )
  values (
    v_actor.organisation_id,
    v_membership_id,
    btrim(p_first_name),
    btrim(p_last_name),
    btrim(p_phone),
    btrim(p_job_title)
  )
  returning id into v_profile_id;

  return query select v_membership_id, v_profile_id, true;
end;
$$;

create function public.change_membership_role(
  p_membership_id bigint,
  p_role public.membership_role
)
returns public.memberships
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor record;
  v_target public.memberships;
begin
  select *
  into v_actor
  from private.current_membership_actual() as context
  where context.role = 'owner';
  if v_actor.membership_id is null then
    raise exception 'owner membership required' using errcode = '42501';
  end if;

  perform 1
  from public.organisations
  where id = v_actor.organisation_id
  for update;

  select *
  into v_target
  from public.memberships
  where id = p_membership_id
    and organisation_id = v_actor.organisation_id
  for update;
  if v_target.id is null then
    raise exception 'team member is unavailable' using errcode = 'P0002';
  end if;
  if v_target.role = p_role then
    return v_target;
  end if;
  if p_role = 'owner' and exists (
    select 1
    from public.jobs
    where assignee_membership_id = v_target.id
      and status <> 'archived'
  ) then
    raise exception 'reassign active jobs before promoting this team member to owner'
      using errcode = '22023';
  end if;

  update public.memberships
  set role = p_role
  where id = v_target.id
  returning * into v_target;
  return v_target;
end;
$$;

create function public.set_membership_active(
  p_membership_id bigint,
  p_active boolean
)
returns public.memberships
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor record;
  v_target public.memberships;
begin
  select *
  into v_actor
  from private.current_membership_actual() as context;
  if v_actor.role not in ('owner', 'manager') then
    raise exception 'team member management is not permitted'
      using errcode = '42501';
  end if;

  perform 1
  from public.organisations
  where id = v_actor.organisation_id
  for update;

  select *
  into v_target
  from public.memberships
  where id = p_membership_id
    and organisation_id = v_actor.organisation_id
  for update;
  if v_target.id is null then
    raise exception 'team member is unavailable' using errcode = 'P0002';
  end if;
  if v_actor.role = 'manager' and v_target.role <> 'employee' then
    raise exception 'managers can manage employees only' using errcode = '42501';
  end if;
  if v_target.status = 'invited' then
    raise exception 'an invited member cannot be activated manually'
      using errcode = '22023';
  end if;

  update public.memberships
  set
    status = case when p_active then 'active' else 'inactive' end,
    deactivated_at = case when p_active then null else now() end
  where id = v_target.id
  returning * into v_target;
  return v_target;
end;
$$;

revoke all on function public.create_team_member(
  text, text, text, text, text, public.membership_role
), public.change_membership_role(bigint, public.membership_role),
  public.set_membership_active(bigint, boolean)
  from public, anon;
grant execute on function public.create_team_member(
  text, text, text, text, text, public.membership_role
), public.change_membership_role(bigint, public.membership_role),
  public.set_membership_active(bigint, boolean)
  to authenticated;

drop policy memberships_insert_owner on public.memberships;
drop policy memberships_update_owner on public.memberships;
revoke insert on public.memberships from authenticated;
revoke update on public.memberships from authenticated;

drop policy employee_profiles_insert_owner on public.employee_profiles;
drop policy employee_profiles_update_owner_or_self on public.employee_profiles;

create policy employee_profiles_update_people_manager_or_self
on public.employee_profiles
for update
to authenticated
using (
  organisation_id = (
    select context.organisation_id
    from private.current_membership_actual() as context
  )
  and (
    membership_id = (
      select context.membership_id
      from private.current_membership_actual() as context
    )
    or (
      select context.role = 'owner'
      from private.current_membership_actual() as context
    )
    or (
      (
        select context.role = 'manager'
        from private.current_membership_actual() as context
      )
      and exists (
        select 1 from public.memberships as target
        where target.id = employee_profiles.membership_id
          and target.organisation_id = employee_profiles.organisation_id
          and target.role = 'employee'
      )
    )
  )
)
with check (
  organisation_id = (
    select context.organisation_id
    from private.current_membership_actual() as context
  )
);

drop policy roster_shifts_select_active_membership on public.roster_shifts;
create policy roster_shifts_select_active_membership
on public.roster_shifts for select to authenticated
using (
  organisation_id = (
    select context.organisation_id from private.current_membership_actual() context
  )
  and (
    (select private.is_operations_role(context.role)
     from private.current_membership_actual() context)
    or employee_membership_id = (
      select context.membership_id from private.current_membership_actual() context
    )
  )
);

drop policy jobs_select_active_membership on public.jobs;
create policy jobs_select_active_membership
on public.jobs for select to authenticated
using (
  organisation_id = (
    select context.organisation_id from private.current_membership_actual() context
  )
  and (
    (select private.is_operations_role(context.role)
     from private.current_membership_actual() context)
    or assignee_membership_id = (
      select context.membership_id from private.current_membership_actual() context
    )
  )
);

drop policy job_updates_select_active_membership on public.job_updates;
create policy job_updates_select_active_membership
on public.job_updates for select to authenticated
using (
  organisation_id = (
    select context.organisation_id from private.current_membership_actual() context
  )
  and (
    (select private.is_operations_role(context.role)
     from private.current_membership_actual() context)
    or exists (
      select 1 from public.jobs job
      where job.id = job_updates.job_id
        and job.assignee_membership_id = (
          select context.membership_id
          from private.current_membership_actual() context
        )
    )
  )
);

drop policy job_assets_select_active_membership on public.job_assets;
create policy job_assets_select_active_membership
on public.job_assets for select to authenticated
using (
  organisation_id = (
    select context.organisation_id from private.current_membership_actual() context
  )
  and (
    (select private.is_operations_role(context.role)
     from private.current_membership_actual() context)
    or exists (
      select 1 from public.jobs job
      where job.id = job_assets.job_id
        and job.assignee_membership_id = (
          select context.membership_id
          from private.current_membership_actual() context
        )
    )
  )
);

drop policy job_notification_deliveries_select_owner
  on public.job_notification_deliveries;
create policy job_notification_deliveries_select_operations
on public.job_notification_deliveries for select to authenticated
using (
  organisation_id = (
    select context.organisation_id from private.current_membership_actual() context
  )
  and (
    select private.is_operations_role(context.role)
    from private.current_membership_actual() context
  )
);

drop policy job_templates_select_owner on public.job_templates;
create policy job_templates_select_operations
on public.job_templates for select to authenticated
using (
  organisation_id = (
    select context.organisation_id from private.current_membership_actual() context
    where context.role in ('owner', 'manager')
  )
);

drop policy job_schedules_select_owner on public.job_schedules;
create policy job_schedules_select_operations
on public.job_schedules for select to authenticated
using (
  organisation_id = (
    select context.organisation_id from private.current_membership_actual() context
    where context.role in ('owner', 'manager')
  )
);

drop policy job_schedule_occurrences_select_owner
  on public.job_schedule_occurrences;
create policy job_schedule_occurrences_select_operations
on public.job_schedule_occurrences for select to authenticated
using (
  organisation_id = (
    select context.organisation_id from private.current_membership_actual() context
    where context.role in ('owner', 'manager')
  )
);

drop policy memberships_select_active_membership on public.memberships;
create policy memberships_select_active_membership
on public.memberships for select to authenticated
using (
  organisation_id = (
    select context.organisation_id from private.current_membership_actual() context
  )
  and (
    (select private.is_operations_role(context.role)
     from private.current_membership_actual() context)
    or id = (
      select context.membership_id from private.current_membership_actual() context
    )
  )
);

drop policy employee_profiles_select_active_membership
  on public.employee_profiles;
create policy employee_profiles_select_active_membership
on public.employee_profiles for select to authenticated
using (
  organisation_id = (
    select context.organisation_id from private.current_membership_actual() context
  )
  and (
    (select private.is_operations_role(context.role)
     from private.current_membership_actual() context)
    or membership_id = (
      select context.membership_id from private.current_membership_actual() context
    )
  )
);

drop policy roster_shifts_insert_owner on public.roster_shifts;
create policy roster_shifts_insert_operations
on public.roster_shifts for insert to authenticated
with check (
  organisation_id = (
    select context.organisation_id
    from private.current_membership_actual() context
    where context.role in ('owner', 'manager')
  )
  and exists (
    select 1 from public.memberships target
    where target.id = employee_membership_id
      and target.organisation_id = roster_shifts.organisation_id
      and target.role in ('employee', 'manager')
      and target.status = 'active'
  )
);

drop policy roster_shifts_update_owner on public.roster_shifts;
create policy roster_shifts_update_operations
on public.roster_shifts for update to authenticated
using (
  organisation_id = (
    select context.organisation_id
    from private.current_membership_actual() context
    where context.role in ('owner', 'manager')
  )
)
with check (
  organisation_id = (
    select context.organisation_id
    from private.current_membership_actual() context
    where context.role in ('owner', 'manager')
  )
  and exists (
    select 1 from public.memberships target
    where target.id = employee_membership_id
      and target.organisation_id = roster_shifts.organisation_id
      and target.role in ('employee', 'manager')
  )
);

create or replace function private.can_upload_job_evidence(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_organisation_id bigint;
  v_job_id bigint;
  v_uploader_id bigint;
begin
  if object_name !~ '^[0-9]+/[0-9]+/[0-9]+/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp|heic|heif)$' then
    return false;
  end if;
  v_organisation_id := split_part(object_name, '/', 1)::bigint;
  v_job_id := split_part(object_name, '/', 2)::bigint;
  v_uploader_id := split_part(object_name, '/', 3)::bigint;

  return exists (
    select 1
    from private.current_membership_actual() context
    join public.jobs job
      on job.id = v_job_id
      and job.organisation_id = context.organisation_id
    where context.role in ('employee', 'manager')
      and context.membership_id = v_uploader_id
      and v_organisation_id = context.organisation_id
      and job.assignee_membership_id = context.membership_id
      and job.status in ('assigned', 'in_progress')
      and (
        select count(*) from public.job_assets asset
        where asset.job_id = job.id and asset.archived_at is null
      ) < 10
  );
end;
$$;

create or replace function public.submit_job(p_job_id bigint)
returns table (
  job_id bigint,
  notification_id bigint,
  submission_update_id bigint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor record;
  v_job public.jobs;
  v_notification_id bigint;
  v_submission_update_id bigint;
  v_required_role public.membership_role;
begin
  select *
  into v_actor
  from private.current_membership_actual() context
  where context.role in ('employee', 'manager');
  if v_actor.membership_id is null then
    raise exception 'assigned worker membership required' using errcode = '42501';
  end if;

  select *
  into v_job
  from public.jobs job
  where job.id = p_job_id
    and job.organisation_id = v_actor.organisation_id
  for update;

  if v_job.id is null or v_job.assignee_membership_id <> v_actor.membership_id then
    raise exception 'job is unavailable' using errcode = 'P0002';
  end if;
  if v_job.status = 'in_review' then
    select delivery.id, delivery.submission_update_id
    into v_notification_id, v_submission_update_id
    from public.job_notification_deliveries delivery
    where delivery.job_id = v_job.id
    order by delivery.created_at desc
    limit 1;
    return query select v_job.id, v_notification_id, v_submission_update_id;
    return;
  end if;
  if v_job.status not in ('assigned', 'in_progress') then
    raise exception 'job cannot be submitted' using errcode = '22023';
  end if;
  if v_job.requires_completion_note and not exists (
    select 1 from public.job_updates update_row
    where update_row.job_id = v_job.id
      and update_row.type = 'note'
      and update_row.author_membership_id = v_actor.membership_id
  ) then
    raise exception 'add a completion note before submitting'
      using errcode = '22023';
  end if;
  if (
    select count(*) from public.job_assets asset
    where asset.job_id = v_job.id and asset.archived_at is null
  ) < v_job.minimum_completion_photos then
    raise exception 'add the required completion photos before submitting'
      using errcode = '22023';
  end if;

  v_required_role := case
    when v_actor.role = 'manager' then 'owner'::public.membership_role
    else 'manager'::public.membership_role
  end;

  update public.jobs
  set
    status = 'in_review',
    submitted_at = now(),
    submission_version = submission_version + 1,
    submitted_by_membership_id = v_actor.membership_id,
    required_reviewer_role = v_required_role,
    reviewed_by_membership_id = null,
    reviewed_by_role = null,
    reviewed_at = null
  where id = v_job.id
  returning * into v_job;

  insert into public.job_updates (
    organisation_id, job_id, author_membership_id, type, metadata
  )
  values (
    v_actor.organisation_id,
    v_job.id,
    v_actor.membership_id,
    'status_change',
    jsonb_build_object(
      'previous_status',
      case when v_job.started_at is null then 'assigned' else 'in_progress' end,
      'new_status', 'in_review',
      'submission_version', v_job.submission_version,
      'submitter_role', v_actor.role,
      'required_reviewer_role', v_required_role
    )
  )
  returning id into v_submission_update_id;

  insert into public.job_notification_deliveries (
    organisation_id,
    job_id,
    submission_update_id,
    recipient_membership_id,
    recipient_email,
    status
  )
  select
    v_actor.organisation_id,
    v_job.id,
    v_submission_update_id,
    reviewer.id,
    reviewer.email,
    'queued'
  from public.memberships reviewer
  where reviewer.organisation_id = v_actor.organisation_id
    and reviewer.status = 'active'
    and reviewer.id <> v_actor.membership_id
    and (
      reviewer.role = 'owner'
      or (v_required_role = 'manager' and reviewer.role = 'manager')
    )
  on conflict (submission_update_id, recipient_membership_id) do nothing;

  select min(delivery.id)
  into v_notification_id
  from public.job_notification_deliveries delivery
  where delivery.submission_update_id = v_submission_update_id;

  return query select v_job.id, v_notification_id, v_submission_update_id;
end;
$$;

create or replace function public.archive_job(p_job_id bigint)
returns public.jobs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor record;
  v_job public.jobs;
begin
  select *
  into v_actor
  from private.current_membership_actual() context
  where context.role in ('owner', 'manager');
  if v_actor.membership_id is null then
    raise exception 'reviewer membership required' using errcode = '42501';
  end if;

  select *
  into v_job
  from public.jobs job
  where job.id = p_job_id and job.organisation_id = v_actor.organisation_id
  for update;
  if v_job.id is null then
    raise exception 'job is unavailable' using errcode = 'P0002';
  end if;
  if v_job.status = 'archived' then
    return v_job;
  end if;
  if v_job.status <> 'in_review' then
    raise exception 'only submitted jobs can be approved' using errcode = '22023';
  end if;
  if v_job.submitted_by_membership_id = v_actor.membership_id
    or (v_job.required_reviewer_role = 'owner' and v_actor.role <> 'owner') then
    raise exception 'a higher-level reviewer is required' using errcode = '42501';
  end if;

  update public.jobs
  set
    status = 'archived',
    archived_at = now(),
    reviewed_by_membership_id = v_actor.membership_id,
    reviewed_by_role = v_actor.role,
    reviewed_at = now()
  where id = v_job.id
  returning * into v_job;

  insert into public.job_updates (
    organisation_id, job_id, author_membership_id, type, metadata
  )
  values (
    v_actor.organisation_id,
    v_job.id,
    v_actor.membership_id,
    'status_change',
    jsonb_build_object(
      'previous_status', 'in_review',
      'new_status', 'archived',
      'reviewer_role', v_actor.role
    )
  );
  return v_job;
end;
$$;

create or replace function public.reopen_job(
  p_job_id bigint,
  p_feedback text,
  p_assignee_membership_id bigint
)
returns public.jobs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor record;
  v_job public.jobs;
  v_previous_assignee bigint;
  v_previous_status public.job_status;
begin
  select *
  into v_actor
  from private.current_membership_actual() context
  where context.role in ('owner', 'manager');
  if v_actor.membership_id is null then
    raise exception 'reviewer membership required' using errcode = '42501';
  end if;
  if btrim(coalesce(p_feedback, '')) = '' then
    raise exception 'review feedback is required' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.memberships target
    where target.id = p_assignee_membership_id
      and target.organisation_id = v_actor.organisation_id
      and target.role in ('employee', 'manager')
      and target.status = 'active'
  ) then
    raise exception 'choose an active worker' using errcode = '22023';
  end if;

  select *
  into v_job
  from public.jobs job
  where job.id = p_job_id and job.organisation_id = v_actor.organisation_id
  for update;
  if v_job.id is null then
    raise exception 'job is unavailable' using errcode = 'P0002';
  end if;
  if v_job.status not in ('in_review', 'archived') then
    raise exception 'job cannot be reopened' using errcode = '22023';
  end if;
  if v_job.submitted_by_membership_id = v_actor.membership_id
    or (v_job.required_reviewer_role = 'owner' and v_actor.role <> 'owner') then
    raise exception 'a higher-level reviewer is required' using errcode = '42501';
  end if;

  v_previous_assignee := v_job.assignee_membership_id;
  v_previous_status := v_job.status;
  insert into public.job_updates (
    organisation_id, job_id, author_membership_id, type, body, metadata
  )
  values (
    v_actor.organisation_id,
    v_job.id,
    v_actor.membership_id,
    'comment',
    btrim(p_feedback),
    jsonb_build_object('event', 'reopen_feedback', 'reviewer_role', v_actor.role)
  );

  perform set_config('pph.allow_job_reopen_with_feedback', 'on', true);
  update public.jobs
  set
    assignee_membership_id = p_assignee_membership_id,
    status = 'assigned',
    started_at = null,
    submitted_at = null,
    archived_at = null,
    submitted_by_membership_id = null,
    required_reviewer_role = null,
    reviewed_by_membership_id = null,
    reviewed_by_role = null,
    reviewed_at = null
  where id = v_job.id
  returning * into v_job;

  if v_previous_assignee is distinct from p_assignee_membership_id then
    insert into public.job_updates (
      organisation_id, job_id, author_membership_id, type, metadata
    )
    values (
      v_actor.organisation_id,
      v_job.id,
      v_actor.membership_id,
      'assignment_change',
      jsonb_build_object(
        'previous_assignee_membership_id', v_previous_assignee,
        'new_assignee_membership_id', p_assignee_membership_id
      )
    );
  end if;
  insert into public.job_updates (
    organisation_id, job_id, author_membership_id, type, metadata
  )
  values (
    v_actor.organisation_id,
    v_job.id,
    v_actor.membership_id,
    'status_change',
    jsonb_build_object(
      'previous_status', v_previous_status,
      'new_status', 'assigned',
      'reviewer_role', v_actor.role
    )
  );
  return v_job;
end;
$$;

revoke all on function public.submit_job(bigint),
  public.archive_job(bigint),
  public.reopen_job(bigint, text, bigint)
  from public, anon;
grant execute on function public.submit_job(bigint),
  public.archive_job(bigint),
  public.reopen_job(bigint, text, bigint)
  to authenticated;

-- Invitation activation, avatar access, and pending-member deletion.
create or replace function public.link_invited_membership()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_email text;
  v_membership_id bigint;
  v_match_count integer;
begin
  if v_user_id is null then
    raise exception 'authenticated invitation required' using errcode = '42501';
  end if;
  select lower(btrim(user_record.email))
  into v_email
  from auth.users user_record
  where user_record.id = v_user_id;

  select count(*), min(membership.id)
  into v_match_count, v_membership_id
  from public.memberships membership
  where membership.email = v_email
    and membership.status = 'invited'
    and (membership.user_id is null or membership.user_id = v_user_id);
  if v_match_count <> 1 then
    raise exception 'invitation membership is unavailable' using errcode = 'P0002';
  end if;

  update public.memberships
  set user_id = v_user_id
  where id = v_membership_id;
  return v_membership_id;
end;
$$;

create or replace function public.activate_invited_membership()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_membership_id bigint;
begin
  if v_user_id is null then
    raise exception 'authenticated invitation required' using errcode = '42501';
  end if;
  update public.memberships
  set
    status = 'active',
    activated_at = now(),
    deactivated_at = null
  where user_id = v_user_id
    and status = 'invited'
  returning id into v_membership_id;
  if v_membership_id is null then
    raise exception 'invited membership is unavailable' using errcode = 'P0002';
  end if;
  return v_membership_id;
end;
$$;

create or replace function private.can_access_avatar(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_organisation_id bigint;
  v_membership_id bigint;
begin
  if object_name !~ '^[0-9]+/[0-9]+/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$' then
    return false;
  end if;
  v_organisation_id := split_part(object_name, '/', 1)::bigint;
  v_membership_id := split_part(object_name, '/', 2)::bigint;
  return exists (
    select 1
    from private.current_membership_actual() context
    join public.memberships target
      on target.id = v_membership_id
      and target.organisation_id = context.organisation_id
    where v_organisation_id = context.organisation_id
      and (
        context.role in ('owner', 'manager')
        or target.id = context.membership_id
      )
  );
end;
$$;

create function private.can_manage_avatar(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_organisation_id bigint;
  v_membership_id bigint;
begin
  if object_name !~ '^[0-9]+/[0-9]+/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$' then
    return false;
  end if;
  v_organisation_id := split_part(object_name, '/', 1)::bigint;
  v_membership_id := split_part(object_name, '/', 2)::bigint;
  return exists (
    select 1
    from private.current_membership_actual() context
    join public.memberships target
      on target.id = v_membership_id
      and target.organisation_id = context.organisation_id
    where v_organisation_id = context.organisation_id
      and (
        context.role = 'owner'
        or target.id = context.membership_id
        or (context.role = 'manager' and target.role = 'employee')
      )
  );
end;
$$;

revoke all on function private.can_manage_avatar(text)
  from public, anon, authenticated, service_role;
grant execute on function private.can_manage_avatar(text) to authenticated;

drop policy avatars_insert_owner on storage.objects;
create policy avatars_insert_people_manager
on storage.objects for insert to authenticated
with check (
  bucket_id = 'avatars'
  and (select private.can_manage_avatar(name))
);

drop policy avatars_update_owner on storage.objects;
create policy avatars_update_people_manager
on storage.objects for update to authenticated
using (
  bucket_id = 'avatars'
  and (select private.can_manage_avatar(name))
)
with check (
  bucket_id = 'avatars'
  and (select private.can_manage_avatar(name))
);

drop policy avatars_delete_owner on storage.objects;
create policy avatars_delete_people_manager
on storage.objects for delete to authenticated
using (
  bucket_id = 'avatars'
  and (select private.can_manage_avatar(name))
);

create function public.delete_invited_team_member(p_membership_id bigint)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor record;
  v_target public.memberships;
begin
  select *
  into v_actor
  from private.current_membership_actual() context;
  if v_actor.role not in ('owner', 'manager') then
    raise exception 'team member management is not permitted'
      using errcode = '42501';
  end if;

  perform 1
  from public.organisations
  where id = v_actor.organisation_id
  for update;

  select *
  into v_target
  from public.memberships
  where id = p_membership_id
    and organisation_id = v_actor.organisation_id
    and status = 'invited'
    and user_id is null
  for update;
  if v_target.id is null then
    return false;
  end if;
  if v_actor.role = 'manager' and v_target.role <> 'employee' then
    raise exception 'managers can manage employees only' using errcode = '42501';
  end if;

  delete from public.employee_profiles
  where membership_id = v_target.id
    and organisation_id = v_actor.organisation_id;
  delete from public.memberships
  where id = v_target.id
    and organisation_id = v_actor.organisation_id;
  return true;
end;
$$;

revoke all on function public.delete_invited_team_member(bigint)
  from public, anon;
grant execute on function public.delete_invited_team_member(bigint)
  to authenticated;

-- Least-privilege grants required by RLS helpers.
grant execute on function private.is_operations_role(public.membership_role),
  private.is_worker_role(public.membership_role)
  to authenticated;

-- Compatibility wrappers and roster/submission corrections.
create or replace function public.create_employee(
  p_email text,
  p_first_name text,
  p_last_name text,
  p_phone text,
  p_job_title text
)
returns table (
  membership_id bigint,
  profile_id bigint,
  membership_status public.membership_status,
  auth_user_id uuid,
  created boolean
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  select
    result.membership_id,
    result.profile_id,
    membership.status,
    membership.user_id,
    result.created
  from public.create_team_member(
    p_email,
    p_first_name,
    p_last_name,
    p_phone,
    p_job_title,
    'employee'
  ) result
  join public.memberships membership on membership.id = result.membership_id;
end;
$$;

drop policy roster_shifts_select_active_membership on public.roster_shifts;
create policy roster_shifts_select_active_membership
on public.roster_shifts for select to authenticated
using (
  archived_at is null
  and organisation_id = (
    select context.organisation_id from private.current_membership_actual() context
  )
  and (
    (select private.is_operations_role(context.role)
     from private.current_membership_actual() context)
    or employee_membership_id = (
      select context.membership_id from private.current_membership_actual() context
    )
  )
);

create or replace function public.submit_job(p_job_id bigint)
returns table (
  job_id bigint,
  notification_id bigint,
  submission_update_id bigint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor record;
  v_job public.jobs;
  v_notification_id bigint;
  v_submission_update_id bigint;
  v_required_role public.membership_role;
begin
  select *
  into v_actor
  from private.current_membership_actual() context
  where context.role in ('employee', 'manager');
  if v_actor.membership_id is null then
    raise exception 'assigned worker membership required' using errcode = '42501';
  end if;

  select *
  into v_job
  from public.jobs job
  where job.id = p_job_id
    and job.organisation_id = v_actor.organisation_id
  for update;
  if v_job.id is null or v_job.assignee_membership_id <> v_actor.membership_id then
    raise exception 'job is unavailable' using errcode = 'P0002';
  end if;
  if v_job.status = 'in_review' then
    select delivery.id, delivery.submission_update_id
    into v_notification_id, v_submission_update_id
    from public.job_notification_deliveries delivery
    where delivery.job_id = v_job.id
    order by delivery.created_at desc
    limit 1;
    return query select v_job.id, v_notification_id, v_submission_update_id;
    return;
  end if;
  if v_job.status not in ('assigned', 'in_progress') then
    raise exception 'job cannot be submitted' using errcode = '22023';
  end if;
  if v_job.requires_completion_note and not exists (
    select 1 from public.job_updates update_row
    where update_row.job_id = v_job.id
      and update_row.type = 'note'
      and update_row.author_membership_id = v_actor.membership_id
  ) then
    raise exception 'add a completion note before submitting'
      using errcode = '22023';
  end if;
  if (
    select count(*) from public.job_assets asset
    where asset.job_id = v_job.id and asset.archived_at is null
  ) < v_job.minimum_completion_photos then
    raise exception 'add the required completion photos before submitting'
      using errcode = '22023';
  end if;

  v_required_role := case
    when v_actor.role = 'manager' then 'owner'::public.membership_role
    else 'manager'::public.membership_role
  end;
  update public.jobs
  set
    status = 'in_review',
    submitted_at = now(),
    submission_version = submission_version + 1,
    submitted_by_membership_id = v_actor.membership_id,
    required_reviewer_role = v_required_role,
    reviewed_by_membership_id = null,
    reviewed_by_role = null,
    reviewed_at = null
  where id = v_job.id
  returning * into v_job;

  insert into public.job_updates (
    organisation_id, job_id, author_membership_id, type, metadata
  )
  values (
    v_actor.organisation_id,
    v_job.id,
    v_actor.membership_id,
    'status_change',
    jsonb_build_object(
      'previous_status',
      case when v_job.started_at is null then 'assigned' else 'in_progress' end,
      'new_status', 'in_review',
      'submission_version', v_job.submission_version,
      'submitter_role', v_actor.role,
      'required_reviewer_role', v_required_role
    )
  )
  returning id into v_submission_update_id;

  insert into public.job_notification_deliveries (
    organisation_id,
    job_id,
    submission_update_id,
    recipient_membership_id,
    recipient_email,
    status
  )
  select
    v_actor.organisation_id,
    v_job.id,
    v_submission_update_id,
    reviewer.id,
    reviewer.email,
    'queued'
  from public.memberships reviewer
  where reviewer.organisation_id = v_actor.organisation_id
    and reviewer.status = 'active'
    and reviewer.id <> v_actor.membership_id
    and (
      reviewer.role = 'owner'
      or (v_required_role = 'manager' and reviewer.role = 'manager')
    )
  on conflict on constraint job_notification_submission_recipient_unique
  do nothing;

  select min(delivery.id)
  into v_notification_id
  from public.job_notification_deliveries delivery
  where delivery.submission_update_id = v_submission_update_id;
  return query select v_job.id, v_notification_id, v_submission_update_id;
end;
$$;

revoke all on function public.create_employee(text, text, text, text, text),
  public.submit_job(bigint)
  from public, anon;
grant execute on function public.create_employee(text, text, text, text, text),
  public.submit_job(bigint)
  to authenticated;

-- Membership lifecycle enum-safe implementation.
create or replace function public.set_membership_active(
  p_membership_id bigint,
  p_active boolean
)
returns public.memberships
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor record;
  v_target public.memberships;
begin
  select *
  into v_actor
  from private.current_membership_actual() context;
  if v_actor.role not in ('owner', 'manager') then
    raise exception 'team member management is not permitted'
      using errcode = '42501';
  end if;

  perform 1
  from public.organisations
  where id = v_actor.organisation_id
  for update;

  select *
  into v_target
  from public.memberships
  where id = p_membership_id
    and organisation_id = v_actor.organisation_id
  for update;
  if v_target.id is null then
    raise exception 'team member is unavailable' using errcode = 'P0002';
  end if;
  if v_actor.role = 'manager' and v_target.role <> 'employee' then
    raise exception 'managers can manage employees only' using errcode = '42501';
  end if;
  if v_target.status = 'invited' then
    raise exception 'an invited member cannot be activated manually'
      using errcode = '22023';
  end if;

  update public.memberships
  set
    status = case
      when p_active then 'active'::public.membership_status
      else 'inactive'::public.membership_status
    end,
    deactivated_at = case when p_active then null else now() end
  where id = v_target.id
  returning * into v_target;
  return v_target;
end;
$$;

revoke all on function public.set_membership_active(bigint, boolean)
  from public, anon;
grant execute on function public.set_membership_active(bigint, boolean)
  to authenticated;

-- Realtime, evidence, and reviewer-notification hardening.
drop policy operations_realtime_receive on realtime.messages;
create policy operations_realtime_receive
on realtime.messages
for select
to authenticated
using (
  exists (
    select 1
    from private.current_membership_actual() context
    where (
      context.role in ('owner', 'manager')
      and realtime.topic() =
        'org:' || context.organisation_id::text || ':operations'
    )
    or (
      context.role = 'employee'
      and realtime.topic() =
        'member:' || context.membership_id::text || ':work'
    )
  )
);

create or replace function private.can_read_job_evidence(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_organisation_id bigint;
  v_job_id bigint;
begin
  if object_name !~ '^[0-9]+/[0-9]+/[0-9]+/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp|heic|heif)$' then
    return false;
  end if;
  v_organisation_id := split_part(object_name, '/', 1)::bigint;
  v_job_id := split_part(object_name, '/', 2)::bigint;
  return exists (
    select 1
    from private.current_membership_actual() context
    join public.jobs job
      on job.id = v_job_id
      and job.organisation_id = context.organisation_id
    where v_organisation_id = context.organisation_id
      and (
        context.role in ('owner', 'manager')
        or job.assignee_membership_id = context.membership_id
      )
  );
end;
$$;

drop policy job_notification_deliveries_select_operations
  on public.job_notification_deliveries;
create policy job_notification_deliveries_select_eligible_reviewer
on public.job_notification_deliveries
for select
to authenticated
using (
  organisation_id = (
    select context.organisation_id
    from private.current_membership_actual() context
    where context.role in ('owner', 'manager')
  )
  and (
    (
      select context.role = 'owner'
      from private.current_membership_actual() context
    )
    or exists (
      select 1
      from public.jobs job
      where job.id = job_notification_deliveries.job_id
        and job.organisation_id = job_notification_deliveries.organisation_id
        and job.required_reviewer_role = 'manager'
        and job.submitted_by_membership_id <> (
          select context.membership_id
          from private.current_membership_actual() context
        )
    )
  )
);

create or replace function public.retry_job_notification(p_delivery_id bigint)
returns public.job_notification_deliveries
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor record;
  v_delivery public.job_notification_deliveries;
  v_job public.jobs;
begin
  select *
  into v_actor
  from private.current_membership_actual() context
  where context.role in ('owner', 'manager');
  if v_actor.membership_id is null then
    raise exception 'reviewer membership required' using errcode = '42501';
  end if;

  select *
  into v_delivery
  from public.job_notification_deliveries delivery
  where delivery.id = p_delivery_id
    and delivery.organisation_id = v_actor.organisation_id
  for update;
  if v_delivery.id is null then
    raise exception 'notification is unavailable' using errcode = 'P0002';
  end if;

  select *
  into v_job
  from public.jobs job
  where job.id = v_delivery.job_id
    and job.organisation_id = v_actor.organisation_id;
  if v_actor.role = 'manager'
    and (
      v_job.required_reviewer_role <> 'manager'
      or v_job.submitted_by_membership_id = v_actor.membership_id
    ) then
    raise exception 'a higher-level reviewer is required' using errcode = '42501';
  end if;
  if v_delivery.status = 'sent' then
    return v_delivery;
  end if;
  if v_delivery.recipient_membership_id is null
    or v_delivery.recipient_email is null then
    raise exception 'notification has no active reviewer recipient'
      using errcode = '22023';
  end if;

  update public.job_notification_deliveries
  set status = 'queued', error_message = null
  where id = v_delivery.id
  returning * into v_delivery;
  return v_delivery;
end;
$$;

revoke all on function public.retry_job_notification(bigint)
  from public, anon;
grant execute on function public.retry_job_notification(bigint)
  to authenticated;

-- Submission-version enforcement for shared review.
alter function public.archive_job(bigint)
  rename to archive_job_unversioned;
alter function public.archive_job_unversioned(bigint)
  set schema private;

alter function public.reopen_job(bigint, text, bigint)
  rename to reopen_job_unversioned;
alter function public.reopen_job_unversioned(bigint, text, bigint)
  set schema private;

revoke all on function private.archive_job_unversioned(bigint),
  private.reopen_job_unversioned(bigint, text, bigint)
  from public, anon, authenticated, service_role;

create function public.archive_job(
  p_job_id bigint,
  p_expected_submission_version integer
)
returns public.jobs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor record;
  v_job public.jobs;
begin
  select *
  into v_actor
  from private.current_membership_actual() context
  where context.role in ('owner', 'manager');
  if v_actor.membership_id is null then
    raise exception 'reviewer membership required' using errcode = '42501';
  end if;

  select *
  into v_job
  from public.jobs job
  where job.id = p_job_id
    and job.organisation_id = v_actor.organisation_id
  for update;
  if v_job.id is null then
    raise exception 'job is unavailable' using errcode = 'P0002';
  end if;
  if v_job.submission_version <> p_expected_submission_version then
    raise exception 'job submission changed before review'
      using errcode = '40001';
  end if;

  return private.archive_job_unversioned(p_job_id);
end;
$$;

create function public.reopen_job(
  p_job_id bigint,
  p_feedback text,
  p_assignee_membership_id bigint,
  p_expected_submission_version integer
)
returns public.jobs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor record;
  v_job public.jobs;
begin
  select *
  into v_actor
  from private.current_membership_actual() context
  where context.role in ('owner', 'manager');
  if v_actor.membership_id is null then
    raise exception 'reviewer membership required' using errcode = '42501';
  end if;

  select *
  into v_job
  from public.jobs job
  where job.id = p_job_id
    and job.organisation_id = v_actor.organisation_id
  for update;
  if v_job.id is null then
    raise exception 'job is unavailable' using errcode = 'P0002';
  end if;
  if v_job.submission_version <> p_expected_submission_version then
    raise exception 'job submission changed before review'
      using errcode = '40001';
  end if;

  return private.reopen_job_unversioned(
    p_job_id,
    p_feedback,
    p_assignee_membership_id
  );
end;
$$;

revoke all on function public.archive_job(bigint, integer),
  public.reopen_job(bigint, text, bigint, integer)
  from public, anon;
grant execute on function public.archive_job(bigint, integer),
  public.reopen_job(bigint, text, bigint, integer)
  to authenticated;
