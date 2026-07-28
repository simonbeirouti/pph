alter table public.roster_shifts
add column locked_at timestamptz,
add column locked_by bigint references public.memberships(id) on delete restrict;

comment on column public.roster_shifts.locked_at is
  'When present, the shift is immutable except for an owner unlocking it.';

create function private.enforce_roster_shift_lock()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.locked_at is not null and (
    new.organisation_id is distinct from old.organisation_id
    or new.employee_membership_id is distinct from old.employee_membership_id
    or new.starts_at is distinct from old.starts_at
    or new.ends_at is distinct from old.ends_at
    or new.notes is distinct from old.notes
    or new.created_by is distinct from old.created_by
    or new.created_at is distinct from old.created_at
    or new.archived_at is distinct from old.archived_at
  ) then
    raise exception 'locked roster shifts must be unlocked before changing'
      using errcode = '42501';
  end if;

  if new.locked_at is not null and new.locked_by is null then
    raise exception 'locked roster shifts require a locking membership'
      using errcode = '23514';
  end if;
  if new.locked_at is null then
    new.locked_by := null;
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_roster_shift_lock()
from public, anon, authenticated;

create trigger roster_shifts_enforce_lock
before update on public.roster_shifts
for each row execute function private.enforce_roster_shift_lock();

drop policy roster_shifts_select_active_membership
on public.roster_shifts;

create policy roster_shifts_select_active_membership
on public.roster_shifts
for select
to authenticated
using (
  archived_at is null
  and organisation_id = (
    select context.organisation_id
    from private.current_membership_context() as context
  )
  and (
    (
      select context.role
      from private.current_membership_context() as context
    ) = 'owner'
    or employee_membership_id = (
      select context.membership_id
      from private.current_membership_context() as context
    )
  )
);

create policy roster_shifts_insert_owner
on public.roster_shifts
for insert
to authenticated
with check (
  organisation_id = (
    select context.organisation_id
    from private.current_membership_context() as context
  )
  and created_by = (
    select context.membership_id
    from private.current_membership_context() as context
  )
  and (
    select context.role
    from private.current_membership_context() as context
  ) = 'owner'
  and exists (
    select 1
    from public.memberships as target
    where target.id = employee_membership_id
      and target.organisation_id = roster_shifts.organisation_id
      and target.role = 'employee'
      and target.status = 'active'
  )
);

create policy roster_shifts_update_owner
on public.roster_shifts
for update
to authenticated
using (
  archived_at is null
  and organisation_id = (
    select context.organisation_id
    from private.current_membership_context() as context
  )
  and (
    select context.role
    from private.current_membership_context() as context
  ) = 'owner'
)
with check (
  organisation_id = (
    select context.organisation_id
    from private.current_membership_context() as context
  )
  and (
    select context.role
    from private.current_membership_context() as context
  ) = 'owner'
  and exists (
    select 1
    from public.memberships as target
    where target.id = employee_membership_id
      and target.organisation_id = roster_shifts.organisation_id
      and target.role = 'employee'
      and target.status = 'active'
  )
);

grant insert (
  organisation_id,
  employee_membership_id,
  starts_at,
  ends_at,
  notes,
  created_by
) on public.roster_shifts to authenticated;

grant update (
  employee_membership_id,
  starts_at,
  ends_at,
  notes,
  archived_at,
  locked_at,
  locked_by
) on public.roster_shifts to authenticated;

grant usage, select on sequence public.roster_shifts_id_seq to authenticated;

create function public.create_roster_shift_with_jobs(
  p_employee_membership_id bigint,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_notes text default '',
  p_job_ids bigint[] default '{}'::bigint[]
)
returns public.roster_shifts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor record;
  v_job_ids bigint[];
  v_locked_job_count integer;
  v_shift public.roster_shifts;
begin
  select context.membership_id, context.organisation_id
  into v_actor
  from private.current_membership_context() as context
  where context.role = 'owner';

  if v_actor.membership_id is null then
    raise exception 'owner membership required' using errcode = '42501';
  end if;
  if p_employee_membership_id is null or not exists (
    select 1
    from public.memberships as employee
    where employee.id = p_employee_membership_id
      and employee.organisation_id = v_actor.organisation_id
      and employee.role = 'employee'
      and employee.status = 'active'
  ) then
    raise exception 'employee must be active in the organisation'
      using errcode = '22023';
  end if;
  if p_starts_at is null or p_ends_at is null or p_starts_at >= p_ends_at then
    raise exception 'shift end must be after its start'
      using errcode = '22023';
  end if;
  if length(btrim(coalesce(p_notes, ''))) > 500 then
    raise exception 'shift notes must be 500 characters or fewer'
      using errcode = '22023';
  end if;
  if exists (
    select 1
    from unnest(coalesce(p_job_ids, '{}'::bigint[])) as requested(job_id)
    where requested.job_id is null or requested.job_id <= 0
  ) then
    raise exception 'job selection is invalid' using errcode = '22023';
  end if;

  select coalesce(array_agg(distinct requested.job_id order by requested.job_id), '{}'::bigint[])
  into v_job_ids
  from unnest(coalesce(p_job_ids, '{}'::bigint[])) as requested(job_id);

  if cardinality(v_job_ids) > 100 then
    raise exception 'choose no more than 100 jobs' using errcode = '22023';
  end if;

  if cardinality(v_job_ids) > 0 then
    perform job.id
    from public.jobs as job
    where job.id = any(v_job_ids)
      and job.organisation_id = v_actor.organisation_id
      and job.status = 'assigned'
      and job.archived_at is null
    order by job.id
    for update;

    get diagnostics v_locked_job_count = row_count;
    if v_locked_job_count <> cardinality(v_job_ids) then
      raise exception 'one or more jobs are no longer available'
        using errcode = 'P0002';
    end if;
  end if;

  insert into public.roster_shifts (
    organisation_id,
    employee_membership_id,
    starts_at,
    ends_at,
    notes,
    created_by
  )
  values (
    v_actor.organisation_id,
    p_employee_membership_id,
    p_starts_at,
    p_ends_at,
    btrim(coalesce(p_notes, '')),
    v_actor.membership_id
  )
  returning * into v_shift;

  if cardinality(v_job_ids) > 0 then
    insert into public.job_updates (
      organisation_id,
      job_id,
      author_membership_id,
      type,
      metadata
    )
    select
      v_actor.organisation_id,
      job.id,
      v_actor.membership_id,
      'assignment_change',
      jsonb_build_object(
        'previous_assignee_membership_id', job.assignee_membership_id,
        'new_assignee_membership_id', p_employee_membership_id
      )
    from public.jobs as job
    where job.id = any(v_job_ids)
      and job.organisation_id = v_actor.organisation_id
      and job.assignee_membership_id is distinct from p_employee_membership_id;

    insert into public.job_updates (
      organisation_id,
      job_id,
      author_membership_id,
      type,
      metadata
    )
    select
      v_actor.organisation_id,
      job.id,
      v_actor.membership_id,
      'system',
      jsonb_build_object(
        'event', 'scheduled_from_roster_shift',
        'roster_shift_id', v_shift.id,
        'previous_scheduled_at', job.scheduled_at,
        'previous_due_at', job.due_at,
        'scheduled_at', p_starts_at,
        'due_at', p_ends_at
      )
    from public.jobs as job
    where job.id = any(v_job_ids)
      and job.organisation_id = v_actor.organisation_id;

    update public.jobs as job
    set
      assignee_membership_id = p_employee_membership_id,
      scheduled_at = p_starts_at,
      due_at = p_ends_at
    where job.id = any(v_job_ids)
      and job.organisation_id = v_actor.organisation_id;
  end if;

  return v_shift;
end;
$$;

revoke all on function public.create_roster_shift_with_jobs(
  bigint,
  timestamptz,
  timestamptz,
  text,
  bigint[]
) from public, anon, authenticated, service_role;

grant execute on function public.create_roster_shift_with_jobs(
  bigint,
  timestamptz,
  timestamptz,
  text,
  bigint[]
) to authenticated;

create function public.archive_roster_shift(
  p_shift_id bigint,
  p_expected_updated_at timestamptz
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor record;
  v_shift_id bigint;
begin
  select context.membership_id, context.organisation_id
  into v_actor
  from private.current_membership_context() as context
  where context.role = 'owner';

  if v_actor.membership_id is null then
    raise exception 'owner membership required' using errcode = '42501';
  end if;
  if p_shift_id is null or p_shift_id <= 0 or p_expected_updated_at is null then
    raise exception 'shift selection is invalid' using errcode = '22023';
  end if;

  update public.roster_shifts as shift
  set archived_at = now()
  where shift.id = p_shift_id
    and shift.organisation_id = v_actor.organisation_id
    and shift.archived_at is null
    and shift.locked_at is null
    and shift.updated_at = p_expected_updated_at
    and exists (
      select 1
      from public.memberships as employee
      where employee.id = shift.employee_membership_id
        and employee.organisation_id = shift.organisation_id
        and employee.role = 'employee'
        and employee.status = 'active'
    )
  returning shift.id into v_shift_id;

  if v_shift_id is null then
    raise exception 'shift is unavailable, locked, or changed'
      using errcode = 'P0002';
  end if;

  return v_shift_id;
end;
$$;

revoke all on function public.archive_roster_shift(
  bigint,
  timestamptz
) from public, anon, authenticated, service_role;

grant execute on function public.archive_roster_shift(
  bigint,
  timestamptz
) to authenticated;
