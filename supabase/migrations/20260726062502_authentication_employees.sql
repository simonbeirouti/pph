create type public.invite_delivery_status as enum ('pending', 'sent', 'failed');

alter table public.memberships
  add column invite_delivery_status public.invite_delivery_status not null default 'pending',
  add column invite_last_attempted_at timestamptz;

update public.memberships
set
  invite_delivery_status = 'sent',
  invite_last_attempted_at = invited_at;

create index memberships_organisation_status_idx
  on public.memberships (organisation_id, status);

create policy memberships_insert_owner
on public.memberships
for insert
to authenticated
with check (
  organisation_id = (
    select context.organisation_id
    from private.current_membership_context() as context
    where context.role = 'owner'
  )
  and role = 'employee'
  and status = 'invited'
  and user_id is null
);

create policy memberships_update_owner
on public.memberships
for update
to authenticated
using (
  organisation_id = (
    select context.organisation_id
    from private.current_membership_context() as context
    where context.role = 'owner'
  )
  and role = 'employee'
)
with check (
  organisation_id = (
    select context.organisation_id
    from private.current_membership_context() as context
    where context.role = 'owner'
  )
  and role = 'employee'
);

create policy employee_profiles_insert_owner
on public.employee_profiles
for insert
to authenticated
with check (
  organisation_id = (
    select context.organisation_id
    from private.current_membership_context() as context
    where context.role = 'owner'
  )
  and exists (
    select 1
    from public.memberships as membership
    where membership.id = membership_id
      and membership.organisation_id = employee_profiles.organisation_id
      and membership.role = 'employee'
  )
);

create policy employee_profiles_update_owner
on public.employee_profiles
for update
to authenticated
using (
  organisation_id = (
    select context.organisation_id
    from private.current_membership_context() as context
    where context.role = 'owner'
  )
)
with check (
  organisation_id = (
    select context.organisation_id
    from private.current_membership_context() as context
    where context.role = 'owner'
  )
);

grant insert on public.memberships, public.employee_profiles to authenticated;
grant update (
  status,
  activated_at,
  deactivated_at,
  invite_delivery_status,
  invite_last_attempted_at
) on public.memberships to authenticated;
grant update (
  first_name,
  last_name,
  phone,
  job_title,
  avatar_path
) on public.employee_profiles to authenticated;
grant usage, select on all sequences in schema public to authenticated;

create function public.create_employee(
  p_email text,
  p_first_name text,
  p_last_name text,
  p_phone text,
  p_job_title text
)
returns table (
  membership_id bigint,
  profile_id bigint,
  membership_status public.membership_status,
  auth_user_id uuid,
  created boolean
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_organisation_id bigint;
  v_membership public.memberships;
  v_profile public.employee_profiles;
  v_created boolean := false;
begin
  select context.organisation_id
  into v_organisation_id
  from private.current_membership_context() as context
  where context.role = 'owner';

  if v_organisation_id is null then
    raise exception 'owner membership required' using errcode = '42501';
  end if;

  insert into public.memberships (
    organisation_id,
    email,
    role,
    status,
    invited_at,
    invite_delivery_status
  )
  values (
    v_organisation_id,
    lower(btrim(p_email)),
    'employee',
    'invited',
    now(),
    'pending'
  )
  on conflict (organisation_id, email) do nothing
  returning * into v_membership;

  if found then
    v_created := true;
  else
    select *
    into strict v_membership
    from public.memberships
    where organisation_id = v_organisation_id
      and email = lower(btrim(p_email));
  end if;

  if v_created then
    insert into public.employee_profiles (
      organisation_id,
      membership_id,
      first_name,
      last_name,
      phone,
      job_title
    )
    values (
      v_organisation_id,
      v_membership.id,
      btrim(p_first_name),
      btrim(p_last_name),
      btrim(p_phone),
      btrim(p_job_title)
    )
    returning * into v_profile;
  else
    select profile.*
    into strict v_profile
    from public.employee_profiles as profile
    where profile.membership_id = v_membership.id;
  end if;

  return query
  select
    v_membership.id,
    v_profile.id,
    v_membership.status,
    v_membership.user_id,
    v_created;
end;
$$;

create function public.link_invited_membership()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_email text;
  v_membership_id bigint;
  v_match_count integer;
begin
  if v_user_id is null then
    raise exception 'authenticated invitation required' using errcode = '42501';
  end if;

  select lower(btrim(user_record.email))
  into v_email
  from auth.users as user_record
  where user_record.id = v_user_id;

  select count(*), min(membership.id)
  into v_match_count, v_membership_id
  from public.memberships as membership
  where membership.email = v_email
    and membership.role = 'employee'
    and membership.status = 'invited'
    and (membership.user_id is null or membership.user_id = v_user_id);

  if v_match_count <> 1 then
    raise exception 'invitation membership is unavailable' using errcode = 'P0002';
  end if;

  update public.memberships
  set user_id = v_user_id
  where id = v_membership_id;

  return v_membership_id;
end;
$$;

create function public.activate_invited_membership()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_membership_id bigint;
begin
  if v_user_id is null then
    raise exception 'authenticated invitation required' using errcode = '42501';
  end if;

  update public.memberships
  set
    status = 'active',
    activated_at = now(),
    deactivated_at = null
  where user_id = v_user_id
    and role = 'employee'
    and status = 'invited'
  returning id into v_membership_id;

  if v_membership_id is null then
    raise exception 'invited membership is unavailable' using errcode = 'P0002';
  end if;

  return v_membership_id;
end;
$$;

revoke all on function public.create_employee(text, text, text, text, text)
  from public, anon, authenticated, service_role;
revoke all on function public.link_invited_membership()
  from public, anon, authenticated, service_role;
revoke all on function public.activate_invited_membership()
  from public, anon, authenticated, service_role;
grant execute on function public.create_employee(text, text, text, text, text)
  to authenticated;
grant execute on function public.link_invited_membership()
  to authenticated;
grant execute on function public.activate_invited_membership()
  to authenticated;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'avatars',
  'avatars',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create function private.can_access_avatar(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_organisation_id bigint;
  v_membership_id bigint;
begin
  if object_name !~ '^[0-9]+/[0-9]+/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$' then
    return false;
  end if;

  v_organisation_id := split_part(object_name, '/', 1)::bigint;
  v_membership_id := split_part(object_name, '/', 2)::bigint;

  return exists (
    select 1
    from private.current_membership_context() as context
    join public.memberships as target
      on target.id = v_membership_id
      and target.organisation_id = context.organisation_id
    where v_organisation_id = context.organisation_id
      and (
        context.role = 'owner'
        or target.id = context.membership_id
      )
  );
end;
$$;

revoke all on function private.can_access_avatar(text)
  from public, anon, authenticated, service_role;
grant execute on function private.can_access_avatar(text) to authenticated;

create policy avatars_select_active_member
on storage.objects
for select
to authenticated
using (
  bucket_id = 'avatars'
  and (select private.can_access_avatar(name))
);

create policy avatars_insert_owner
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and (
    select context.role = 'owner'
    from private.current_membership_context() as context
  )
  and (select private.can_access_avatar(name))
);

create policy avatars_update_owner
on storage.objects
for update
to authenticated
using (
  bucket_id = 'avatars'
  and (
    select context.role = 'owner'
    from private.current_membership_context() as context
  )
  and (select private.can_access_avatar(name))
)
with check (
  bucket_id = 'avatars'
  and (
    select context.role = 'owner'
    from private.current_membership_context() as context
  )
  and (select private.can_access_avatar(name))
);

create policy avatars_delete_owner
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'avatars'
  and (
    select context.role = 'owner'
    from private.current_membership_context() as context
  )
  and (select private.can_access_avatar(name))
);

insert into public.employee_profiles (
  organisation_id,
  membership_id,
  first_name,
  last_name,
  phone,
  job_title
)
select
  membership.organisation_id,
  membership.id,
  initcap(split_part(membership.email, '@', 1)),
  'Owner',
  '',
  'Owner'
from public.memberships as membership
where membership.role = 'owner'
on conflict (membership_id) do nothing;

create policy employee_profiles_update_self
on public.employee_profiles
for update
to authenticated
using (
  membership_id = (
    select context.membership_id
    from private.current_membership_context() as context
    where context.role = 'employee'
  )
)
with check (
  membership_id = (
    select context.membership_id
    from private.current_membership_context() as context
    where context.role = 'employee'
  )
  and organisation_id = (
    select context.organisation_id
    from private.current_membership_context() as context
    where context.role = 'employee'
  )
);

create function public.delete_invited_employee(p_membership_id bigint)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_organisation_id bigint;
  v_membership_id bigint;
begin
  select context.organisation_id
  into v_organisation_id
  from private.current_membership_context() as context
  where context.role = 'owner';

  if v_organisation_id is null then
    raise exception 'owner membership required' using errcode = '42501';
  end if;

  select membership.id
  into v_membership_id
  from public.memberships as membership
  where membership.id = p_membership_id
    and membership.organisation_id = v_organisation_id
    and membership.role = 'employee'
    and membership.status = 'invited'
    and membership.user_id is null;

  if v_membership_id is null then
    return false;
  end if;

  delete from public.employee_profiles
  where membership_id = v_membership_id
    and organisation_id = v_organisation_id;

  delete from public.memberships
  where id = v_membership_id
    and organisation_id = v_organisation_id;

  return true;
end;
$$;

revoke all on function public.delete_invited_employee(bigint)
from public, anon;

grant execute on function public.delete_invited_employee(bigint)
to authenticated;
