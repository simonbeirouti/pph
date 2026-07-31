-- Restore protected deletion for operational jobs that have not reached review.
-- Scheduled and submitted jobs remain retained history.
create or replace function public.delete_job(p_job_id bigint)
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor record;
  v_job public.jobs;
  v_storage_paths text[];
begin
  select context.membership_id, context.organisation_id
  into v_actor
  from private.current_membership_actual() as context
  where private.is_operations_role(context.role);

  if v_actor.membership_id is null then
    raise exception 'operations membership required' using errcode = '42501';
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
  if v_job.status not in ('assigned', 'in_progress') or v_job.schedule_id is not null then
    raise exception 'only unsubmitted, unscheduled jobs can be deleted'
      using errcode = '55000';
  end if;

  select coalesce(array_agg(asset.storage_path), '{}'::text[])
  into v_storage_paths
  from public.job_assets as asset
  where asset.job_id = v_job.id
    and asset.organisation_id = v_actor.organisation_id;

  delete from public.job_assets
  where job_id = v_job.id and organisation_id = v_actor.organisation_id;
  delete from public.job_operation_receipts
  where job_id = v_job.id and organisation_id = v_actor.organisation_id;
  perform set_config('app.allow_job_deletion', 'true', true);
  delete from public.job_updates
  where job_id = v_job.id and organisation_id = v_actor.organisation_id;
  delete from public.jobs
  where id = v_job.id and organisation_id = v_actor.organisation_id;

  return v_storage_paths;
end;
$$;

revoke all on function public.delete_job(bigint)
  from public, anon, authenticated, service_role;
grant execute on function public.delete_job(bigint) to authenticated;

create or replace function private.prevent_job_update_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE'
    and current_setting('app.allow_job_deletion', true) = 'true' then
    return old;
  end if;
  raise exception 'job updates are append-only' using errcode = '55000';
end;
$$;
