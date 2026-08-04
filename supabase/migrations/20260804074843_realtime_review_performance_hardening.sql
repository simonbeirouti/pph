-- Keep realtime job invalidations targetable without exposing row content, and
-- keep the offline working-set queries bounded as archived history grows.

create index jobs_organisation_active_updated_idx
  on public.jobs (organisation_id, updated_at desc)
  where status <> 'archived';

create function public.list_employee_job_summary_rows()
returns setof public.jobs
language sql
stable
security invoker
set search_path = ''
as $$
  select job.*
  from public.jobs as job
  where job.status <> 'archived'
    or job.id in (
      select ranked.id
      from (
        select
          archived.id,
          row_number() over (
            partition by archived.assignee_membership_id
            order by archived.updated_at desc, archived.id desc
          ) as archive_rank
        from public.jobs as archived
        where archived.status = 'archived'
          and archived.assignee_membership_id is not null
      ) as ranked
      where ranked.archive_rank <= 5
    )
  order by job.updated_at desc, job.id desc;
$$;

revoke all on function public.list_employee_job_summary_rows()
  from public, anon;
grant execute on function public.list_employee_job_summary_rows()
  to authenticated;

create or replace function private.broadcast_job_update_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_assignee_membership_id bigint;
  v_job_id bigint := coalesce(new.job_id, old.job_id);
begin
  select job.assignee_membership_id
  into v_assignee_membership_id
  from public.jobs as job
  where job.id = v_job_id
    and job.organisation_id =
      coalesce(new.organisation_id, old.organisation_id);

  perform private.broadcast_realtime_invalidation(
    coalesce(new.organisation_id, old.organisation_id),
    array[v_assignee_membership_id],
    'job_update',
    tg_op,
    v_job_id
  );
  return null;
end;
$$;

create or replace function private.broadcast_job_asset_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_assignee_membership_id bigint;
  v_job_id bigint := coalesce(new.job_id, old.job_id);
begin
  select job.assignee_membership_id
  into v_assignee_membership_id
  from public.jobs as job
  where job.id = v_job_id
    and job.organisation_id =
      coalesce(new.organisation_id, old.organisation_id);

  perform private.broadcast_realtime_invalidation(
    coalesce(new.organisation_id, old.organisation_id),
    array[v_assignee_membership_id],
    'evidence',
    tg_op,
    v_job_id
  );
  return null;
end;
$$;

create or replace function private.broadcast_job_notification_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.broadcast_realtime_invalidation(
    coalesce(new.organisation_id, old.organisation_id),
    array[]::bigint[],
    'review',
    tg_op,
    coalesce(new.job_id, old.job_id)
  );
  return null;
end;
$$;

revoke all on function private.broadcast_job_update_change()
  from public, anon, authenticated, service_role;
revoke all on function private.broadcast_job_asset_change()
  from public, anon, authenticated, service_role;
revoke all on function private.broadcast_job_notification_change()
  from public, anon, authenticated, service_role;
