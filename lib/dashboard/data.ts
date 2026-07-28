import "server-only"

import { cache } from "react"

import {
  requireAssignedWorker,
  requireOperations,
} from "@/lib/auth/membership"
import { listEmployees } from "@/lib/employees/data"
import { sortJobsByUrgency } from "@/lib/jobs/board"
import {
  getEmployeeAssignedJobs,
  getOwnerJobAggregates,
  toJobCard,
} from "@/lib/jobs/data"
import type { JobCard } from "@/lib/jobs/types"
import {
  getEmployeeShiftSummary,
  getWorkingNowAggregate,
} from "@/lib/roster/data"
import { localDateForInstant, localDateRange } from "@/lib/roster/time"
import type { EmployeeShiftSummary, RosterShift } from "@/lib/roster/types"
import type { Tables } from "@/lib/supabase/database.types"
import { createClient } from "@/lib/supabase/server"

type JobRow = Tables<"jobs">
type ShiftRow = Tables<"roster_shifts">

export type OwnerDashboardShift = RosterShift & {
  employeeName: string
  workingNow: boolean
}

export type OwnerDashboardData = {
  awaitingReview: number
  outstanding: number
  recentlySubmitted: (JobCard & { submittedAt: string })[]
  todayRoster: OwnerDashboardShift[]
  urgent: JobCard[]
  urgentCount: number
  workingNow: number
}

export type EmployeeDashboardData = {
  jobs: JobCard[]
  nextActionable: JobCard | null
  shifts: EmployeeShiftSummary
}

function toRosterShift(row: ShiftRow): RosterShift {
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

export const getOwnerDashboardData = cache(
  async (): Promise<OwnerDashboardData> => {
    const owner = await requireOperations()
    const supabase = await createClient()
    const today = localDateForInstant(new Date(), owner.timezone)
    const range = localDateRange(today, 1, owner.timezone)
    const [
      aggregates,
      working,
      employees,
      urgentResult,
      submittedResult,
      shiftsResult,
    ] = await Promise.all([
      getOwnerJobAggregates(),
      getWorkingNowAggregate(),
      listEmployees(),
      supabase
        .from("jobs")
        .select("*")
        .eq("organisation_id", owner.organisationId)
        .eq("priority", "urgent")
        .neq("status", "archived")
        .limit(100),
      supabase
        .from("jobs")
        .select("*")
        .eq("organisation_id", owner.organisationId)
        .not("submitted_at", "is", null)
        .order("submitted_at", { ascending: false })
        .limit(5),
      supabase
        .from("roster_shifts")
        .select("*")
        .eq("organisation_id", owner.organisationId)
        .is("archived_at", null)
        .lt("starts_at", range.endUtc)
        .gt("ends_at", range.startUtc)
        .order("starts_at", { ascending: true }),
    ])

    if (urgentResult.error || submittedResult.error || shiftsResult.error) {
      throw new Error("Unable to load owner dashboard")
    }
    const employeeNames = new Map(
      employees.map((employee) => [employee.membershipId, employee.displayName])
    )
    const workingIds = new Set(working.map((row) => row.employeeMembershipId))
    const urgent = (urgentResult.data ?? [])
      .map((row) => toJobCard(row as JobRow))
      .toSorted((left, right) => {
        if (left.dueAt && right.dueAt)
          return (
            left.dueAt.localeCompare(right.dueAt) ||
            right.updatedAt.localeCompare(left.updatedAt)
          )
        if (left.dueAt) return -1
        if (right.dueAt) return 1
        return right.updatedAt.localeCompare(left.updatedAt)
      })
      .slice(0, 5)

    return {
      awaitingReview: aggregates.awaitingReview,
      outstanding: aggregates.outstanding,
      recentlySubmitted: (submittedResult.data ?? []).map((row) => ({
        ...toJobCard(row as JobRow),
        submittedAt: row.submitted_at!,
      })),
      todayRoster: (shiftsResult.data ?? [])
        .map((row) => toRosterShift(row as ShiftRow))
        .map((shift) => ({
          ...shift,
          employeeName:
            employeeNames.get(shift.employeeMembershipId) ?? "Former employee",
          workingNow: workingIds.has(shift.employeeMembershipId),
        }))
        .toSorted(
          (left, right) =>
            left.startsAt.localeCompare(right.startsAt) ||
            left.employeeName.localeCompare(right.employeeName)
        ),
      urgent,
      urgentCount: aggregates.highUrgency,
      workingNow: new Set(working.map((row) => row.employeeMembershipId)).size,
    }
  }
)

export const getEmployeeDashboardData = cache(
  async (): Promise<EmployeeDashboardData> => {
    const employee = await requireAssignedWorker()
    const [jobs, shifts] = await Promise.all([
      getEmployeeAssignedJobs(),
      getEmployeeShiftSummary(employee.membershipId),
    ])
    const ordered = sortJobsByUrgency(jobs)
    return {
      jobs: ordered,
      nextActionable:
        ordered.find(
          (job) => job.status === "assigned" || job.status === "in_progress"
        ) ?? null,
      shifts,
    }
  }
)
