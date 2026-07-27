drop policy roster_shifts_select_active_membership
on public.roster_shifts;

create policy roster_shifts_select_active_membership
on public.roster_shifts
for select
to authenticated
using (
  archived_at is null
  and organisation_id = (
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

create policy roster_shifts_insert_owner
on public.roster_shifts
for insert
to authenticated
with check (
  organisation_id = (
    select context.organisation_id
    from private.current_membership_context() as context
  )
  and created_by = (
    select context.membership_id
    from private.current_membership_context() as context
  )
  and (
    select context.role
    from private.current_membership_context() as context
  ) = 'owner'
  and exists (
    select 1
    from public.memberships as target
    where target.id = employee_membership_id
      and target.organisation_id = roster_shifts.organisation_id
      and target.role = 'employee'
      and target.status = 'active'
  )
);

create policy roster_shifts_update_owner
on public.roster_shifts
for update
to authenticated
using (
  archived_at is null
  and organisation_id = (
    select context.organisation_id
    from private.current_membership_context() as context
  )
  and (
    select context.role
    from private.current_membership_context() as context
  ) = 'owner'
)
with check (
  organisation_id = (
    select context.organisation_id
    from private.current_membership_context() as context
  )
  and (
    select context.role
    from private.current_membership_context() as context
  ) = 'owner'
  and exists (
    select 1
    from public.memberships as target
    where target.id = employee_membership_id
      and target.organisation_id = roster_shifts.organisation_id
      and target.role = 'employee'
      and target.status = 'active'
  )
);

grant insert (
  organisation_id,
  employee_membership_id,
  starts_at,
  ends_at,
  notes,
  created_by
) on public.roster_shifts to authenticated;

grant update (
  employee_membership_id,
  starts_at,
  ends_at,
  notes,
  archived_at
) on public.roster_shifts to authenticated;

grant usage, select on sequence public.roster_shifts_id_seq to authenticated;
