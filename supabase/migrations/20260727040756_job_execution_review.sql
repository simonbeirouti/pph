create type public.job_notification_status as enum (
  'queued',
  'sending',
  'sent',
  'failed'
);

alter table public.jobs
add column submission_version integer not null default 0
  constraint jobs_submission_version_non_negative check (submission_version >= 0);

create table public.job_assets (
  id bigint generated always as identity primary key,
  organisation_id bigint not null references public.organisations(id) on delete restrict,
  job_id bigint not null,
  uploaded_by_membership_id bigint not null,
  kind text not null default 'completion_photo'
    constraint job_assets_kind_completion_photo check (kind = 'completion_photo'),
  storage_path text not null,
  mime_type text not null
    constraint job_assets_supported_mime check (
      mime_type in (
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/heic',
        'image/heif'
      )
    ),
  size_bytes bigint not null
    constraint job_assets_size_range check (
      size_bytes > 0 and size_bytes <= 10485760
    ),
  submission_version integer not null
    constraint job_assets_submission_version_non_negative
    check (submission_version >= 0),
  created_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint job_assets_id_organisation_unique unique (id, organisation_id),
  constraint job_assets_job_organisation_fkey
    foreign key (job_id, organisation_id)
    references public.jobs(id, organisation_id)
    on delete restrict,
  constraint job_assets_uploader_organisation_fkey
    foreign key (uploaded_by_membership_id, organisation_id)
    references public.memberships(id, organisation_id)
    on delete restrict,
  constraint job_assets_storage_path_unique unique (storage_path)
);

create index job_assets_job_created_idx
  on public.job_assets (job_id, created_at);
create index job_assets_job_active_idx
  on public.job_assets (job_id, submission_version, created_at)
  where archived_at is null;
create index job_assets_organisation_id_idx
  on public.job_assets (organisation_id);
create index job_assets_uploaded_by_idx
  on public.job_assets (uploaded_by_membership_id);

create table public.job_notification_deliveries (
  id bigint generated always as identity primary key,
  organisation_id bigint not null references public.organisations(id) on delete restrict,
  job_id bigint not null,
  submission_update_id bigint not null,
  recipient_membership_id bigint,
  recipient_email text,
  status public.job_notification_status not null default 'queued',
  review_url text,
  subject text,
  text_body text,
  html_body text,
  provider_message_id text,
  attempt_count integer not null default 0
    constraint job_notification_attempt_count_non_negative
    check (attempt_count >= 0),
  last_attempted_at timestamptz,
  sent_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint job_notification_job_organisation_fkey
    foreign key (job_id, organisation_id)
    references public.jobs(id, organisation_id)
    on delete restrict,
  constraint job_notification_submission_update_fkey
    foreign key (submission_update_id)
    references public.job_updates(id)
    on delete restrict,
  constraint job_notification_recipient_organisation_fkey
    foreign key (recipient_membership_id, organisation_id)
    references public.memberships(id, organisation_id)
    on delete restrict,
  constraint job_notification_submission_unique unique (submission_update_id)
);

create index job_notification_job_created_idx
  on public.job_notification_deliveries (job_id, created_at desc);
create index job_notification_organisation_status_idx
  on public.job_notification_deliveries (organisation_id, status, created_at)
  where status in ('queued', 'sending', 'failed');
create index job_notification_recipient_idx
  on public.job_notification_deliveries (recipient_membership_id)
  where recipient_membership_id is not null;

create trigger job_notification_deliveries_set_updated_at
before update on public.job_notification_deliveries
for each row execute function private.set_updated_at();

alter table public.job_assets enable row level security;
alter table public.job_notification_deliveries enable row level security;

create policy job_assets_select_active_membership
on public.job_assets
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
      where job.id = job_assets.job_id
        and job.organisation_id = job_assets.organisation_id
        and job.assignee_membership_id = (
          select context.membership_id
          from private.current_membership_context() as context
        )
    )
  )
);

create policy job_notification_deliveries_select_owner
on public.job_notification_deliveries
for select
to authenticated
using (
  organisation_id = (
    select context.organisation_id
    from private.current_membership_context() as context
  )
  and (
    select context.role
    from private.current_membership_context() as context
  ) = 'owner'
);

revoke all on public.job_assets, public.job_notification_deliveries
  from anon, authenticated;
grant select on public.job_assets, public.job_notification_deliveries
  to authenticated;
grant all on public.job_assets, public.job_notification_deliveries
  to service_role;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'job-evidence',
  'job-evidence',
  false,
  10485760,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create function private.can_read_job_evidence(object_name text)
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
    from private.current_membership_context() as context
    join public.jobs as job
      on job.id = v_job_id
      and job.organisation_id = context.organisation_id
    where v_organisation_id = context.organisation_id
      and (
        context.role = 'owner'
        or job.assignee_membership_id = context.membership_id
      )
  );
end;
$$;

create function private.can_upload_job_evidence(object_name text)
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
    from private.current_membership_context() as context
    join public.jobs as job
      on job.id = v_job_id
      and job.organisation_id = context.organisation_id
    where context.role = 'employee'
      and context.membership_id = v_uploader_id
      and v_organisation_id = context.organisation_id
      and job.assignee_membership_id = context.membership_id
      and job.status in ('assigned', 'in_progress')
      and (
        select count(*)
        from public.job_assets as asset
        where asset.job_id = job.id
          and asset.archived_at is null
      ) < 10
  );
end;
$$;

revoke all on function private.can_read_job_evidence(text)
  from public, anon, authenticated, service_role;
revoke all on function private.can_upload_job_evidence(text)
  from public, anon, authenticated, service_role;
grant execute on function private.can_read_job_evidence(text) to authenticated;
grant execute on function private.can_upload_job_evidence(text) to authenticated;

create policy job_evidence_select_active_member
on storage.objects
for select
to authenticated
using (
  bucket_id = 'job-evidence'
  and (select private.can_read_job_evidence(name))
);

create policy job_evidence_insert_current_assignee
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'job-evidence'
  and (select private.can_upload_job_evidence(name))
);

create function private.enforce_review_reopen_feedback()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status in ('in_review', 'archived')
    and new.status = 'assigned'
    and coalesce(
      current_setting('pph.allow_job_reopen_with_feedback', true),
      ''
    ) <> 'on' then
    raise exception 'owner feedback is required to reopen this job'
      using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger jobs_enforce_review_reopen_feedback
before update on public.jobs
for each row execute function private.enforce_review_reopen_feedback();

revoke all on function private.enforce_review_reopen_feedback()
  from public, anon, authenticated, service_role;

create function public.start_job(p_job_id bigint)
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
  where context.role = 'employee';

  if v_actor.membership_id is null then
    raise exception 'employee membership required' using errcode = '42501';
  end if;

  select *
  into v_job
  from public.jobs as job
  where job.id = p_job_id
    and job.organisation_id = v_actor.organisation_id
  for update;

  if v_job.id is null
    or v_job.assignee_membership_id <> v_actor.membership_id then
    raise exception 'job is unavailable' using errcode = 'P0002';
  end if;
  if v_job.status = 'in_progress' then
    return v_job;
  end if;
  if v_job.status <> 'assigned' then
    raise exception 'job cannot be started' using errcode = '22023';
  end if;

  update public.jobs
  set status = 'in_progress', started_at = coalesce(started_at, now())
  where id = v_job.id
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
    'status_change',
    jsonb_build_object(
      'previous_status', 'assigned',
      'new_status', 'in_progress'
    )
  );

  return v_job;
end;
$$;

create function public.add_job_note(p_job_id bigint, p_body text)
returns public.job_updates
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor record;
  v_job public.jobs;
  v_update public.job_updates;
begin
  select context.membership_id, context.organisation_id
  into v_actor
  from private.current_membership_context() as context
  where context.role = 'employee';

  if v_actor.membership_id is null then
    raise exception 'employee membership required' using errcode = '42501';
  end if;
  if btrim(coalesce(p_body, '')) = '' then
    raise exception 'note is required' using errcode = '22023';
  end if;

  select *
  into v_job
  from public.jobs as job
  where job.id = p_job_id
    and job.organisation_id = v_actor.organisation_id;

  if v_job.id is null
    or v_job.assignee_membership_id <> v_actor.membership_id then
    raise exception 'job is unavailable' using errcode = 'P0002';
  end if;
  if v_job.status not in ('assigned', 'in_progress') then
    raise exception 'job notes are read-only' using errcode = '22023';
  end if;

  insert into public.job_updates (
    organisation_id,
    job_id,
    author_membership_id,
    type,
    body
  )
  values (
    v_actor.organisation_id,
    v_job.id,
    v_actor.membership_id,
    'note',
    btrim(p_body)
  )
  returning * into v_update;

  return v_update;
end;
$$;

create function public.add_job_comment(p_job_id bigint, p_body text)
returns public.job_updates
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor record;
  v_job public.jobs;
  v_update public.job_updates;
begin
  select context.membership_id, context.organisation_id, context.role
  into v_actor
  from private.current_membership_context() as context;

  if v_actor.membership_id is null then
    raise exception 'active membership required' using errcode = '42501';
  end if;
  if btrim(coalesce(p_body, '')) = '' then
    raise exception 'comment is required' using errcode = '22023';
  end if;

  select *
  into v_job
  from public.jobs as job
  where job.id = p_job_id
    and job.organisation_id = v_actor.organisation_id;

  if v_job.id is null
    or (
      v_actor.role <> 'owner'
      and v_job.assignee_membership_id <> v_actor.membership_id
    ) then
    raise exception 'job is unavailable' using errcode = 'P0002';
  end if;

  insert into public.job_updates (
    organisation_id,
    job_id,
    author_membership_id,
    type,
    body
  )
  values (
    v_actor.organisation_id,
    v_job.id,
    v_actor.membership_id,
    'comment',
    btrim(p_body)
  )
  returning * into v_update;

  return v_update;
end;
$$;

create function public.finalize_job_evidence(
  p_job_id bigint,
  p_storage_path text,
  p_mime_type text,
  p_size_bytes bigint
)
returns public.job_assets
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor record;
  v_asset public.job_assets;
  v_job public.jobs;
begin
  select context.membership_id, context.organisation_id
  into v_actor
  from private.current_membership_context() as context
  where context.role = 'employee';

  if v_actor.membership_id is null then
    raise exception 'employee membership required' using errcode = '42501';
  end if;

  select *
  into v_job
  from public.jobs as job
  where job.id = p_job_id
    and job.organisation_id = v_actor.organisation_id
  for update;

  if v_job.id is null
    or v_job.assignee_membership_id <> v_actor.membership_id then
    raise exception 'job is unavailable' using errcode = 'P0002';
  end if;
  if v_job.status not in ('assigned', 'in_progress') then
    raise exception 'job evidence is read-only' using errcode = '22023';
  end if;
  if p_storage_path !~ (
    '^' || v_actor.organisation_id::text || '/' || v_job.id::text || '/'
    || v_actor.membership_id::text
    || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp|heic|heif)$'
  ) then
    raise exception 'invalid evidence path' using errcode = '22023';
  end if;
  if p_mime_type not in (
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif'
  )
    or p_size_bytes <= 0
    or p_size_bytes > 10485760 then
    raise exception 'invalid evidence file' using errcode = '22023';
  end if;

  select *
  into v_asset
  from public.job_assets as asset
  where asset.storage_path = p_storage_path;

  if v_asset.id is not null then
    if v_asset.job_id = v_job.id
      and v_asset.uploaded_by_membership_id = v_actor.membership_id then
      return v_asset;
    end if;
    raise exception 'evidence path is already used' using errcode = '23505';
  end if;

  if (
    select count(*)
    from public.job_assets as asset
    where asset.job_id = v_job.id
      and asset.archived_at is null
  ) >= 10 then
    raise exception 'a job can contain at most 10 evidence images'
      using errcode = '22023';
  end if;

  insert into public.job_assets (
    organisation_id,
    job_id,
    uploaded_by_membership_id,
    storage_path,
    mime_type,
    size_bytes,
    submission_version
  )
  values (
    v_actor.organisation_id,
    v_job.id,
    v_actor.membership_id,
    p_storage_path,
    p_mime_type,
    p_size_bytes,
    v_job.submission_version
  )
  returning * into v_asset;

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
    jsonb_build_object('event', 'evidence_added', 'asset_id', v_asset.id)
  );

  return v_asset;
end;
$$;

create function public.archive_job_evidence(
  p_job_id bigint,
  p_asset_id bigint
)
returns public.job_assets
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor record;
  v_asset public.job_assets;
  v_job public.jobs;
begin
  select context.membership_id, context.organisation_id
  into v_actor
  from private.current_membership_context() as context
  where context.role = 'employee';

  if v_actor.membership_id is null then
    raise exception 'employee membership required' using errcode = '42501';
  end if;

  select *
  into v_job
  from public.jobs as job
  where job.id = p_job_id
    and job.organisation_id = v_actor.organisation_id
  for update;

  if v_job.id is null
    or v_job.assignee_membership_id <> v_actor.membership_id then
    raise exception 'job is unavailable' using errcode = 'P0002';
  end if;
  if v_job.status not in ('assigned', 'in_progress') then
    raise exception 'submitted evidence cannot be removed' using errcode = '22023';
  end if;

  select *
  into v_asset
  from public.job_assets as asset
  where asset.id = p_asset_id
    and asset.job_id = v_job.id
    and asset.organisation_id = v_actor.organisation_id
  for update;

  if v_asset.id is null then
    raise exception 'evidence is unavailable' using errcode = 'P0002';
  end if;
  if v_asset.archived_at is not null then
    return v_asset;
  end if;
  if v_asset.uploaded_by_membership_id <> v_actor.membership_id
    or v_asset.submission_version <> v_job.submission_version then
    raise exception 'submitted evidence cannot be removed' using errcode = '22023';
  end if;

  update public.job_assets
  set archived_at = now()
  where id = v_asset.id
  returning * into v_asset;

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
    jsonb_build_object('event', 'evidence_removed', 'asset_id', v_asset.id)
  );

  return v_asset;
end;
$$;

create function public.submit_job(p_job_id bigint)
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
  v_owner record;
  v_submission_update_id bigint;
begin
  select context.membership_id, context.organisation_id
  into v_actor
  from private.current_membership_context() as context
  where context.role = 'employee';

  if v_actor.membership_id is null then
    raise exception 'employee membership required' using errcode = '42501';
  end if;

  select *
  into v_job
  from public.jobs as job
  where job.id = p_job_id
    and job.organisation_id = v_actor.organisation_id
  for update;

  if v_job.id is null
    or v_job.assignee_membership_id <> v_actor.membership_id then
    raise exception 'job is unavailable' using errcode = 'P0002';
  end if;

  if v_job.status = 'in_review' then
    select delivery.id, delivery.submission_update_id
    into v_notification_id, v_submission_update_id
    from public.job_notification_deliveries as delivery
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
    select 1
    from public.job_updates as job_update
    where job_update.job_id = v_job.id
      and job_update.type = 'note'
      and job_update.author_membership_id = v_actor.membership_id
  ) then
    raise exception 'add a completion note before submitting'
      using errcode = '22023';
  end if;
  if (
    select count(*)
    from public.job_assets as asset
    where asset.job_id = v_job.id
      and asset.archived_at is null
  ) < v_job.minimum_completion_photos then
    raise exception 'add the required completion photos before submitting'
      using errcode = '22023';
  end if;

  update public.jobs
  set
    status = 'in_review',
    submitted_at = now(),
    submission_version = submission_version + 1
  where id = v_job.id
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
    'status_change',
    jsonb_build_object(
      'previous_status', case
        when v_job.started_at is null then 'assigned'
        else 'in_progress'
      end,
      'new_status', 'in_review',
      'submission_version', v_job.submission_version
    )
  )
  returning id into v_submission_update_id;

  select membership.id, membership.email
  into v_owner
  from public.memberships as membership
  where membership.id = v_job.created_by
    and membership.organisation_id = v_actor.organisation_id
    and membership.role = 'owner'
    and membership.status = 'active';

  insert into public.job_notification_deliveries (
    organisation_id,
    job_id,
    submission_update_id,
    recipient_membership_id,
    recipient_email,
    status,
    error_message
  )
  values (
    v_actor.organisation_id,
    v_job.id,
    v_submission_update_id,
    v_owner.id,
    v_owner.email,
    case
      when v_owner.id is null then 'failed'::public.job_notification_status
      else 'queued'::public.job_notification_status
    end,
    case
      when v_owner.id is null then 'The job creator is not an active owner.'
      else null
    end
  )
  returning id into v_notification_id;

  return query select v_job.id, v_notification_id, v_submission_update_id;
end;
$$;

create function public.reopen_job(
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
  select context.membership_id, context.organisation_id
  into v_actor
  from private.current_membership_context() as context
  where context.role = 'owner';

  if v_actor.membership_id is null then
    raise exception 'owner membership required' using errcode = '42501';
  end if;
  if btrim(coalesce(p_feedback, '')) = '' then
    raise exception 'owner feedback is required' using errcode = '22023';
  end if;
  if not exists (
    select 1
    from public.memberships as membership
    where membership.id = p_assignee_membership_id
      and membership.organisation_id = v_actor.organisation_id
      and membership.role = 'employee'
      and membership.status = 'active'
  ) then
    raise exception 'choose an active employee' using errcode = '22023';
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
  if v_job.status = 'assigned' then
    return v_job;
  end if;
  if v_job.status not in ('in_review', 'archived') then
    raise exception 'job cannot be reopened' using errcode = '22023';
  end if;

  v_previous_assignee := v_job.assignee_membership_id;
  v_previous_status := v_job.status;

  insert into public.job_updates (
    organisation_id,
    job_id,
    author_membership_id,
    type,
    body,
    metadata
  )
  values (
    v_actor.organisation_id,
    v_job.id,
    v_actor.membership_id,
    'comment',
    btrim(p_feedback),
    jsonb_build_object('event', 'reopen_feedback')
  );

  perform set_config('pph.allow_job_reopen_with_feedback', 'on', true);

  update public.jobs
  set
    assignee_membership_id = p_assignee_membership_id,
    status = 'assigned',
    started_at = null,
    submitted_at = null,
    archived_at = null
  where id = v_job.id
  returning * into v_job;

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
  end if;

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

  return v_job;
end;
$$;

create function public.archive_job(p_job_id bigint)
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

  select *
  into v_job
  from public.jobs as job
  where job.id = p_job_id
    and job.organisation_id = v_actor.organisation_id
  for update;

  if v_job.id is null then
    raise exception 'job is unavailable' using errcode = 'P0002';
  end if;
  if v_job.status = 'archived' then
    return v_job;
  end if;
  if v_job.status <> 'in_review' then
    raise exception 'only submitted jobs can be approved'
      using errcode = '22023';
  end if;

  update public.jobs
  set status = 'archived', archived_at = now()
  where id = v_job.id
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
    'status_change',
    jsonb_build_object(
      'previous_status', 'in_review',
      'new_status', 'archived'
    )
  );

  return v_job;
end;
$$;

create function public.retry_job_notification(p_delivery_id bigint)
returns public.job_notification_deliveries
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor record;
  v_delivery public.job_notification_deliveries;
begin
  select context.membership_id, context.organisation_id
  into v_actor
  from private.current_membership_context() as context
  where context.role = 'owner';

  if v_actor.membership_id is null then
    raise exception 'owner membership required' using errcode = '42501';
  end if;

  select *
  into v_delivery
  from public.job_notification_deliveries as delivery
  where delivery.id = p_delivery_id
    and delivery.organisation_id = v_actor.organisation_id
  for update;

  if v_delivery.id is null then
    raise exception 'notification is unavailable' using errcode = 'P0002';
  end if;
  if v_delivery.status = 'sent' then
    return v_delivery;
  end if;
  if v_delivery.recipient_membership_id is null
    or v_delivery.recipient_email is null then
    raise exception 'notification has no active owner recipient'
      using errcode = '22023';
  end if;

  update public.job_notification_deliveries
  set status = 'queued', error_message = null
  where id = v_delivery.id
  returning * into v_delivery;

  return v_delivery;
end;
$$;

create function public.list_job_participant_identities(p_job_id bigint)
returns table (
  membership_id bigint,
  display_name text,
  role public.membership_role
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor record;
  v_job public.jobs;
begin
  select context.membership_id, context.organisation_id, context.role
  into v_actor
  from private.current_membership_context() as context;

  if v_actor.membership_id is null then
    raise exception 'active membership required' using errcode = '42501';
  end if;

  select *
  into v_job
  from public.jobs as job
  where job.id = p_job_id
    and job.organisation_id = v_actor.organisation_id;

  if v_job.id is null
    or (
      v_actor.role <> 'owner'
      and v_job.assignee_membership_id <> v_actor.membership_id
    ) then
    raise exception 'job is unavailable' using errcode = 'P0002';
  end if;

  return query
  select
    membership.id,
    coalesce(
      nullif(
        btrim(profile.first_name || ' ' || profile.last_name),
        ''
      ),
      split_part(membership.email, '@', 1)
    ),
    membership.role
  from public.memberships as membership
  left join public.employee_profiles as profile
    on profile.membership_id = membership.id
    and profile.organisation_id = membership.organisation_id
  where membership.organisation_id = v_actor.organisation_id
    and (
      membership.id in (
        v_job.created_by,
        v_job.assignee_membership_id
      )
      or membership.id in (
        select job_update.author_membership_id
        from public.job_updates as job_update
        where job_update.job_id = v_job.id
          and job_update.organisation_id = v_actor.organisation_id
          and job_update.author_membership_id is not null
      )
    );
end;
$$;

revoke all on function public.start_job(bigint)
  from public, anon, authenticated, service_role;
revoke all on function public.add_job_note(bigint, text)
  from public, anon, authenticated, service_role;
revoke all on function public.add_job_comment(bigint, text)
  from public, anon, authenticated, service_role;
revoke all on function public.finalize_job_evidence(bigint, text, text, bigint)
  from public, anon, authenticated, service_role;
revoke all on function public.archive_job_evidence(bigint, bigint)
  from public, anon, authenticated, service_role;
revoke all on function public.submit_job(bigint)
  from public, anon, authenticated, service_role;
revoke all on function public.reopen_job(bigint, text, bigint)
  from public, anon, authenticated, service_role;
revoke all on function public.archive_job(bigint)
  from public, anon, authenticated, service_role;
revoke all on function public.retry_job_notification(bigint)
  from public, anon, authenticated, service_role;
revoke all on function public.list_job_participant_identities(bigint)
  from public, anon, authenticated, service_role;

grant execute on function public.start_job(bigint) to authenticated;
grant execute on function public.add_job_note(bigint, text) to authenticated;
grant execute on function public.add_job_comment(bigint, text) to authenticated;
grant execute on function public.finalize_job_evidence(bigint, text, text, bigint)
  to authenticated;
grant execute on function public.archive_job_evidence(bigint, bigint)
  to authenticated;
grant execute on function public.submit_job(bigint) to authenticated;
grant execute on function public.reopen_job(bigint, text, bigint)
  to authenticated;
grant execute on function public.archive_job(bigint) to authenticated;
grant execute on function public.retry_job_notification(bigint)
  to authenticated;
grant execute on function public.list_job_participant_identities(bigint)
  to authenticated;

-- Preserve S02's owner/self profile update contract in one permissive policy
-- so Postgres does not evaluate two equivalent UPDATE policy branches.
drop policy employee_profiles_update_owner
  on public.employee_profiles;
drop policy employee_profiles_update_self
  on public.employee_profiles;

create policy employee_profiles_update_owner_or_self
on public.employee_profiles
for update
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
    or membership_id = (
      select context.membership_id
      from private.current_membership_context() as context
      where context.role = 'employee'
    )
  )
)
with check (
  organisation_id = (
    select context.organisation_id
    from private.current_membership_context() as context
  )
  and (
    (
      select context.role
      from private.current_membership_context() as context
    ) = 'owner'
    or membership_id = (
      select context.membership_id
      from private.current_membership_context() as context
      where context.role = 'employee'
    )
  )
);

create function private.broadcast_job_asset_change()
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
    'evidence',
    tg_op,
    coalesce(new.id, old.id)
  );
  return null;
end;
$$;

create function private.broadcast_job_notification_change()
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
    coalesce(new.id, old.id)
  );
  return null;
end;
$$;

create trigger job_assets_broadcast_realtime
after insert or update or delete on public.job_assets
for each row execute function private.broadcast_job_asset_change();

create trigger job_notification_deliveries_broadcast_realtime
after insert or update or delete on public.job_notification_deliveries
for each row execute function private.broadcast_job_notification_change();

revoke all on function private.broadcast_job_asset_change()
  from public, anon, authenticated, service_role;
revoke all on function private.broadcast_job_notification_change()
  from public, anon, authenticated, service_role;
