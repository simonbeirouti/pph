create type public.membership_role as enum ('owner', 'employee');
create type public.membership_status as enum ('invited', 'active', 'inactive');

create schema if not exists private;
revoke all on schema private from public, anon;

create table public.organisations (
  id bigint generated always as identity primary key,
  name text not null constraint organisations_name_not_blank check (btrim(name) <> ''),
  timezone text not null default 'Australia/Melbourne'
    constraint organisations_timezone_not_blank check (btrim(timezone) <> ''),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.memberships (
  id bigint generated always as identity primary key,
  organisation_id bigint not null references public.organisations(id) on delete restrict,
  user_id uuid references auth.users(id) on delete restrict,
  email text not null,
  role public.membership_role not null,
  status public.membership_status not null default 'invited',
  invited_at timestamptz,
  activated_at timestamptz,
  deactivated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint memberships_id_organisation_unique unique (id, organisation_id),
  constraint memberships_email_normalised check (
    email = lower(btrim(email)) and email <> ''
  ),
  constraint memberships_organisation_email_unique unique (organisation_id, email),
  constraint memberships_status_timestamps check (
    (
      status = 'invited'
      and invited_at is not null
      and activated_at is null
      and deactivated_at is null
    )
    or (
      status = 'active'
      and user_id is not null
      and activated_at is not null
      and deactivated_at is null
    )
    or (
      status = 'inactive'
      and user_id is not null
      and activated_at is not null
      and deactivated_at is not null
    )
  )
);

create unique index memberships_user_id_unique
  on public.memberships(user_id)
  where user_id is not null;
create index memberships_organisation_id_idx
  on public.memberships(organisation_id);

create table public.employee_profiles (
  id bigint generated always as identity primary key,
  organisation_id bigint not null references public.organisations(id) on delete restrict,
  membership_id bigint not null unique,
  first_name text not null
    constraint employee_profiles_first_name_not_blank check (btrim(first_name) <> ''),
  last_name text not null
    constraint employee_profiles_last_name_not_blank check (btrim(last_name) <> ''),
  phone text not null default '',
  job_title text not null default '',
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint employee_profiles_membership_organisation_fkey
    foreign key (membership_id, organisation_id)
    references public.memberships(id, organisation_id)
    on delete restrict
);

create index employee_profiles_organisation_id_idx
  on public.employee_profiles(organisation_id);

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger organisations_set_updated_at
before update on public.organisations
for each row execute function private.set_updated_at();

create trigger memberships_set_updated_at
before update on public.memberships
for each row execute function private.set_updated_at();

create trigger employee_profiles_set_updated_at
before update on public.employee_profiles
for each row execute function private.set_updated_at();

create function private.current_membership_context()
returns table (
  membership_id bigint,
  organisation_id bigint,
  role public.membership_role,
  status public.membership_status
)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, m.organisation_id, m.role, m.status
  from public.memberships as m
  where m.user_id = (select auth.uid())
    and m.status = 'active'
  limit 1
$$;

revoke all on function private.set_updated_at() from public, anon, authenticated;
revoke all on function private.current_membership_context()
  from public, anon, authenticated, service_role;
grant usage on schema private to authenticated;
grant execute on function private.current_membership_context() to authenticated;

alter table public.organisations enable row level security;
alter table public.memberships enable row level security;
alter table public.employee_profiles enable row level security;

create policy organisations_select_active_membership
on public.organisations
for select
to authenticated
using (
  id = (
    select context.organisation_id
    from private.current_membership_context() as context
  )
);

create policy memberships_select_active_membership
on public.memberships
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
    or id = (
      select context.membership_id
      from private.current_membership_context() as context
    )
  )
);

create policy employee_profiles_select_active_membership
on public.employee_profiles
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
    or membership_id = (
      select context.membership_id
      from private.current_membership_context() as context
    )
  )
);

revoke all on public.organisations, public.memberships, public.employee_profiles
  from anon, authenticated;
grant select on public.organisations, public.memberships, public.employee_profiles
  to authenticated;
grant all on public.organisations, public.memberships, public.employee_profiles
  to service_role;
grant usage, select on all sequences in schema public to service_role;
