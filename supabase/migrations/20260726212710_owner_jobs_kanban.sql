create type public.job_priority as enum ('low', 'normal', 'high', 'urgent');
create type public.job_status as enum (
  'assigned',
  'in_progress',
  'in_review',
  'archived'
);
create type public.job_update_type as enum (
  'note',
  'comment',
  'status_change',
  'assignment_change',
  'system'
);

create extension if not exists btree_gist with schema extensions;

create table public.roster_shifts (
  id bigint generated always as identity primary key,
  organisation_id bigint not null references public.organisations(id) on delete restrict,
  employee_membership_id bigint not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  notes text not null default '',
  created_by bigint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint roster_shifts_employee_organisation_fkey
    foreign key (employee_membership_id, organisation_id)
    references public.memberships(id, organisation_id)
    on delete restrict,
  constraint roster_shifts_creator_organisation_fkey
    foreign key (created_by, organisation_id)
    references public.memberships(id, organisation_id)
    on delete restrict,
  constraint roster_shifts_valid_range check (starts_at < ends_at),
  constraint roster_shifts_no_active_overlap
    exclude using gist (
      employee_membership_id with =,
      tstzrange(starts_at, ends_at, '[)') with &&
    )
    where (archived_at is null)
);

create index roster_shifts_organisation_starts_idx
  on public.roster_shifts (organisation_id, starts_at)
  where archived_at is null;
create index roster_shifts_employee_starts_idx
  on public.roster_shifts (employee_membership_id, starts_at)
  where archived_at is null;
create index roster_shifts_created_by_idx
  on public.roster_shifts (created_by);

create table public.jobs (
  id bigint generated always as identity primary key,
  organisation_id bigint not null references public.organisations(id) on delete restrict,
  template_id bigint,
  schedule_id bigint,
  schedule_occurrence_at timestamptz,
  assignee_membership_id bigint,
  title text not null constraint jobs_title_not_blank check (btrim(title) <> ''),
  description text not null default '',
  location text not null default '',
  priority public.job_priority not null default 'normal',
  status public.job_status not null default 'assigned',
  scheduled_at timestamptz,
  due_at timestamptz,
  requires_completion_note boolean not null default false,
  minimum_completion_photos integer not null default 0
    constraint jobs_minimum_completion_photos_range
    check (minimum_completion_photos between 0 and 10),
  started_at timestamptz,
  submitted_at timestamptz,
  archived_at timestamptz,
  created_by bigint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint jobs_id_organisation_unique unique (id, organisation_id),
  constraint jobs_assignee_organisation_fkey
    foreign key (assignee_membership_id, organisation_id)
    references public.memberships(id, organisation_id)
    on delete restrict,
  constraint jobs_creator_organisation_fkey
    foreign key (created_by, organisation_id)
    references public.memberships(id, organisation_id)
    on delete restrict,
  constraint jobs_schedule_occurrence_pair check (
    (schedule_id is null and schedule_occurrence_at is null)
    or (schedule_id is not null and schedule_occurrence_at is not null)
  ),
  constraint jobs_due_after_scheduled check (
    scheduled_at is null
    or due_at is null
    or due_at >= scheduled_at
  ),
  constraint jobs_lifecycle_timestamps check (
    (status <> 'in_progress' or started_at is not null)
    and (status <> 'in_review' or submitted_at is not null)
    and (status <> 'archived' or archived_at is not null)
  )
);

create index jobs_organisation_status_updated_idx
  on public.jobs (organisation_id, status, updated_at desc);
create index jobs_organisation_assignee_status_idx
  on public.jobs (organisation_id, assignee_membership_id, status);
create index jobs_assignee_membership_id_idx
  on public.jobs (assignee_membership_id);
create index jobs_created_by_idx
  on public.jobs (created_by);
create index jobs_organisation_due_active_idx
  on public.jobs (organisation_id, due_at)
  where status in ('assigned', 'in_progress', 'in_review');
create index jobs_organisation_urgent_idx
  on public.jobs (organisation_id, updated_at desc)
  where priority = 'urgent' and status <> 'archived';
create index jobs_template_id_idx
  on public.jobs (template_id)
  where template_id is not null;
create index jobs_schedule_id_idx
  on public.jobs (schedule_id)
  where schedule_id is not null;
create unique index jobs_schedule_occurrence_unique
  on public.jobs (schedule_id, schedule_occurrence_at)
  where schedule_id is not null and schedule_occurrence_at is not null;

create table public.job_updates (
  id bigint generated always as identity primary key,
  organisation_id bigint not null references public.organisations(id) on delete restrict,
  job_id bigint not null,
  author_membership_id bigint,
  type public.job_update_type not null,
  body text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint job_updates_job_organisation_fkey
    foreign key (job_id, organisation_id)
    references public.jobs(id, organisation_id)
    on delete restrict,
  constraint job_updates_author_organisation_fkey
    foreign key (author_membership_id, organisation_id)
    references public.memberships(id, organisation_id)
    on delete restrict,
  constraint job_updates_body_not_blank check (
    body is null or btrim(body) <> ''
  )
);

create index job_updates_job_created_idx
  on public.job_updates (job_id, created_at);
create index job_updates_organisation_id_idx
  on public.job_updates (organisation_id);
create index job_updates_author_membership_id_idx
  on public.job_updates (author_membership_id)
  where author_membership_id is not null;

create trigger roster_shifts_set_updated_at
before update on public.roster_shifts
for each row execute function private.set_updated_at();

create trigger jobs_set_updated_at
before update on public.jobs
for each row execute function private.set_updated_at();

create function private.prevent_job_update_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'job updates are append-only' using errcode = '55000';
end;
$$;

create trigger job_updates_prevent_update
before update or delete on public.job_updates
for each row execute function private.prevent_job_update_mutation();

revoke all on function private.prevent_job_update_mutation()
  from public, anon, authenticated, service_role;

alter table public.roster_shifts enable row level security;
alter table public.jobs enable row level security;
alter table public.job_updates enable row level security;

create policy roster_shifts_select_active_membership
on public.roster_shifts
for select
to authenticated
using (
  organisation_id = (
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

create policy jobs_select_active_membership
on public.jobs
for select
to authenticated
using (
  organisation_id = (
    select context.organisation_id
    from private.current_membership_context() as context
  )
  and (
    (
      select context.role
      from private.current_membership_context() as context
    ) = 'owner'
    or assignee_membership_id = (
      select context.membership_id
      from private.current_membership_context() as context
    )
  )
);

create policy job_updates_select_active_membership
on public.job_updates
for select
to authenticated
using (
  organisation_id = (
    select context.organisation_id
    from private.current_membership_context() as context
  )
  and (
    (
      select context.role
      from private.current_membership_context() as context
    ) = 'owner'
    or exists (
      select 1
      from public.jobs as job
      where job.id = job_updates.job_id
        and job.organisation_id = job_updates.organisation_id
        and job.assignee_membership_id = (
          select context.membership_id
          from private.current_membership_context() as context
        )
    )
  )
);

revoke all on public.roster_shifts, public.jobs, public.job_updates
  from anon, authenticated;
grant select on public.roster_shifts, public.jobs, public.job_updates
  to authenticated;
grant all on public.roster_shifts, public.jobs, public.job_updates
  to service_role;

create function public.create_job(
  p_title text,
  p_description text default '',
  p_location text default '',
  p_priority public.job_priority default 'normal',
  p_assignee_membership_id bigint default null,
  p_scheduled_at timestamptz default null,
  p_due_at timestamptz default null,
  p_requires_completion_note boolean default false,
  p_minimum_completion_photos integer default 0
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
    jsonb_build_object('event', 'created')
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

create function public.reassign_job(
  p_job_id bigint,
  p_assignee_membership_id bigint default null
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
  select context.membership_id, context.organisation_id
  into v_actor
  from private.current_membership_context() as context
  where context.role = 'owner';

  if v_actor.membership_id is null then
    raise exception 'owner membership required' using errcode = '42501';
  end if;

  select *
  into v_job
  from public.jobs as job
  where job.id = p_job_id
    and job.organisation_id = v_actor.organisation_id
  for update;

  if v_job.id is null then
    raise exception 'job is unavailable' using errcode = 'P0002';
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
  if v_job.assignee_membership_id is not distinct from p_assignee_membership_id then
    return v_job;
  end if;

  v_previous_assignee := v_job.assignee_membership_id;
  v_previous_status := v_job.status;

  update public.jobs
  set
    assignee_membership_id = p_assignee_membership_id,
    status = 'assigned',
    started_at = null,
    submitted_at = null,
    archived_at = null
  where id = v_job.id
    and organisation_id = v_actor.organisation_id
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
    'assignment_change',
    jsonb_build_object(
      'previous_assignee_membership_id', v_previous_assignee,
      'new_assignee_membership_id', p_assignee_membership_id
    )
  );

  if v_previous_status <> 'assigned' then
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
      'status_change',
      jsonb_build_object(
        'previous_status', v_previous_status,
        'new_status', 'assigned'
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
  integer
) from public, anon, authenticated, service_role;
revoke all on function public.reassign_job(bigint, bigint)
  from public, anon, authenticated, service_role;
grant execute on function public.create_job(
  text,
  text,
  text,
  public.job_priority,
  bigint,
  timestamptz,
  timestamptz,
  boolean,
  integer
) to authenticated;
grant execute on function public.reassign_job(bigint, bigint)
  to authenticated;

create function public.update_job(
  p_job_id bigint,
  p_title text,
  p_description text default '',
  p_location text default '',
  p_priority public.job_priority default 'normal',
  p_assignee_membership_id bigint default null,
  p_scheduled_at timestamptz default null,
  p_due_at timestamptz default null,
  p_requires_completion_note boolean default false,
  p_minimum_completion_photos integer default 0
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
  select context.membership_id, context.organisation_id
  into v_actor
  from private.current_membership_context() as context
  where context.role = 'owner';

  if v_actor.membership_id is null then
    raise exception 'owner membership required' using errcode = '42501';
  end if;

  select *
  into v_job
  from public.jobs as job
  where job.id = p_job_id
    and job.organisation_id = v_actor.organisation_id
  for update;

  if v_job.id is null then
    raise exception 'job is unavailable' using errcode = 'P0002';
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

  v_previous_assignee := v_job.assignee_membership_id;
  v_previous_status := v_job.status;

  update public.jobs
  set
    title = btrim(p_title),
    description = btrim(coalesce(p_description, '')),
    location = btrim(coalesce(p_location, '')),
    priority = p_priority,
    assignee_membership_id = p_assignee_membership_id,
    scheduled_at = p_scheduled_at,
    due_at = p_due_at,
    requires_completion_note = p_requires_completion_note,
    minimum_completion_photos = p_minimum_completion_photos,
    status = case
      when assignee_membership_id is distinct from p_assignee_membership_id
        then 'assigned'::public.job_status
      else status
    end,
    started_at = case
      when assignee_membership_id is distinct from p_assignee_membership_id
        then null
      else started_at
    end,
    submitted_at = case
      when assignee_membership_id is distinct from p_assignee_membership_id
        then null
      else submitted_at
    end,
    archived_at = case
      when assignee_membership_id is distinct from p_assignee_membership_id
        then null
      else archived_at
    end
  where id = v_job.id
    and organisation_id = v_actor.organisation_id
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
    jsonb_build_object('event', 'edited')
  );

  if v_previous_assignee is distinct from p_assignee_membership_id then
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
        'previous_assignee_membership_id', v_previous_assignee,
        'new_assignee_membership_id', p_assignee_membership_id
      )
    );

    if v_previous_status <> 'assigned' then
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
        'status_change',
        jsonb_build_object(
          'previous_status', v_previous_status,
          'new_status', 'assigned'
        )
      );
    end if;
  end if;

  return v_job;
end;
$$;

revoke all on function public.update_job(
  bigint,
  text,
  text,
  text,
  public.job_priority,
  bigint,
  timestamptz,
  timestamptz,
  boolean,
  integer
) from public, anon, authenticated, service_role;
grant execute on function public.update_job(
  bigint,
  text,
  text,
  text,
  public.job_priority,
  bigint,
  timestamptz,
  timestamptz,
  boolean,
  integer
) to authenticated;
