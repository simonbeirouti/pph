create policy operations_realtime_receive
on realtime.messages
for select
to authenticated
using (
  exists (
    select 1
    from private.current_membership_context() as context
    where (
      context.role = 'owner'
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

create function private.send_realtime_invalidation(
  p_topic text,
  p_domain text,
  p_action text,
  p_entity_id bigint
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_topic is null
    or p_domain not in (
      'membership',
      'employee_profile',
      'job',
      'job_update',
      'roster',
      'evidence',
      'review',
      'template',
      'schedule',
      'dashboard'
    )
    or lower(p_action) not in ('insert', 'update', 'delete')
    or p_entity_id is null
  then
    raise exception 'invalid realtime invalidation'
      using errcode = '22023';
  end if;

  perform realtime.send(
    jsonb_build_object(
      'version', 1,
      'eventId', gen_random_uuid()::text,
      'domain', p_domain,
      'action', lower(p_action),
      'entityId', p_entity_id,
      'occurredAt', clock_timestamp()
    ),
    'invalidate',
    p_topic,
    true
  );
end;
$$;

create function private.broadcast_realtime_invalidation(
  p_organisation_id bigint,
  p_member_ids bigint[],
  p_domain text,
  p_action text,
  p_entity_id bigint
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member_id bigint;
begin
  if p_organisation_id is null then
    raise exception 'organisation is required for realtime invalidation'
      using errcode = '22023';
  end if;

  perform private.send_realtime_invalidation(
    'org:' || p_organisation_id::text || ':operations',
    p_domain,
    p_action,
    p_entity_id
  );

  for v_member_id in
    select distinct member_id
    from unnest(coalesce(p_member_ids, array[]::bigint[])) as member_id
    where member_id is not null
  loop
    perform private.send_realtime_invalidation(
      'member:' || v_member_id::text || ':work',
      p_domain,
      p_action,
      p_entity_id
    );
  end loop;
end;
$$;

create function private.broadcast_membership_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.broadcast_realtime_invalidation(
    coalesce(new.organisation_id, old.organisation_id),
    array[coalesce(new.id, old.id)],
    'membership',
    tg_op,
    coalesce(new.id, old.id)
  );
  return null;
end;
$$;

create function private.broadcast_employee_profile_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.broadcast_realtime_invalidation(
    coalesce(new.organisation_id, old.organisation_id),
    array[
      old.membership_id,
      new.membership_id
    ],
    'employee_profile',
    tg_op,
    coalesce(new.id, old.id)
  );
  return null;
end;
$$;

create function private.broadcast_job_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.broadcast_realtime_invalidation(
    coalesce(new.organisation_id, old.organisation_id),
    array[
      old.assignee_membership_id,
      new.assignee_membership_id
    ],
    'job',
    tg_op,
    coalesce(new.id, old.id)
  );
  return null;
end;
$$;

create function private.broadcast_job_update_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_assignee_membership_id bigint;
begin
  select job.assignee_membership_id
  into v_assignee_membership_id
  from public.jobs as job
  where job.id = coalesce(new.job_id, old.job_id)
    and job.organisation_id =
      coalesce(new.organisation_id, old.organisation_id);

  perform private.broadcast_realtime_invalidation(
    coalesce(new.organisation_id, old.organisation_id),
    array[v_assignee_membership_id],
    'job_update',
    tg_op,
    coalesce(new.id, old.id)
  );
  return null;
end;
$$;

create function private.broadcast_roster_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.broadcast_realtime_invalidation(
    coalesce(new.organisation_id, old.organisation_id),
    array[
      old.employee_membership_id,
      new.employee_membership_id
    ],
    'roster',
    tg_op,
    coalesce(new.id, old.id)
  );
  return null;
end;
$$;

create trigger memberships_broadcast_realtime
after insert or update or delete on public.memberships
for each row execute function private.broadcast_membership_change();

create trigger employee_profiles_broadcast_realtime
after insert or update or delete on public.employee_profiles
for each row execute function private.broadcast_employee_profile_change();

create trigger jobs_broadcast_realtime
after insert or update or delete on public.jobs
for each row execute function private.broadcast_job_change();

create trigger job_updates_broadcast_realtime
after insert or update or delete on public.job_updates
for each row execute function private.broadcast_job_update_change();

create trigger roster_shifts_broadcast_realtime
after insert or update or delete on public.roster_shifts
for each row execute function private.broadcast_roster_change();

revoke all on function private.send_realtime_invalidation(
  text,
  text,
  text,
  bigint
) from public, anon, authenticated, service_role;
revoke all on function private.broadcast_realtime_invalidation(
  bigint,
  bigint[],
  text,
  text,
  bigint
) from public, anon, authenticated, service_role;
revoke all on function private.broadcast_membership_change()
  from public, anon, authenticated, service_role;
revoke all on function private.broadcast_employee_profile_change()
  from public, anon, authenticated, service_role;
revoke all on function private.broadcast_job_change()
  from public, anon, authenticated, service_role;
revoke all on function private.broadcast_job_update_change()
  from public, anon, authenticated, service_role;
revoke all on function private.broadcast_roster_change()
  from public, anon, authenticated, service_role;
