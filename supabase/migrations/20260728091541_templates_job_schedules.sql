create type public.job_schedule_recurrence as enum ('daily', 'weekly');
create type public.job_schedule_occurrence_status as enum (
  'pending',
  'generated',
  'failed'
);

create function private.smallint_array_has_unique_values(p_values smallint[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select cardinality(p_values) = (
    select count(distinct value)
    from unnest(p_values) as value
  );
$$;

revoke all on function private.smallint_array_has_unique_values(smallint[])
  from public, anon, authenticated, service_role;
grant execute on function private.smallint_array_has_unique_values(smallint[])
  to service_role;

create table public.job_templates (
  id bigint generated always as identity primary key,
  organisation_id bigint not null references public.organisations(id) on delete restrict,
  assignee_membership_id bigint,
  title text not null constraint job_templates_title_not_blank check (btrim(title) <> ''),
  description text not null default '',
  location text not null default '',
  priority public.job_priority not null default 'normal',
  requires_completion_note boolean not null default false,
  minimum_completion_photos integer not null default 0
    constraint job_templates_minimum_photos_range
    check (minimum_completion_photos between 0 and 10),
  is_active boolean not null default true,
  created_by bigint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint job_templates_id_organisation_unique unique (id, organisation_id),
  constraint job_templates_assignee_organisation_fkey
    foreign key (assignee_membership_id, organisation_id)
    references public.memberships(id, organisation_id)
    on delete restrict,
  constraint job_templates_creator_organisation_fkey
    foreign key (created_by, organisation_id)
    references public.memberships(id, organisation_id)
    on delete restrict
);

create table public.job_schedules (
  id bigint generated always as identity primary key,
  organisation_id bigint not null references public.organisations(id) on delete restrict,
  template_id bigint not null,
  assignee_membership_id bigint not null,
  recurrence_type public.job_schedule_recurrence not null,
  weekdays smallint[] not null default '{}',
  local_time time not null,
  starts_on date not null,
  ends_on date,
  timezone text not null,
  is_enabled boolean not null default true,
  next_occurrence_at timestamptz,
  created_by bigint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint job_schedules_id_organisation_unique unique (id, organisation_id),
  constraint job_schedules_template_organisation_fkey
    foreign key (template_id, organisation_id)
    references public.job_templates(id, organisation_id)
    on delete restrict,
  constraint job_schedules_assignee_organisation_fkey
    foreign key (assignee_membership_id, organisation_id)
    references public.memberships(id, organisation_id)
    on delete restrict,
  constraint job_schedules_creator_organisation_fkey
    foreign key (created_by, organisation_id)
    references public.memberships(id, organisation_id)
    on delete restrict,
  constraint job_schedules_date_range check (
    ends_on is null or ends_on >= starts_on
  ),
  constraint job_schedules_weekdays check (
    (
      recurrence_type = 'daily'
      and cardinality(weekdays) = 0
    )
    or (
      recurrence_type = 'weekly'
      and cardinality(weekdays) between 1 and 7
      and weekdays <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[]
      and private.smallint_array_has_unique_values(weekdays)
    )
  )
);

create table public.job_schedule_occurrences (
  id bigint generated always as identity primary key,
  organisation_id bigint not null references public.organisations(id) on delete restrict,
  schedule_id bigint not null,
  occurrence_at timestamptz not null,
  payload jsonb not null,
  status public.job_schedule_occurrence_status not null default 'pending',
  job_id bigint,
  attempt_count integer not null default 0
    constraint job_schedule_occurrences_attempt_count check (attempt_count >= 0),
  last_attempted_at timestamptz,
  generated_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint job_schedule_occurrences_id_organisation_unique
    unique (id, organisation_id),
  constraint job_schedule_occurrences_schedule_organisation_fkey
    foreign key (schedule_id, organisation_id)
    references public.job_schedules(id, organisation_id)
    on delete restrict,
  constraint job_schedule_occurrences_job_organisation_fkey
    foreign key (job_id, organisation_id)
    references public.jobs(id, organisation_id)
    on delete restrict,
  constraint job_schedule_occurrences_schedule_at_unique
    unique (schedule_id, occurrence_at),
  constraint job_schedule_occurrences_state check (
    (status = 'generated' and job_id is not null and generated_at is not null and last_error is null)
    or (status = 'failed' and job_id is null and last_error is not null)
    or (status = 'pending' and job_id is null and generated_at is null)
  )
);

alter table public.jobs
  add constraint jobs_template_organisation_fkey
  foreign key (template_id, organisation_id)
  references public.job_templates(id, organisation_id)
  on delete restrict,
  add constraint jobs_schedule_organisation_fkey
  foreign key (schedule_id, organisation_id)
  references public.job_schedules(id, organisation_id)
  on delete restrict;

create index job_templates_organisation_active_idx
  on public.job_templates (organisation_id, updated_at desc)
  where is_active;
create index job_templates_assignee_idx
  on public.job_templates (assignee_membership_id)
  where assignee_membership_id is not null;
create index job_templates_created_by_idx on public.job_templates (created_by);

create index job_schedules_organisation_active_idx
  on public.job_schedules (organisation_id, next_occurrence_at)
  where deleted_at is null;
create index job_schedules_due_idx
  on public.job_schedules (next_occurrence_at, id)
  where is_enabled and deleted_at is null;
create index job_schedules_template_idx on public.job_schedules (template_id);
create index job_schedules_assignee_idx on public.job_schedules (assignee_membership_id);
create index job_schedules_created_by_idx on public.job_schedules (created_by);

create index job_schedule_occurrences_schedule_created_idx
  on public.job_schedule_occurrences (schedule_id, occurrence_at desc);
create index job_schedule_occurrences_failed_idx
  on public.job_schedule_occurrences (organisation_id, last_attempted_at desc)
  where status = 'failed';
create index job_schedule_occurrences_job_idx
  on public.job_schedule_occurrences (job_id)
  where job_id is not null;

create trigger job_templates_set_updated_at
before update on public.job_templates
for each row execute function private.set_updated_at();

create trigger job_schedules_set_updated_at
before update on public.job_schedules
for each row execute function private.set_updated_at();

create trigger job_schedule_occurrences_set_updated_at
before update on public.job_schedule_occurrences
for each row execute function private.set_updated_at();

alter table public.job_templates enable row level security;
alter table public.job_schedules enable row level security;
alter table public.job_schedule_occurrences enable row level security;

create policy job_templates_select_owner
on public.job_templates
for select
to authenticated
using (
  organisation_id = (
    select context.organisation_id
    from private.current_membership_context() as context
    where context.role = 'owner'
  )
);

create policy job_schedules_select_owner
on public.job_schedules
for select
to authenticated
using (
  organisation_id = (
    select context.organisation_id
    from private.current_membership_context() as context
    where context.role = 'owner'
  )
);

create policy job_schedule_occurrences_select_owner
on public.job_schedule_occurrences
for select
to authenticated
using (
  organisation_id = (
    select context.organisation_id
    from private.current_membership_context() as context
    where context.role = 'owner'
  )
);

revoke all on public.job_templates, public.job_schedules,
  public.job_schedule_occurrences from anon, authenticated;
grant select on public.job_templates, public.job_schedules,
  public.job_schedule_occurrences to authenticated;
grant all on public.job_templates, public.job_schedules,
  public.job_schedule_occurrences to service_role;

create function private.next_job_schedule_occurrence(
  p_recurrence_type public.job_schedule_recurrence,
  p_weekdays smallint[],
  p_local_time time,
  p_starts_on date,
  p_ends_on date,
  p_timezone text,
  p_not_before timestamptz
)
returns timestamptz
language plpgsql
stable
set search_path = ''
as $$
declare
  v_candidate_at timestamptz;
  v_candidate_date date;
  v_limit_date date;
begin
  if not exists (
    select 1 from pg_catalog.pg_timezone_names where name = p_timezone
  ) then
    raise exception 'timezone must be a valid IANA timezone'
      using errcode = '22023';
  end if;

  v_candidate_date := greatest(
    p_starts_on,
    (p_not_before at time zone p_timezone)::date
  );
  v_limit_date := least(
    coalesce(p_ends_on, v_candidate_date + 3660),
    v_candidate_date + 3660
  );

  while v_candidate_date <= v_limit_date loop
    if p_recurrence_type = 'daily'
      or extract(isodow from v_candidate_date)::smallint = any(p_weekdays)
    then
      v_candidate_at := (v_candidate_date + p_local_time) at time zone p_timezone;
      if v_candidate_at >= p_not_before then
        return v_candidate_at;
      end if;
    end if;
    v_candidate_date := v_candidate_date + 1;
  end loop;

  return null;
end;
$$;

revoke all on function private.next_job_schedule_occurrence(
  public.job_schedule_recurrence,
  smallint[],
  time,
  date,
  date,
  text,
  timestamptz
) from public, anon, authenticated, service_role;

create function public.upsert_job_template(
  p_template_id bigint,
  p_title text,
  p_description text default '',
  p_location text default '',
  p_priority public.job_priority default 'normal',
  p_assignee_membership_id bigint default null,
  p_requires_completion_note boolean default false,
  p_minimum_completion_photos integer default 0
)
returns public.job_templates
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor record;
  v_template public.job_templates;
begin
  select context.membership_id, context.organisation_id
  into v_actor
  from private.current_membership_context() as context
  where context.role = 'owner';

  if v_actor.membership_id is null then
    raise exception 'owner membership required' using errcode = '42501';
  end if;
  if btrim(coalesce(p_title, '')) = '' then
    raise exception 'template title is required' using errcode = '22023';
  end if;
  if p_minimum_completion_photos not between 0 and 10 then
    raise exception 'minimum completion photos must be between 0 and 10'
      using errcode = '22023';
  end if;
  if p_assignee_membership_id is not null and not exists (
    select 1
    from public.memberships as membership
    where membership.id = p_assignee_membership_id
      and membership.organisation_id = v_actor.organisation_id
      and membership.role = 'employee'
      and membership.status = 'active'
  ) then
    raise exception 'template assignee must be an active employee'
      using errcode = '22023';
  end if;

  if p_template_id is null then
    insert into public.job_templates (
      organisation_id,
      assignee_membership_id,
      title,
      description,
      location,
      priority,
      requires_completion_note,
      minimum_completion_photos,
      created_by
    )
    values (
      v_actor.organisation_id,
      p_assignee_membership_id,
      btrim(p_title),
      btrim(coalesce(p_description, '')),
      btrim(coalesce(p_location, '')),
      p_priority,
      p_requires_completion_note,
      p_minimum_completion_photos,
      v_actor.membership_id
    )
    returning * into v_template;
  else
    update public.job_templates
    set
      assignee_membership_id = p_assignee_membership_id,
      title = btrim(p_title),
      description = btrim(coalesce(p_description, '')),
      location = btrim(coalesce(p_location, '')),
      priority = p_priority,
      requires_completion_note = p_requires_completion_note,
      minimum_completion_photos = p_minimum_completion_photos
    where id = p_template_id
      and organisation_id = v_actor.organisation_id
    returning * into v_template;
  end if;

  if v_template.id is null then
    raise exception 'template not found' using errcode = 'P0002';
  end if;
  return v_template;
end;
$$;

create function public.set_job_template_active(
  p_template_id bigint,
  p_is_active boolean
)
returns public.job_templates
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor record;
  v_template public.job_templates;
begin
  select context.membership_id, context.organisation_id
  into v_actor
  from private.current_membership_context() as context
  where context.role = 'owner';
  if v_actor.membership_id is null then
    raise exception 'owner membership required' using errcode = '42501';
  end if;

  update public.job_templates
  set is_active = p_is_active
  where id = p_template_id
    and organisation_id = v_actor.organisation_id
  returning * into v_template;

  if v_template.id is null then
    raise exception 'template not found' using errcode = 'P0002';
  end if;
  return v_template;
end;
$$;

drop function public.create_job(
  text,
  text,
  text,
  public.job_priority,
  bigint,
  timestamptz,
  timestamptz,
  boolean,
  integer
);

create function public.create_job(
  p_title text,
  p_description text default '',
  p_location text default '',
  p_priority public.job_priority default 'normal',
  p_assignee_membership_id bigint default null,
  p_scheduled_at timestamptz default null,
  p_due_at timestamptz default null,
  p_requires_completion_note boolean default false,
  p_minimum_completion_photos integer default 0,
  p_template_id bigint default null
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
  select context.membership_id, context.organisation_id
  into v_actor
  from private.current_membership_context() as context
  where context.role = 'owner';

  if v_actor.membership_id is null then
    raise exception 'owner membership required' using errcode = '42501';
  end if;
  if btrim(coalesce(p_title, '')) = '' then
    raise exception 'job title is required' using errcode = '22023';
  end if;
  if p_minimum_completion_photos not between 0 and 10 then
    raise exception 'minimum completion photos must be between 0 and 10'
      using errcode = '22023';
  end if;
  if p_scheduled_at is not null
    and p_due_at is not null
    and p_due_at < p_scheduled_at then
    raise exception 'due time cannot precede scheduled time'
      using errcode = '22023';
  end if;
  if p_template_id is not null and not exists (
    select 1
    from public.job_templates as template
    where template.id = p_template_id
      and template.organisation_id = v_actor.organisation_id
      and template.is_active
  ) then
    raise exception 'template must be active in the organisation'
      using errcode = '22023';
  end if;
  if p_assignee_membership_id is not null and not exists (
    select 1
    from public.memberships as membership
    where membership.id = p_assignee_membership_id
      and membership.organisation_id = v_actor.organisation_id
      and membership.role = 'employee'
      and membership.status = 'active'
  ) then
    raise exception 'assignee must be an active employee in the organisation'
      using errcode = '22023';
  end if;

  insert into public.jobs (
    organisation_id,
    template_id,
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
    v_actor.organisation_id,
    p_template_id,
    p_assignee_membership_id,
    btrim(p_title),
    btrim(coalesce(p_description, '')),
    btrim(coalesce(p_location, '')),
    p_priority,
    'assigned',
    p_scheduled_at,
    p_due_at,
    p_requires_completion_note,
    p_minimum_completion_photos,
    v_actor.membership_id
  )
  returning * into v_job;

  insert into public.job_updates (
    organisation_id,
    job_id,
    author_membership_id,
    type,
    metadata
  )
  values (
    v_actor.organisation_id,
    v_job.id,
    v_actor.membership_id,
    'system',
    case when p_template_id is null
      then jsonb_build_object('event', 'created')
      else jsonb_build_object(
        'event', 'created_from_template',
        'template_id', p_template_id
      )
    end
  );

  if p_assignee_membership_id is not null then
    insert into public.job_updates (
      organisation_id,
      job_id,
      author_membership_id,
      type,
      metadata
    )
    values (
      v_actor.organisation_id,
      v_job.id,
      v_actor.membership_id,
      'assignment_change',
      jsonb_build_object(
        'previous_assignee_membership_id', null,
        'new_assignee_membership_id', p_assignee_membership_id
      )
    );
  end if;

  return v_job;
end;
$$;

revoke all on function public.create_job(
  text,
  text,
  text,
  public.job_priority,
  bigint,
  timestamptz,
  timestamptz,
  boolean,
  integer,
  bigint
) from public, anon, authenticated, service_role;
grant execute on function public.create_job(
  text,
  text,
  text,
  public.job_priority,
  bigint,
  timestamptz,
  timestamptz,
  boolean,
  integer,
  bigint
) to authenticated;

create function public.upsert_job_schedule(
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
  if not exists (
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

create function public.set_job_schedule_enabled(
  p_schedule_id bigint,
  p_is_enabled boolean
)
returns public.job_schedules
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor record;
  v_schedule public.job_schedules;
begin
  select context.membership_id, context.organisation_id
  into v_actor
  from private.current_membership_context() as context
  where context.role = 'owner';
  if v_actor.membership_id is null then
    raise exception 'owner membership required' using errcode = '42501';
  end if;

  select *
  into v_schedule
  from public.job_schedules
  where id = p_schedule_id
    and organisation_id = v_actor.organisation_id
    and deleted_at is null
  for update;
  if v_schedule.id is null then
    raise exception 'schedule not found' using errcode = 'P0002';
  end if;

  update public.job_schedules
  set
    is_enabled = p_is_enabled,
    next_occurrence_at = case when p_is_enabled then
      private.next_job_schedule_occurrence(
        v_schedule.recurrence_type,
        v_schedule.weekdays,
        v_schedule.local_time,
        v_schedule.starts_on,
        v_schedule.ends_on,
        v_schedule.timezone,
        clock_timestamp()
      )
    end
  where id = v_schedule.id
  returning * into v_schedule;

  if p_is_enabled and v_schedule.next_occurrence_at is null then
    raise exception 'schedule has no future occurrence' using errcode = '22023';
  end if;
  return v_schedule;
end;
$$;

create function public.delete_job_schedule(p_schedule_id bigint)
returns public.job_schedules
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor record;
  v_schedule public.job_schedules;
begin
  select context.membership_id, context.organisation_id
  into v_actor
  from private.current_membership_context() as context
  where context.role = 'owner';
  if v_actor.membership_id is null then
    raise exception 'owner membership required' using errcode = '42501';
  end if;

  update public.job_schedules
  set is_enabled = false, next_occurrence_at = null, deleted_at = clock_timestamp()
  where id = p_schedule_id
    and organisation_id = v_actor.organisation_id
    and deleted_at is null
  returning * into v_schedule;
  if v_schedule.id is null then
    raise exception 'schedule not found' using errcode = 'P0002';
  end if;
  return v_schedule;
end;
$$;

create function private.generate_due_job_schedules(
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
      if not exists (
        select 1
        from public.memberships as membership
        where membership.id = (v_occurrence.payload ->> 'assignee_membership_id')::bigint
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
        ), (
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

create function public.run_due_job_schedules(
  p_now timestamptz default clock_timestamp(),
  p_limit integer default 100
)
returns integer
language sql
security definer
set search_path = ''
as $$
  select private.generate_due_job_schedules(p_now, p_limit);
$$;

create function public.retry_job_schedule(p_schedule_id bigint)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor record;
  v_occurrence_at timestamptz;
begin
  select context.membership_id, context.organisation_id
  into v_actor
  from private.current_membership_context() as context
  where context.role = 'owner';
  if v_actor.membership_id is null then
    raise exception 'owner membership required' using errcode = '42501';
  end if;

  select occurrence.occurrence_at
  into v_occurrence_at
  from public.job_schedule_occurrences as occurrence
  join public.job_schedules as schedule
    on schedule.id = occurrence.schedule_id
    and schedule.organisation_id = occurrence.organisation_id
  where schedule.id = p_schedule_id
    and schedule.organisation_id = v_actor.organisation_id
    and schedule.is_enabled
    and schedule.deleted_at is null
    and occurrence.status = 'failed'
  order by occurrence.occurrence_at
  limit 1;

  if v_occurrence_at is null then
    raise exception 'schedule has no retryable occurrence'
      using errcode = 'P0002';
  end if;

  update public.job_schedules
  set next_occurrence_at = least(next_occurrence_at, v_occurrence_at)
  where id = p_schedule_id;
  return private.generate_due_job_schedules(clock_timestamp(), 100);
end;
$$;

revoke all on function public.upsert_job_template(
  bigint, text, text, text, public.job_priority, bigint, boolean, integer
) from public, anon, authenticated, service_role;
revoke all on function public.set_job_template_active(bigint, boolean)
  from public, anon, authenticated, service_role;
revoke all on function public.upsert_job_schedule(
  bigint, bigint, bigint, public.job_schedule_recurrence, smallint[],
  time, date, date, boolean
) from public, anon, authenticated, service_role;
revoke all on function public.set_job_schedule_enabled(bigint, boolean)
  from public, anon, authenticated, service_role;
revoke all on function public.delete_job_schedule(bigint)
  from public, anon, authenticated, service_role;
revoke all on function public.retry_job_schedule(bigint)
  from public, anon, authenticated, service_role;
revoke all on function public.run_due_job_schedules(timestamptz, integer)
  from public, anon, authenticated, service_role;
revoke all on function private.generate_due_job_schedules(timestamptz, integer)
  from public, anon, authenticated, service_role;

grant execute on function public.upsert_job_template(
  bigint, text, text, text, public.job_priority, bigint, boolean, integer
) to authenticated;
grant execute on function public.set_job_template_active(bigint, boolean)
  to authenticated;
grant execute on function public.upsert_job_schedule(
  bigint, bigint, bigint, public.job_schedule_recurrence, smallint[],
  time, date, date, boolean
) to authenticated;
grant execute on function public.set_job_schedule_enabled(bigint, boolean)
  to authenticated;
grant execute on function public.delete_job_schedule(bigint) to authenticated;
grant execute on function public.retry_job_schedule(bigint) to authenticated;
grant execute on function public.run_due_job_schedules(timestamptz, integer)
  to service_role;

create function public.create_job_template(
  p_title text,
  p_description text default '',
  p_location text default '',
  p_priority public.job_priority default 'normal',
  p_assignee_membership_id bigint default null,
  p_requires_completion_note boolean default false,
  p_minimum_completion_photos integer default 0
)
returns public.job_templates
language sql
security invoker
set search_path = ''
as $$
  select public.upsert_job_template(
    null,
    p_title,
    p_description,
    p_location,
    p_priority,
    p_assignee_membership_id,
    p_requires_completion_note,
    p_minimum_completion_photos
  );
$$;

revoke all on function public.create_job_template(
  text, text, text, public.job_priority, bigint, boolean, integer
) from public, anon, authenticated, service_role;
grant execute on function public.create_job_template(
  text, text, text, public.job_priority, bigint, boolean, integer
) to authenticated;

create function public.create_job_schedule(
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

revoke all on function public.create_job_schedule(
  bigint, bigint, public.job_schedule_recurrence, smallint[],
  time, date, date, boolean
) from public, anon, authenticated, service_role;
grant execute on function public.create_job_schedule(
  bigint, bigint, public.job_schedule_recurrence, smallint[],
  time, date, date, boolean
) to authenticated;

create function private.broadcast_job_template_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.broadcast_realtime_invalidation(
    coalesce(new.organisation_id, old.organisation_id),
    array[]::bigint[],
    'template',
    tg_op,
    coalesce(new.id, old.id)
  );
  return null;
end;
$$;

create function private.broadcast_job_schedule_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.broadcast_realtime_invalidation(
    coalesce(new.organisation_id, old.organisation_id),
    array[]::bigint[],
    'schedule',
    tg_op,
    coalesce(new.id, old.id)
  );
  return null;
end;
$$;

create trigger job_templates_broadcast_realtime
after insert or update or delete on public.job_templates
for each row execute function private.broadcast_job_template_change();

create trigger job_schedules_broadcast_realtime
after insert or update or delete on public.job_schedules
for each row execute function private.broadcast_job_schedule_change();

revoke all on function private.broadcast_job_template_change()
  from public, anon, authenticated, service_role;
revoke all on function private.broadcast_job_schedule_change()
  from public, anon, authenticated, service_role;

create extension if not exists pg_cron;

select cron.schedule(
  'pph-generate-job-schedules',
  '* * * * *',
  $cron$select private.generate_due_job_schedules(clock_timestamp(), 100);$cron$
);
