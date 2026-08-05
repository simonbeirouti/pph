create or replace function public.upsert_job_schedule(
  p_schedule_id bigint,
  p_template_id bigint,
  p_assignee_membership_id bigint default null,
  p_recurrence_type public.job_schedule_recurrence default 'daily',
  p_weekdays smallint[] default '{}',
  p_local_time time default '09:00',
  p_starts_on date default current_date,
  p_ends_on date default null,
  p_is_enabled boolean default true
)
returns public.job_schedules
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor record;
  v_schedule public.job_schedules;
  v_timezone text;
  v_weekdays smallint[];
begin
  select context.membership_id, context.organisation_id
  into v_actor
  from private.current_membership_context() as context
  where context.role = 'owner';
  if v_actor.membership_id is null then
    raise exception 'owner membership required' using errcode = '42501';
  end if;

  select organisation.timezone
  into v_timezone
  from public.organisations as organisation
  where organisation.id = v_actor.organisation_id;

  v_weekdays := case
    when p_recurrence_type = 'daily' then array[]::smallint[]
    else (
      select coalesce(array_agg(distinct weekday order by weekday), '{}')
      from unnest(coalesce(p_weekdays, '{}')) as weekday
      where weekday between 1 and 7
    )
  end;

  if p_recurrence_type = 'weekly' and cardinality(v_weekdays) = 0 then
    raise exception 'weekly schedules require at least one weekday'
      using errcode = '22023';
  end if;
  if p_ends_on is not null and p_ends_on < p_starts_on then
    raise exception 'end date cannot precede start date'
      using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.job_templates as template
    where template.id = p_template_id
      and template.organisation_id = v_actor.organisation_id
      and template.is_active
  ) then
    raise exception 'schedule template must be active in the organisation'
      using errcode = '22023';
  end if;
  if p_assignee_membership_id is not null and not exists (
    select 1 from public.memberships as membership
    where membership.id = p_assignee_membership_id
      and membership.organisation_id = v_actor.organisation_id
      and membership.role = 'employee'
      and membership.status = 'active'
  ) then
    raise exception 'schedule assignee must be an active employee'
      using errcode = '22023';
  end if;

  if p_schedule_id is null then
    insert into public.job_schedules (
      organisation_id, template_id, assignee_membership_id, recurrence_type,
      weekdays, local_time, starts_on, ends_on, timezone, is_enabled,
      next_occurrence_at, created_by
    )
    values (
      v_actor.organisation_id, p_template_id, p_assignee_membership_id,
      p_recurrence_type, v_weekdays, p_local_time, p_starts_on, p_ends_on,
      v_timezone, p_is_enabled,
      case when p_is_enabled then private.next_job_schedule_occurrence(
        p_recurrence_type, v_weekdays, p_local_time, p_starts_on, p_ends_on,
        v_timezone, clock_timestamp()
      ) end,
      v_actor.membership_id
    )
    returning * into v_schedule;
  else
    update public.job_schedules
    set
      template_id = p_template_id,
      assignee_membership_id = p_assignee_membership_id,
      recurrence_type = p_recurrence_type,
      weekdays = v_weekdays,
      local_time = p_local_time,
      starts_on = p_starts_on,
      ends_on = p_ends_on,
      timezone = v_timezone,
      is_enabled = p_is_enabled,
      next_occurrence_at = case when p_is_enabled then
        private.next_job_schedule_occurrence(
          p_recurrence_type, v_weekdays, p_local_time, p_starts_on,
          p_ends_on, v_timezone, clock_timestamp()
        )
      end
    where id = p_schedule_id
      and organisation_id = v_actor.organisation_id
      and deleted_at is null
    returning * into v_schedule;
  end if;

  if v_schedule.id is null then
    raise exception 'schedule not found or has no future occurrence'
      using errcode = 'P0002';
  end if;
  if p_is_enabled and v_schedule.next_occurrence_at is null then
    raise exception 'schedule has no occurrence in its date range'
      using errcode = '22023';
  end if;
  return v_schedule;
end;
$$;

create or replace function public.create_job_schedule(
  p_template_id bigint,
  p_assignee_membership_id bigint default null,
  p_recurrence_type public.job_schedule_recurrence default 'daily',
  p_weekdays smallint[] default '{}',
  p_local_time time default '09:00',
  p_starts_on date default current_date,
  p_ends_on date default null,
  p_is_enabled boolean default true
)
returns public.job_schedules
language sql
security invoker
set search_path = ''
as $$
  select public.upsert_job_schedule(
    null,
    p_template_id,
    p_assignee_membership_id,
    p_recurrence_type,
    p_weekdays,
    p_local_time,
    p_starts_on,
    p_ends_on,
    p_is_enabled
  );
$$;
