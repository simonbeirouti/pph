-- Target job-detail patches at the parent job rather than rebuilding every
-- detail record after a child update or asset change.

alter table public.organisation_sync_changes
  add column related_job_id bigint;

create or replace function private.record_organisation_sync_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entity jsonb := case
    when tg_op = 'DELETE' then to_jsonb(old)
    else to_jsonb(new)
  end;
  v_job_id bigint;
  v_operations_only boolean := false;
  v_related_job_id bigint;
  v_scope_membership_id bigint;
begin
  if tg_table_name = 'organisations' then
    v_entity := v_entity || jsonb_build_object(
      'organisation_id',
      v_entity->>'id'
    );
  elsif tg_table_name = 'memberships' and tg_op = 'DELETE' then
    v_operations_only := true;
  elsif tg_table_name = 'memberships' then
    v_scope_membership_id := (v_entity->>'id')::bigint;
  elsif tg_table_name = 'employee_profiles' then
    v_scope_membership_id := (v_entity->>'membership_id')::bigint;
  elsif tg_table_name = 'roster_shifts' then
    v_scope_membership_id := (v_entity->>'employee_membership_id')::bigint;
  elsif tg_table_name = 'jobs' then
    v_related_job_id := (v_entity->>'id')::bigint;
    v_scope_membership_id := nullif(
      v_entity->>'assignee_membership_id',
      ''
    )::bigint;
  elsif tg_table_name in ('job_updates', 'job_assets') then
    v_job_id := (v_entity->>'job_id')::bigint;
    v_related_job_id := v_job_id;
    select job.assignee_membership_id
    into v_scope_membership_id
    from public.jobs as job
    where job.id = v_job_id
      and job.organisation_id = (v_entity->>'organisation_id')::bigint;
  elsif tg_table_name = 'job_notification_deliveries' then
    v_operations_only := true;
    v_related_job_id := (v_entity->>'job_id')::bigint;
  elsif tg_table_name in (
    'job_templates',
    'job_schedules',
    'job_schedule_occurrences',
    'membership_role_audit'
  ) then
    v_operations_only := true;
  end if;

  insert into public.organisation_sync_changes (
    organisation_id,
    entity_type,
    entity_id,
    operation,
    related_job_id,
    scope_membership_id,
    operations_only
  )
  values (
    (v_entity->>'organisation_id')::bigint,
    tg_table_name,
    (v_entity->>'id')::bigint,
    case when tg_op = 'DELETE' then 'delete' else 'upsert' end,
    v_related_job_id,
    v_scope_membership_id,
    v_operations_only
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop function public.get_offline_sync_changes(bigint);

create function public.get_offline_sync_changes(p_after_revision bigint)
returns table (
  revision bigint,
  entity_type text,
  entity_id bigint,
  operation text,
  related_job_id bigint,
  changed_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor record;
begin
  select *
  into v_actor
  from private.current_membership_actual() as context;
  if v_actor.membership_id is null then
    raise exception 'active membership required' using errcode = '42501';
  end if;

  return query
  select
    change.revision,
    change.entity_type,
    change.entity_id,
    change.operation,
    change.related_job_id,
    change.changed_at
  from public.organisation_sync_changes as change
  where change.organisation_id = v_actor.organisation_id
    and change.revision > greatest(coalesce(p_after_revision, 0), 0)
    and (
      private.is_operations_role(v_actor.role)
      or (
        not change.operations_only
        and (
          change.scope_membership_id is null
          or change.scope_membership_id = v_actor.membership_id
        )
      )
    )
  order by change.revision
  limit 5000;
end;
$$;

revoke all on function public.get_offline_sync_changes(bigint)
  from public, anon;
grant execute on function public.get_offline_sync_changes(bigint)
  to authenticated;
