-- Offline assigned-worker completion

create type public.job_operation_type as enum (
  'start',
  'note',
  'photo',
  'submit'
);

alter table public.jobs
  add column version integer not null default 1
  constraint jobs_version_positive check (version > 0);

create table public.job_operation_receipts (
  id bigint generated always as identity primary key,
  organisation_id bigint not null,
  membership_id bigint not null,
  job_id bigint not null,
  client_operation_id uuid not null,
  operation_type public.job_operation_type not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  constraint job_operation_receipts_membership_operation_unique
    unique (membership_id, client_operation_id),
  constraint job_operation_receipts_job_organisation_fkey
    foreign key (job_id, organisation_id)
    references public.jobs(id, organisation_id)
    on delete restrict,
  constraint job_operation_receipts_membership_organisation_fkey
    foreign key (membership_id, organisation_id)
    references public.memberships(id, organisation_id)
    on delete restrict
);

create index job_operation_receipts_job_created_idx
  on public.job_operation_receipts (job_id, created_at desc);
create index job_operation_receipts_organisation_created_idx
  on public.job_operation_receipts (organisation_id, created_at desc);

alter table public.job_operation_receipts enable row level security;

create policy job_operation_receipts_select_authorised
on public.job_operation_receipts
for select
to authenticated
using (
  organisation_id = (
    select context.organisation_id
    from private.current_membership_actual() context
  )
  and (
    membership_id = (
      select context.membership_id
      from private.current_membership_actual() context
    )
    or (
      select private.is_operations_role(context.role)
      from private.current_membership_actual() context
    )
  )
);

revoke all on public.job_operation_receipts from anon, authenticated;
grant select on public.job_operation_receipts to authenticated;
grant all on public.job_operation_receipts to service_role;

create function private.bump_job_version_on_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.version := old.version + 1;
  return new;
end;
$$;

create trigger jobs_bump_version
before update on public.jobs
for each row execute function private.bump_job_version_on_update();

create function private.bump_job_version_from_child()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job_id bigint;
begin
  v_job_id := coalesce(new.job_id, old.job_id);
  update public.jobs
  set version = version + 1
  where id = v_job_id;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger job_updates_bump_job_version
after insert on public.job_updates
for each row execute function private.bump_job_version_from_child();

create trigger job_assets_bump_job_version
after insert or update on public.job_assets
for each row execute function private.bump_job_version_from_child();

revoke all on function private.bump_job_version_on_update(),
  private.bump_job_version_from_child()
  from public, anon, authenticated, service_role;

create function public.replay_job_operation(
  p_job_id bigint,
  p_client_operation_id uuid,
  p_expected_version integer,
  p_operation_type public.job_operation_type,
  p_payload jsonb default '{}'::jsonb
)
returns table (
  operation_status text,
  job_version integer,
  result jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor record;
  v_asset public.job_assets;
  v_body text;
  v_job public.jobs;
  v_path text;
  v_receipt public.job_operation_receipts;
  v_result jsonb;
  v_submission_update_id bigint;
  v_update public.job_updates;
  v_required_role public.membership_role;
begin
  select *
  into v_actor
  from private.current_membership_actual() context
  where context.role in ('employee', 'manager');

  if v_actor.membership_id is null then
    raise exception 'assigned worker membership required' using errcode = '42501';
  end if;

  select *
  into v_job
  from public.jobs job
  where job.id = p_job_id
    and job.organisation_id = v_actor.organisation_id
  for update;

  if v_job.id is null
    or v_job.assignee_membership_id <> v_actor.membership_id then
    return query
      select 'needs_attention', coalesce(v_job.version, p_expected_version),
        jsonb_build_object('reason', 'job_unavailable');
    return;
  end if;

  select *
  into v_receipt
  from public.job_operation_receipts receipt
  where receipt.membership_id = v_actor.membership_id
    and receipt.client_operation_id = p_client_operation_id;

  if v_receipt.id is not null then
    return query select 'acknowledged', v_job.version, v_receipt.result;
    return;
  end if;

  if p_expected_version <> v_job.version
    and not (
      p_operation_type in ('note', 'photo')
      and v_job.status in ('assigned', 'in_progress')
    )
    and not (
      p_operation_type = 'start'
      and v_job.status = 'in_progress'
    ) then
    return query
      select 'conflict', v_job.version,
        jsonb_build_object(
          'reason', 'version_conflict',
          'expectedVersion', p_expected_version,
          'actualVersion', v_job.version
        );
    return;
  end if;

  if p_operation_type = 'start' then
    if v_job.status = 'assigned' then
      update public.jobs
      set status = 'in_progress', started_at = coalesce(started_at, now())
      where id = v_job.id;

      insert into public.job_updates (
        organisation_id, job_id, author_membership_id, type, metadata
      )
      values (
        v_actor.organisation_id,
        v_job.id,
        v_actor.membership_id,
        'status_change',
        jsonb_build_object(
          'previous_status', 'assigned',
          'new_status', 'in_progress',
          'client_operation_id', p_client_operation_id
        )
      );
    elsif v_job.status <> 'in_progress' then
      return query
        select 'needs_attention', v_job.version,
          jsonb_build_object('reason', 'job_not_editable');
      return;
    end if;

  elsif p_operation_type = 'note' then
    if v_job.status not in ('assigned', 'in_progress') then
      return query
        select 'needs_attention', v_job.version,
          jsonb_build_object('reason', 'job_not_editable');
      return;
    end if;
    v_body := btrim(coalesce(p_payload->>'body', ''));
    if v_body = '' or length(v_body) > 4000 then
      raise exception 'note must contain between 1 and 4000 characters'
        using errcode = '22023';
    end if;

    insert into public.job_updates (
      organisation_id, job_id, author_membership_id, type, body, metadata
    )
    values (
      v_actor.organisation_id,
      v_job.id,
      v_actor.membership_id,
      'note',
      v_body,
      jsonb_build_object('client_operation_id', p_client_operation_id)
    )
    returning * into v_update;

  elsif p_operation_type = 'photo' then
    if v_job.status not in ('assigned', 'in_progress') then
      return query
        select 'needs_attention', v_job.version,
          jsonb_build_object('reason', 'job_not_editable');
      return;
    end if;
    v_path := coalesce(p_payload->>'storagePath', '');
    if v_path !~ (
      '^' || v_actor.organisation_id::text || '/' || v_job.id::text || '/'
      || v_actor.membership_id::text || '/' || p_client_operation_id::text
      || '\.(jpg|png|webp|heic|heif)$'
    ) then
      raise exception 'invalid deterministic evidence path'
        using errcode = '22023';
    end if;
    if coalesce(p_payload->>'mimeType', '') not in (
      'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'
    ) or coalesce((p_payload->>'sizeBytes')::bigint, 0) not between 1 and 10485760 then
      raise exception 'invalid evidence metadata' using errcode = '22023';
    end if;

    select *
    into v_asset
    from public.job_assets asset
    where asset.storage_path = v_path;

    if v_asset.id is null then
      if (
        select count(*)
        from public.job_assets asset
        where asset.job_id = v_job.id and asset.archived_at is null
      ) >= 10 then
        raise exception 'a job can contain at most 10 evidence images'
          using errcode = '22023';
      end if;

      insert into public.job_assets (
        organisation_id,
        job_id,
        uploaded_by_membership_id,
        kind,
        storage_path,
        mime_type,
        size_bytes,
        submission_version
      )
      values (
        v_actor.organisation_id,
        v_job.id,
        v_actor.membership_id,
        'completion_photo',
        v_path,
        p_payload->>'mimeType',
        (p_payload->>'sizeBytes')::bigint,
        v_job.submission_version
      )
      returning * into v_asset;

      insert into public.job_updates (
        organisation_id, job_id, author_membership_id, type, metadata
      )
      values (
        v_actor.organisation_id,
        v_job.id,
        v_actor.membership_id,
        'system',
        jsonb_build_object(
          'event', 'evidence_added',
          'asset_id', v_asset.id,
          'client_operation_id', p_client_operation_id
        )
      );
    end if;

  elsif p_operation_type = 'submit' then
    if v_job.status = 'in_review' then
      null;
    elsif v_job.status not in ('assigned', 'in_progress') then
      return query
        select 'needs_attention', v_job.version,
          jsonb_build_object('reason', 'job_not_submittable');
      return;
    else
      if v_job.requires_completion_note and not exists (
        select 1
        from public.job_updates job_update
        where job_update.job_id = v_job.id
          and job_update.type = 'note'
          and job_update.author_membership_id = v_actor.membership_id
      ) then
        return query
          select 'needs_attention', v_job.version,
            jsonb_build_object('reason', 'completion_note_required');
        return;
      end if;
      if (
        select count(*)
        from public.job_assets asset
        where asset.job_id = v_job.id and asset.archived_at is null
      ) < v_job.minimum_completion_photos then
        return query
          select 'needs_attention', v_job.version,
            jsonb_build_object('reason', 'completion_photos_required');
        return;
      end if;

      v_required_role := case
        when v_actor.role = 'manager'
          then 'owner'::public.membership_role
        else 'manager'::public.membership_role
      end;
      update public.jobs
      set
        status = 'in_review',
        submitted_at = now(),
        submission_version = submission_version + 1,
        submitted_by_membership_id = v_actor.membership_id,
        required_reviewer_role = v_required_role,
        reviewed_by_membership_id = null,
        reviewed_by_role = null,
        reviewed_at = null
      where id = v_job.id;

      insert into public.job_updates (
        organisation_id, job_id, author_membership_id, type, metadata
      )
      values (
        v_actor.organisation_id,
        v_job.id,
        v_actor.membership_id,
        'status_change',
        jsonb_build_object(
          'previous_status',
          case when v_job.started_at is null then 'assigned' else 'in_progress' end,
          'new_status', 'in_review',
          'submission_version', v_job.submission_version + 1,
          'submitter_role', v_actor.role,
          'required_reviewer_role', v_required_role,
          'client_operation_id', p_client_operation_id
        )
      )
      returning id into v_submission_update_id;

      insert into public.job_notification_deliveries (
        organisation_id,
        job_id,
        submission_update_id,
        recipient_membership_id,
        recipient_email,
        status
      )
      select
        v_actor.organisation_id,
        v_job.id,
        v_submission_update_id,
        reviewer.id,
        reviewer.email,
        'queued'
      from public.memberships reviewer
      where reviewer.organisation_id = v_actor.organisation_id
        and reviewer.status = 'active'
        and reviewer.id <> v_actor.membership_id
        and (
          reviewer.role = 'owner'
          or (v_required_role = 'manager' and reviewer.role = 'manager')
        )
      on conflict on constraint job_notification_submission_recipient_unique
      do nothing;
    end if;
  end if;

  select * into v_job from public.jobs where id = p_job_id;
  v_result := jsonb_build_object(
    'jobId', v_job.id,
    'version', v_job.version,
    'status', v_job.status,
    'updateId', v_update.id,
    'assetId', v_asset.id,
    'submissionUpdateId', v_submission_update_id
  );

  insert into public.job_operation_receipts (
    organisation_id,
    membership_id,
    job_id,
    client_operation_id,
    operation_type,
    result
  )
  values (
    v_actor.organisation_id,
    v_actor.membership_id,
    v_job.id,
    p_client_operation_id,
    p_operation_type,
    v_result
  )
  returning * into v_receipt;

  return query select 'acknowledged', v_job.version, v_receipt.result;
end;
$$;

revoke all on function public.replay_job_operation(
  bigint, uuid, integer, public.job_operation_type, jsonb
) from public, anon;
grant execute on function public.replay_job_operation(
  bigint, uuid, integer, public.job_operation_type, jsonb
) to authenticated;

-- Web push notifications

create type public.push_event_type as enum (
  'job_assignment',
  'job_reassignment',
  'job_submission',
  'job_approved_or_archived',
  'job_reopened',
  'roster_assignment',
  'roster_changed',
  'roster_archived'
);

create type public.push_delivery_status as enum (
  'queued',
  'sending',
  'delivered',
  'retry',
  'permanent_failure'
);

create table public.web_push_subscriptions (
  id bigint generated always as identity primary key,
  organisation_id bigint not null,
  membership_id bigint not null,
  endpoint text not null constraint web_push_endpoint_not_blank
    check (btrim(endpoint) <> ''),
  p256dh text not null constraint web_push_p256dh_not_blank
    check (btrim(p256dh) <> ''),
  auth text not null constraint web_push_auth_not_blank
    check (btrim(auth) <> ''),
  user_agent text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deactivated_at timestamptz,
  constraint web_push_subscriptions_membership_organisation_fkey
    foreign key (membership_id, organisation_id)
    references public.memberships(id, organisation_id)
    on delete cascade,
  constraint web_push_subscriptions_endpoint_unique unique (endpoint),
  constraint web_push_subscriptions_active_state check (
    (active and deactivated_at is null)
    or (not active and deactivated_at is not null)
  )
);

create index web_push_subscriptions_recipient_idx
  on public.web_push_subscriptions (organisation_id, membership_id)
  where active;

create table public.push_notification_events (
  id bigint generated always as identity primary key,
  organisation_id bigint not null references public.organisations(id) on delete cascade,
  event_key text not null,
  event_type public.push_event_type not null,
  actor_membership_id bigint,
  job_id bigint,
  roster_shift_id bigint,
  label text not null,
  deep_link text not null,
  created_at timestamptz not null default now(),
  constraint push_events_actor_organisation_fkey
    foreign key (actor_membership_id, organisation_id)
    references public.memberships(id, organisation_id)
    on delete set null,
  constraint push_events_job_organisation_fkey
    foreign key (job_id, organisation_id)
    references public.jobs(id, organisation_id)
    on delete cascade,
  constraint push_events_roster_shift_fkey
    foreign key (roster_shift_id)
    references public.roster_shifts(id)
    on delete cascade,
  constraint push_events_key_unique unique (event_key),
  constraint push_events_generic_payload check (
    label in (
      'Job assigned',
      'Job assignment changed',
      'Job submitted for review',
      'Job approved or archived',
      'Job reopened with feedback',
      'Roster assigned',
      'Roster changed',
      'Roster archived'
    )
    and deep_link ~ '^/dashboard/(jobs|roster)(\\?|$)'
  )
);

create index push_notification_events_organisation_created_idx
  on public.push_notification_events (organisation_id, created_at desc);

create table public.push_notification_deliveries (
  id bigint generated always as identity primary key,
  event_id bigint not null references public.push_notification_events(id) on delete cascade,
  subscription_id bigint not null references public.web_push_subscriptions(id) on delete cascade,
  organisation_id bigint not null references public.organisations(id) on delete cascade,
  recipient_membership_id bigint not null,
  status public.push_delivery_status not null default 'queued',
  attempt_count integer not null default 0 check (attempt_count >= 0),
  next_attempt_at timestamptz not null default now(),
  last_attempt_at timestamptz,
  delivered_at timestamptz,
  response_status integer,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint push_deliveries_recipient_organisation_fkey
    foreign key (recipient_membership_id, organisation_id)
    references public.memberships(id, organisation_id)
    on delete cascade,
  constraint push_deliveries_event_subscription_unique
    unique (event_id, subscription_id)
);

create index push_notification_deliveries_dispatch_idx
  on public.push_notification_deliveries (status, next_attempt_at, id)
  where status in ('queued', 'retry');
create index push_notification_deliveries_recipient_idx
  on public.push_notification_deliveries (
    organisation_id,
    recipient_membership_id,
    created_at desc
  );

alter table public.web_push_subscriptions enable row level security;
alter table public.push_notification_events enable row level security;
alter table public.push_notification_deliveries enable row level security;

create policy web_push_subscriptions_select_own
on public.web_push_subscriptions for select to authenticated
using (
  membership_id = (
    select context.membership_id
    from private.current_membership_context() as context
  )
  and organisation_id = (
    select context.organisation_id
    from private.current_membership_context() as context
  )
);

create policy web_push_subscriptions_insert_own
on public.web_push_subscriptions for insert to authenticated
with check (
  membership_id = (
    select context.membership_id
    from private.current_membership_context() as context
  )
  and organisation_id = (
    select context.organisation_id
    from private.current_membership_context() as context
  )
);

create policy web_push_subscriptions_update_own
on public.web_push_subscriptions for update to authenticated
using (
  membership_id = (
    select context.membership_id
    from private.current_membership_context() as context
  )
  and organisation_id = (
    select context.organisation_id
    from private.current_membership_context() as context
  )
)
with check (
  membership_id = (
    select context.membership_id
    from private.current_membership_context() as context
  )
  and organisation_id = (
    select context.organisation_id
    from private.current_membership_context() as context
  )
);

create policy push_notification_events_select_recipient
on public.push_notification_events for select to authenticated
using (
  exists (
    select 1
    from public.push_notification_deliveries delivery
    where delivery.event_id = push_notification_events.id
      and delivery.recipient_membership_id = (
        select context.membership_id
        from private.current_membership_context() as context
      )
  )
);

create policy push_notification_deliveries_select_own
on public.push_notification_deliveries for select to authenticated
using (
  recipient_membership_id = (
    select context.membership_id
    from private.current_membership_context() as context
  )
  and organisation_id = (
    select context.organisation_id
    from private.current_membership_context() as context
  )
);

grant select, insert, update (
  endpoint,
  p256dh,
  auth,
  user_agent,
  active,
  updated_at,
  deactivated_at
) on public.web_push_subscriptions to authenticated;

grant usage, select on sequence public.web_push_subscriptions_id_seq to authenticated;
grant select on public.push_notification_events to authenticated;
grant select on public.push_notification_deliveries to authenticated;

create function private.current_push_actor(p_organisation_id bigint)
returns bigint
language sql
stable
set search_path = ''
as $$
  select membership.id
  from public.memberships membership
  where membership.organisation_id = p_organisation_id
    and membership.user_id = (select auth.uid())
    and membership.status = 'active'
  order by membership.id
  limit 1;
$$;

create function private.enqueue_push_event(
  p_event_key text,
  p_event_type public.push_event_type,
  p_organisation_id bigint,
  p_actor_membership_id bigint,
  p_recipient_membership_ids bigint[],
  p_label text,
  p_deep_link text,
  p_job_id bigint default null,
  p_roster_shift_id bigint default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_id bigint;
begin
  insert into public.push_notification_events (
    organisation_id,
    event_key,
    event_type,
    actor_membership_id,
    job_id,
    roster_shift_id,
    label,
    deep_link
  )
  values (
    p_organisation_id,
    p_event_key,
    p_event_type,
    p_actor_membership_id,
    p_job_id,
    p_roster_shift_id,
    p_label,
    p_deep_link
  )
  on conflict (event_key) do update
  set event_key = excluded.event_key
  returning id into v_event_id;

  insert into public.push_notification_deliveries (
    event_id,
    subscription_id,
    organisation_id,
    recipient_membership_id
  )
  select
    v_event_id,
    subscription.id,
    p_organisation_id,
    subscription.membership_id
  from public.web_push_subscriptions subscription
  join public.memberships recipient
    on recipient.id = subscription.membership_id
   and recipient.organisation_id = subscription.organisation_id
  where subscription.organisation_id = p_organisation_id
    and subscription.active
    and recipient.status = 'active'
    and subscription.membership_id = any(
      coalesce(p_recipient_membership_ids, '{}'::bigint[])
    )
    and subscription.membership_id is distinct from p_actor_membership_id
  on conflict (event_id, subscription_id) do nothing;
end;
$$;

revoke all on function private.current_push_actor(bigint)
from public, anon, authenticated;
revoke all on function private.enqueue_push_event(
  text,
  public.push_event_type,
  bigint,
  bigint,
  bigint[],
  text,
  text,
  bigint,
  bigint
) from public, anon, authenticated;

create function private.enqueue_job_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor bigint := private.current_push_actor(new.organisation_id);
  v_recipients bigint[];
  v_type public.push_event_type;
  v_label text;
begin
  if tg_op = 'INSERT' then
    if new.assignee_membership_id is null then return new; end if;
    v_recipients := array[new.assignee_membership_id];
    v_type := 'job_assignment';
    v_label := 'Job assigned';
  elsif old.status in ('in_review', 'archived')
    and new.status = 'assigned' then
    v_recipients := array_remove(
      array[old.assignee_membership_id, new.assignee_membership_id],
      null
    );
    v_type := 'job_reopened';
    v_label := 'Job reopened with feedback';
  elsif old.status is distinct from new.status and new.status = 'in_review' then
    select coalesce(array_agg(reviewer.id), '{}'::bigint[])
    into v_recipients
    from public.memberships reviewer
    where reviewer.organisation_id = new.organisation_id
      and reviewer.status = 'active'
      and (
        reviewer.role = 'owner'
        or (new.required_reviewer_role = 'manager' and reviewer.role = 'manager')
      );
    v_type := 'job_submission';
    v_label := 'Job submitted for review';
  elsif old.status is distinct from new.status and new.status = 'archived' then
    v_recipients := array_remove(
      array[new.assignee_membership_id, new.submitted_by_membership_id],
      null
    );
    v_type := 'job_approved_or_archived';
    v_label := 'Job approved or archived';
  elsif old.assignee_membership_id is distinct from new.assignee_membership_id then
    v_recipients := array_remove(
      array[old.assignee_membership_id, new.assignee_membership_id],
      null
    );
    v_type := 'job_reassignment';
    v_label := 'Job assignment changed';
  else
    return new;
  end if;

  perform private.enqueue_push_event(
    format('job:%s:%s:%s', new.id, new.version, v_type),
    v_type,
    new.organisation_id,
    v_actor,
    v_recipients,
    v_label,
    format('/dashboard/jobs?job=%s', new.id),
    new.id,
    null
  );
  return new;
end;
$$;

create trigger jobs_enqueue_push
after insert or update on public.jobs
for each row execute function private.enqueue_job_push();

create function private.enqueue_roster_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor bigint := private.current_push_actor(new.organisation_id);
  v_recipients bigint[];
  v_type public.push_event_type;
  v_label text;
begin
  if tg_op = 'INSERT' then
    v_recipients := array[new.employee_membership_id];
    v_type := 'roster_assignment';
    v_label := 'Roster assigned';
  elsif old.archived_at is null and new.archived_at is not null then
    v_recipients := array_remove(
      array[old.employee_membership_id, new.employee_membership_id],
      null
    );
    v_type := 'roster_archived';
    v_label := 'Roster archived';
  elsif old.employee_membership_id is distinct from new.employee_membership_id
    or old.starts_at is distinct from new.starts_at
    or old.ends_at is distinct from new.ends_at then
    v_recipients := array_remove(
      array[old.employee_membership_id, new.employee_membership_id],
      null
    );
    v_type := 'roster_changed';
    v_label := 'Roster changed';
  else
    return new;
  end if;

  perform private.enqueue_push_event(
    format(
      'roster:%s:%s:%s',
      new.id,
      extract(epoch from new.updated_at)::bigint,
      v_type
    ),
    v_type,
    new.organisation_id,
    v_actor,
    v_recipients,
    v_label,
    '/dashboard/roster',
    null,
    new.id
  );
  return new;
end;
$$;

create trigger roster_shifts_enqueue_push
after insert or update on public.roster_shifts
for each row execute function private.enqueue_roster_push();

-- Realtime version invalidation hardening

create or replace function private.broadcast_job_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
    and (to_jsonb(new) - 'version' - 'updated_at')
      = (to_jsonb(old) - 'version' - 'updated_at') then
    return null;
  end if;

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

revoke all on function private.broadcast_job_change()
from public, anon, authenticated;

-- Web push subscription grants

grant select on table public.web_push_subscriptions to authenticated;
grant insert (
  organisation_id,
  membership_id,
  endpoint,
  p256dh,
  auth,
  user_agent,
  active,
  updated_at,
  deactivated_at
) on public.web_push_subscriptions to authenticated;
grant update (
  organisation_id,
  membership_id,
  endpoint,
  p256dh,
  auth,
  user_agent,
  active,
  updated_at,
  deactivated_at
) on public.web_push_subscriptions to authenticated;

-- Offline-first dashboard synchronization foundation

-- Complete offline-first dashboard foundation.

alter table public.organisations
  add column version integer not null default 1
  constraint organisations_version_positive check (version > 0);
alter table public.memberships
  add column version integer not null default 1
  constraint memberships_version_positive check (version > 0);
alter table public.employee_profiles
  add column version integer not null default 1
  constraint employee_profiles_version_positive check (version > 0);
alter table public.roster_shifts
  add column version integer not null default 1
  constraint roster_shifts_version_positive check (version > 0);
alter table public.job_templates
  add column version integer not null default 1
  constraint job_templates_version_positive check (version > 0);
alter table public.job_schedules
  add column version integer not null default 1
  constraint job_schedules_version_positive check (version > 0);
alter table public.job_schedule_occurrences
  add column version integer not null default 1
  constraint job_schedule_occurrences_version_positive check (version > 0);

create function private.bump_offline_entity_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.version := old.version + 1;
  return new;
end;
$$;

create trigger organisations_bump_offline_version
before update on public.organisations
for each row execute function private.bump_offline_entity_version();
create trigger memberships_bump_offline_version
before update on public.memberships
for each row execute function private.bump_offline_entity_version();
create trigger employee_profiles_bump_offline_version
before update on public.employee_profiles
for each row execute function private.bump_offline_entity_version();
create trigger roster_shifts_bump_offline_version
before update on public.roster_shifts
for each row execute function private.bump_offline_entity_version();
create trigger job_templates_bump_offline_version
before update on public.job_templates
for each row execute function private.bump_offline_entity_version();
create trigger job_schedules_bump_offline_version
before update on public.job_schedules
for each row execute function private.bump_offline_entity_version();
create trigger job_schedule_occurrences_bump_offline_version
before update on public.job_schedule_occurrences
for each row execute function private.bump_offline_entity_version();

revoke all on function private.bump_offline_entity_version()
  from public, anon, authenticated, service_role;

create table public.organisation_sync_changes (
  revision bigint generated always as identity primary key,
  organisation_id bigint not null
    references public.organisations(id) on delete restrict,
  entity_type text not null
    constraint organisation_sync_changes_entity_type_not_blank
    check (btrim(entity_type) <> ''),
  entity_id bigint not null,
  operation text not null
    constraint organisation_sync_changes_operation
    check (operation in ('upsert', 'delete')),
  scope_membership_id bigint,
  operations_only boolean not null default false,
  changed_at timestamptz not null default now(),
  constraint organisation_sync_changes_scope_organisation_fkey
    foreign key (scope_membership_id, organisation_id)
    references public.memberships(id, organisation_id)
    on delete set null
);

create index organisation_sync_changes_organisation_revision_idx
  on public.organisation_sync_changes (organisation_id, revision);
create index organisation_sync_changes_scope_revision_idx
  on public.organisation_sync_changes (
    organisation_id,
    scope_membership_id,
    revision
  )
  where not operations_only;

alter table public.organisation_sync_changes enable row level security;
revoke all on public.organisation_sync_changes from public, anon, authenticated;
grant all on public.organisation_sync_changes to service_role;

create function private.record_organisation_sync_change()
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
    v_scope_membership_id := nullif(
      v_entity->>'assignee_membership_id',
      ''
    )::bigint;
  elsif tg_table_name in ('job_updates', 'job_assets') then
    v_job_id := (v_entity->>'job_id')::bigint;
    select job.assignee_membership_id
    into v_scope_membership_id
    from public.jobs as job
    where job.id = v_job_id
      and job.organisation_id = (v_entity->>'organisation_id')::bigint;
  elsif tg_table_name in (
    'job_templates',
    'job_schedules',
    'job_schedule_occurrences',
    'job_notification_deliveries',
    'membership_role_audit'
  ) then
    v_operations_only := true;
  end if;

  insert into public.organisation_sync_changes (
    organisation_id,
    entity_type,
    entity_id,
    operation,
    scope_membership_id,
    operations_only
  )
  values (
    (v_entity->>'organisation_id')::bigint,
    tg_table_name,
    (v_entity->>'id')::bigint,
    case when tg_op = 'DELETE' then 'delete' else 'upsert' end,
    v_scope_membership_id,
    v_operations_only
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger organisations_record_sync_change
after insert or update or delete on public.organisations
for each row execute function private.record_organisation_sync_change();
create trigger memberships_record_sync_change
after insert or update or delete on public.memberships
for each row execute function private.record_organisation_sync_change();
create trigger employee_profiles_record_sync_change
after insert or update or delete on public.employee_profiles
for each row execute function private.record_organisation_sync_change();
create trigger roster_shifts_record_sync_change
after insert or update or delete on public.roster_shifts
for each row execute function private.record_organisation_sync_change();
create trigger jobs_record_sync_change
after insert or update or delete on public.jobs
for each row execute function private.record_organisation_sync_change();
create trigger job_updates_record_sync_change
after insert or update or delete on public.job_updates
for each row execute function private.record_organisation_sync_change();
create trigger job_assets_record_sync_change
after insert or update or delete on public.job_assets
for each row execute function private.record_organisation_sync_change();
create trigger job_templates_record_sync_change
after insert or update or delete on public.job_templates
for each row execute function private.record_organisation_sync_change();
create trigger job_schedules_record_sync_change
after insert or update or delete on public.job_schedules
for each row execute function private.record_organisation_sync_change();
create trigger job_schedule_occurrences_record_sync_change
after insert or update or delete on public.job_schedule_occurrences
for each row execute function private.record_organisation_sync_change();
create trigger job_notification_deliveries_record_sync_change
after insert or update or delete on public.job_notification_deliveries
for each row execute function private.record_organisation_sync_change();
create trigger membership_role_audit_record_sync_change
after insert or update or delete on public.membership_role_audit
for each row execute function private.record_organisation_sync_change();

revoke all on function private.record_organisation_sync_change()
  from public, anon, authenticated, service_role;

create table public.offline_operation_receipts (
  id bigint generated always as identity primary key,
  organisation_id bigint not null,
  membership_id bigint not null,
  entity_type text not null
    constraint offline_operation_receipts_entity_type_not_blank
    check (btrim(entity_type) <> ''),
  entity_id text,
  client_operation_id uuid not null,
  operation_type text not null
    constraint offline_operation_receipts_operation_type_not_blank
    check (btrim(operation_type) <> ''),
  result jsonb not null,
  created_at timestamptz not null default now(),
  constraint offline_operation_receipts_membership_operation_unique
    unique (membership_id, client_operation_id),
  constraint offline_operation_receipts_membership_organisation_fkey
    foreign key (membership_id, organisation_id)
    references public.memberships(id, organisation_id)
    on delete restrict
);

create index offline_operation_receipts_organisation_created_idx
  on public.offline_operation_receipts (organisation_id, created_at desc);

alter table public.offline_operation_receipts enable row level security;

create policy offline_operation_receipts_select_authorised
on public.offline_operation_receipts
for select
to authenticated
using (
  organisation_id = (
    select context.organisation_id
    from private.current_membership_actual() as context
  )
  and (
    membership_id = (
      select context.membership_id
      from private.current_membership_actual() as context
    )
    or (
      select private.is_operations_role(context.role)
      from private.current_membership_actual() as context
    )
  )
);

revoke all on public.offline_operation_receipts from public, anon, authenticated;
grant select on public.offline_operation_receipts to authenticated;
grant all on public.offline_operation_receipts to service_role;

create function public.get_offline_sync_revision()
returns bigint
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor record;
  v_revision bigint;
begin
  select *
  into v_actor
  from private.current_membership_actual() as context;
  if v_actor.membership_id is null then
    raise exception 'active membership required' using errcode = '42501';
  end if;

  select coalesce(max(change.revision), 0)
  into v_revision
  from public.organisation_sync_changes as change
  where change.organisation_id = v_actor.organisation_id;
  return v_revision;
end;
$$;

create function public.get_offline_sync_changes(p_after_revision bigint)
returns table (
  revision bigint,
  entity_type text,
  entity_id bigint,
  operation text,
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

revoke all on function public.get_offline_sync_revision(),
  public.get_offline_sync_changes(bigint)
  from public, anon;
grant execute on function public.get_offline_sync_revision(),
  public.get_offline_sync_changes(bigint)
  to authenticated;

-- Offline operation receipt claims

create function public.claim_offline_operation(
  p_client_operation_id uuid,
  p_entity_type text,
  p_entity_id text,
  p_operation_type text
)
returns table (
  claimed boolean,
  result jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor record;
  v_receipt public.offline_operation_receipts;
begin
  select *
  into v_actor
  from private.current_membership_actual();

  if v_actor.membership_id is null then
    raise exception 'active membership required' using errcode = '42501';
  end if;
  if btrim(coalesce(p_entity_type, '')) = ''
    or btrim(coalesce(p_operation_type, '')) = '' then
    raise exception 'operation metadata required' using errcode = '22023';
  end if;

  insert into public.offline_operation_receipts (
    organisation_id,
    membership_id,
    entity_type,
    entity_id,
    client_operation_id,
    operation_type,
    result
  )
  values (
    v_actor.organisation_id,
    v_actor.membership_id,
    p_entity_type,
    nullif(p_entity_id, ''),
    p_client_operation_id,
    p_operation_type,
    jsonb_build_object('status', 'processing')
  )
  on conflict (membership_id, client_operation_id) do nothing
  returning * into v_receipt;

  if v_receipt.id is not null then
    return query
      select true, v_receipt.result;
    return;
  end if;

  select *
  into v_receipt
  from public.offline_operation_receipts receipt
  where receipt.membership_id = v_actor.membership_id
    and receipt.client_operation_id = p_client_operation_id;

  return query
    select false, v_receipt.result;
end;
$$;

create function public.complete_offline_operation(
  p_client_operation_id uuid,
  p_result jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor record;
  v_result jsonb;
begin
  select *
  into v_actor
  from private.current_membership_actual();

  if v_actor.membership_id is null then
    raise exception 'active membership required' using errcode = '42501';
  end if;

  update public.offline_operation_receipts receipt
  set result = coalesce(p_result, '{}'::jsonb)
  where receipt.membership_id = v_actor.membership_id
    and receipt.client_operation_id = p_client_operation_id
  returning receipt.result into v_result;

  if v_result is null then
    raise exception 'offline operation receipt not found'
      using errcode = 'P0002';
  end if;
  return v_result;
end;
$$;

revoke all on function public.claim_offline_operation(
  uuid, text, text, text
) from public, anon;
grant execute on function public.claim_offline_operation(
  uuid, text, text, text
) to authenticated;

revoke all on function public.complete_offline_operation(
  uuid, jsonb
) from public, anon;
grant execute on function public.complete_offline_operation(
  uuid, jsonb
) to authenticated;

-- Synchronization change-feed delete scope correction

alter table public.organisation_sync_changes
  drop constraint organisation_sync_changes_scope_organisation_fkey;

alter table public.organisation_sync_changes
  add constraint organisation_sync_changes_scope_organisation_fkey
  foreign key (scope_membership_id, organisation_id)
  references public.memberships(id, organisation_id)
  on delete set null (scope_membership_id);

-- Manager job participant identity access

create or replace function public.list_job_participant_identities(
  p_job_id bigint
)
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
      v_actor.role not in ('owner', 'manager')
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
