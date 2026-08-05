alter table public.job_schedules
  alter column assignee_membership_id drop not null;

create or replace function public.upsert_job_schedule(
  p_schedule_id bigint,
  p_template_id bigint,
  p_assignee_membership_id bigint,
  p_recurrence_type public.job_schedule_recurrence,
  p_weekdays smallint[],
  p_local_time time,
  p_starts_on date,
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
      organisation_id,
      template_id,
      assignee_membership_id,
      recurrence_type,
      weekdays,
      local_time,
      starts_on,
      ends_on,
      timezone,
      is_enabled,
      next_occurrence_at,
      created_by
    )
    values (
      v_actor.organisation_id,
      p_template_id,
      p_assignee_membership_id,
      p_recurrence_type,
      v_weekdays,
      p_local_time,
      p_starts_on,
      p_ends_on,
      v_timezone,
      p_is_enabled,
      case when p_is_enabled then private.next_job_schedule_occurrence(
        p_recurrence_type,
        v_weekdays,
        p_local_time,
        p_starts_on,
        p_ends_on,
        v_timezone,
        clock_timestamp()
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
          p_recurrence_type,
          v_weekdays,
          p_local_time,
          p_starts_on,
          p_ends_on,
          v_timezone,
          clock_timestamp()
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

create or replace function private.generate_due_job_schedules(
  p_now timestamptz default clock_timestamp(),
  p_limit integer default 100
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer := 0;
  v_failed_schedule_ids bigint[] := array[]::bigint[];
  v_inserted boolean;
  v_job public.jobs;
  v_occurrence public.job_schedule_occurrences;
  v_schedule public.job_schedules;
  v_template public.job_templates;
begin
  p_limit := greatest(1, least(coalesce(p_limit, 100), 500));

  while v_count < p_limit loop
    select *
    into v_schedule
    from public.job_schedules
    where is_enabled
      and deleted_at is null
      and next_occurrence_at <= p_now
      and not (id = any(v_failed_schedule_ids))
    order by next_occurrence_at, id
    limit 1
    for update skip locked;
    exit when not found;

    select *
    into v_template
    from public.job_templates
    where id = v_schedule.template_id
      and organisation_id = v_schedule.organisation_id;

    insert into public.job_schedule_occurrences (
      organisation_id,
      schedule_id,
      occurrence_at,
      payload
    )
    values (
      v_schedule.organisation_id,
      v_schedule.id,
      v_schedule.next_occurrence_at,
      jsonb_build_object(
        'template_id', v_template.id,
        'assignee_membership_id', v_schedule.assignee_membership_id,
        'title', v_template.title,
        'description', v_template.description,
        'location', v_template.location,
        'priority', v_template.priority,
        'requires_completion_note', v_template.requires_completion_note,
        'minimum_completion_photos', v_template.minimum_completion_photos,
        'created_by', v_schedule.created_by
      )
    )
    on conflict (schedule_id, occurrence_at) do nothing;

    select *
    into v_occurrence
    from public.job_schedule_occurrences
    where schedule_id = v_schedule.id
      and occurrence_at = v_schedule.next_occurrence_at
    for update;

    begin
      if v_schedule.assignee_membership_id is not null and not exists (
        select 1
        from public.memberships as membership
        where membership.id = v_schedule.assignee_membership_id
          and membership.organisation_id = v_schedule.organisation_id
          and membership.role = 'employee'
          and membership.status = 'active'
      ) then
        raise exception 'schedule assignee is no longer active'
          using errcode = '22023';
      end if;

      v_job := null;
      insert into public.jobs (
        organisation_id,
        template_id,
        schedule_id,
        schedule_occurrence_at,
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
        created_by
      )
      values (
        v_schedule.organisation_id,
        (v_occurrence.payload ->> 'template_id')::bigint,
        v_schedule.id,
        v_occurrence.occurrence_at,
        (v_occurrence.payload ->> 'assignee_membership_id')::bigint,
        v_occurrence.payload ->> 'title',
        v_occurrence.payload ->> 'description',
        v_occurrence.payload ->> 'location',
        (v_occurrence.payload ->> 'priority')::public.job_priority,
        'assigned',
        v_occurrence.occurrence_at,
        v_occurrence.occurrence_at,
        (v_occurrence.payload ->> 'requires_completion_note')::boolean,
        (v_occurrence.payload ->> 'minimum_completion_photos')::integer,
        (v_occurrence.payload ->> 'created_by')::bigint
      )
      on conflict (schedule_id, schedule_occurrence_at)
        where schedule_id is not null and schedule_occurrence_at is not null
      do nothing
      returning * into v_job;
      v_inserted := v_job.id is not null;

      if not v_inserted then
        select *
        into v_job
        from public.jobs
        where schedule_id = v_schedule.id
          and schedule_occurrence_at = v_occurrence.occurrence_at;
      end if;

      if v_inserted then
        insert into public.job_updates (
          organisation_id,
          job_id,
          author_membership_id,
          type,
          metadata
        )
        values (
          v_schedule.organisation_id,
          v_job.id,
          null,
          'system',
          jsonb_build_object(
            'event', 'created_from_schedule',
            'template_id', v_template.id,
            'schedule_id', v_schedule.id,
            'schedule_occurrence_at', v_occurrence.occurrence_at
          )
        );

        if v_job.assignee_membership_id is not null then
          insert into public.job_updates (
            organisation_id,
            job_id,
            author_membership_id,
            type,
            metadata
          )
          values (
            v_schedule.organisation_id,
            v_job.id,
            null,
            'assignment_change',
            jsonb_build_object(
              'previous_assignee_membership_id', null,
              'new_assignee_membership_id', v_job.assignee_membership_id,
              'source', 'schedule'
            )
          );
        end if;
      end if;

      update public.job_schedule_occurrences
      set
        status = 'generated',
        job_id = v_job.id,
        attempt_count = attempt_count + 1,
        last_attempted_at = clock_timestamp(),
        generated_at = coalesce(generated_at, clock_timestamp()),
        last_error = null
      where id = v_occurrence.id;

      update public.job_schedules
      set next_occurrence_at = private.next_job_schedule_occurrence(
        recurrence_type,
        weekdays,
        local_time,
        starts_on,
        ends_on,
        timezone,
        v_occurrence.occurrence_at + interval '1 minute'
      )
      where id = v_schedule.id;
    exception when others then
      update public.job_schedule_occurrences
      set
        status = 'failed',
        job_id = null,
        attempt_count = attempt_count + 1,
        last_attempted_at = clock_timestamp(),
        generated_at = null,
        last_error = left(sqlerrm, 500)
      where id = v_occurrence.id;
      v_failed_schedule_ids := array_append(
        v_failed_schedule_ids,
        v_schedule.id
      );
    end;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;
