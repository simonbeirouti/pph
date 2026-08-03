import "server-only"

import { cache } from "react"

import {
  requireActiveMembership,
  requireAssignedWorker,
  requireOperations,
} from "@/lib/auth/membership"
import {
  listActiveRosterEmployeeOptions,
  type ActiveEmployeeOption,
} from "@/lib/employees/data"
import type { Tables } from "@/lib/supabase/database.types"
import { createClient } from "@/lib/supabase/server"
import type {
  EmployeeShiftSummary,
  RosterAssignableJob,
  RosterShift,
  TodayRosterAggregate,
  WorkingNowAggregate,
} from "@/lib/roster/types"

type RosterShiftRow = Tables<"roster_shifts">

const SHIFT_FIELDS =
  "id, organisation_id, employee_membership_id, starts_at, ends_at, notes, created_by, created_at, updated_at, archived_at, locked_at, locked_by"

export function toRosterShift(row: RosterShiftRow): RosterShift {
  return {
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    createdByMembershipId: row.created_by,
    employeeMembershipId: row.employee_membership_id,
    endsAt: row.ends_at,
    id: row.id,
    lockedAt: row.locked_at,
    lockedByMembershipId: row.locked_by,
    notes: row.notes,
    organisationId: row.organisation_id,
    startsAt: row.starts_at,
    updatedAt: row.updated_at,
  }
}

export const getOwnerRosterContext = cache(async () => {
  const owner = await requireOperations()
  const employees = await listActiveRosterEmployeeOptions()
  return { employees, timezone: owner.timezone }
})

async function queryIntersectingShifts(input: {
  employeeMembershipId?: number
  endUtc: string
  organisationId: number
  startUtc: string
}) {
  const supabase = await createClient()
  let query = supabase
    .from("roster_shifts")
    .select(SHIFT_FIELDS)
    .eq("organisation_id", input.organisationId)
    .is("archived_at", null)
    .lt("starts_at", input.endUtc)
    .gt("ends_at", input.startUtc)
    .order("starts_at", { ascending: true })

  if (input.employeeMembershipId) {
    query = query.eq("employee_membership_id", input.employeeMembershipId)
  }

  const { data, error } = await query
  if (error) throw new Error("Unable to load roster shifts")
  return (data ?? []).map((row) => toRosterShift(row as RosterShiftRow))
}

async function queryAssignableJobs(
  organisationId: number
): Promise<RosterAssignableJob[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("jobs")
    .select("id, assignee_membership_id, title, scheduled_at, due_at")
    .eq("organisation_id", organisationId)
    .eq("status", "assigned")
    .is("archived_at", null)
    .order("due_at", { ascending: true, nullsFirst: false })
    .order("title")

  if (error) throw new Error("Unable to load assignable jobs")
  return (data ?? []).map((job) => ({
    assigneeMembershipId: job.assignee_membership_id,
    dueAt: job.due_at,
    id: job.id,
    scheduledAt: job.scheduled_at,
    title: job.title,
  }))
}

export const getOwnerRosterCalendarData = cache(
  async (input: {
    employeeMembershipId?: number
    endUtc: string
    startUtc: string
  }): Promise<{
    employees: ActiveEmployeeOption[]
    jobs: RosterAssignableJob[]
    shifts: RosterShift[]
    timezone: string
  }> => {
    const owner = await requireOperations()
    const [{ employees }, jobs, shifts] = await Promise.all([
      getOwnerRosterContext(),
      queryAssignableJobs(owner.organisationId),
      queryIntersectingShifts({
        ...input,
        organisationId: owner.organisationId,
      }),
    ])
    return { employees, jobs, shifts, timezone: owner.timezone }
  }
)

export const getEmployeeRosterCalendarData = cache(
  async (input: {
    endUtc: string
    startUtc: string
  }): Promise<{
    shifts: RosterShift[]
    timezone: string
  }> => {
    const employee = await requireAssignedWorker()
    const shifts = await queryIntersectingShifts({
      ...input,
      employeeMembershipId: employee.membershipId,
      organisationId: employee.organisationId,
    })
    return { shifts, timezone: employee.timezone }
  }
)

export async function getEmployeeShiftSummary(
  employeeMembershipId?: number,
  now = new Date()
): Promise<EmployeeShiftSummary> {
  const membership = await requireActiveMembership()
  const targetId =
    membership.role === "employee"
      ? membership.membershipId
      : employeeMembershipId
  if (!targetId) return { current: null, upcoming: [] }

  if (membership.role === "owner") {
    const employees = await listActiveRosterEmployeeOptions()
    if (
      !employees.some((employee) => employee.employeeMembershipId === targetId)
    ) {
      return { current: null, upcoming: [] }
    }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("roster_shifts")
    .select(SHIFT_FIELDS)
    .eq("organisation_id", membership.organisationId)
    .eq("employee_membership_id", targetId)
    .is("archived_at", null)
    .gt("ends_at", now.toISOString())
    .order("starts_at", { ascending: true })
    .limit(6)

  if (error) throw new Error("Unable to load shift summary")
  const shifts = (data ?? []).map((row) => toRosterShift(row as RosterShiftRow))
  return {
    current:
      shifts.find(
        (shift) =>
          new Date(shift.startsAt) <= now && now < new Date(shift.endsAt)
      ) ?? null,
    upcoming: shifts
      .filter((shift) => new Date(shift.startsAt) > now)
      .slice(0, 5),
  }
}

export async function listEmployeeShiftSummaries(now = new Date()) {
  const owner = await requireOperations()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("roster_shifts")
    .select(SHIFT_FIELDS)
    .eq("organisation_id", owner.organisationId)
    .is("archived_at", null)
    .gt("ends_at", now.toISOString())
    .order("starts_at", { ascending: true })

  if (error) throw new Error("Unable to load employee shift summaries")
  const result: Record<number, EmployeeShiftSummary> = {}
  for (const row of data ?? []) {
    const shift = toRosterShift(row as RosterShiftRow)
    const summary = (result[shift.employeeMembershipId] ??= {
      current: null,
      upcoming: [],
    })
    if (new Date(shift.startsAt) <= now && now < new Date(shift.endsAt)) {
      summary.current = shift
    } else {
      summary.upcoming.push(shift)
    }
  }
  return result
}

export async function getWorkingNowAggregate(
  now = new Date()
): Promise<WorkingNowAggregate[]> {
  const owner = await requireOperations()
  const supabase = await createClient()
  const nowIso = now.toISOString()
  const { data, error } = await supabase
    .from("roster_shifts")
    .select(SHIFT_FIELDS)
    .eq("organisation_id", owner.organisationId)
    .is("archived_at", null)
    .lte("starts_at", nowIso)
    .gt("ends_at", nowIso)
    .order("ends_at", { ascending: true })

  if (error) throw new Error("Unable to load employees working now")
  return (data ?? []).map((row) => {
    const shift = toRosterShift(row as RosterShiftRow)
    return {
      employeeMembershipId: shift.employeeMembershipId,
      endsAt: shift.endsAt,
      shiftId: shift.id,
      startsAt: shift.startsAt,
    }
  })
}

export async function getTodayRosterAggregate(input: {
  endUtc: string
  startUtc: string
}): Promise<TodayRosterAggregate[]> {
  const owner = await requireOperations()
  const shifts = await queryIntersectingShifts({
    ...input,
    organisationId: owner.organisationId,
  })
  const aggregates = new Map<number, TodayRosterAggregate>()
  const rangeStart = new Date(input.startUtc).getTime()
  const rangeEnd = new Date(input.endUtc).getTime()
  for (const shift of shifts) {
    const clippedMinutes = Math.round(
      (Math.min(new Date(shift.endsAt).getTime(), rangeEnd) -
        Math.max(new Date(shift.startsAt).getTime(), rangeStart)) /
        60_000
    )
    const row = aggregates.get(shift.employeeMembershipId)
    if (row) {
      row.firstStartsAt =
        row.firstStartsAt < shift.startsAt ? row.firstStartsAt : shift.startsAt
      row.shiftCount += 1
      row.totalMinutes += clippedMinutes
    } else {
      aggregates.set(shift.employeeMembershipId, {
        employeeMembershipId: shift.employeeMembershipId,
        firstStartsAt: shift.startsAt,
        shiftCount: 1,
        totalMinutes: clippedMinutes,
      })
    }
  }
  return [...aggregates.values()].toSorted((left, right) =>
    left.firstStartsAt.localeCompare(right.firstStartsAt)
  )
}
