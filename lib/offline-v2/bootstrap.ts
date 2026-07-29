import "server-only"

import {
  getEmployeeDashboardData,
  getOwnerDashboardData,
} from "@/lib/dashboard/data"
import {
  getCurrentProfile,
  listActiveEmployeeOptions,
  listEmployees,
  toActiveEmployeeOption,
} from "@/lib/employees/data"
import {
  getEmployeeAssignedJobs,
  getJobDetail,
  getOwnerJobBoardData,
  listEmployeeJobSummaries,
} from "@/lib/jobs/data"
import { requireActiveMembership } from "@/lib/auth/membership"
import {
  listEmployeeShiftSummaries,
  toRosterShift,
} from "@/lib/roster/data"
import type { RosterAssignableJob } from "@/lib/roster/types"
import { createClient } from "@/lib/supabase/server"
import type { Tables } from "@/lib/supabase/database.types"
import { getTemplateScheduleData } from "@/lib/templates/data"
import {
  OFFLINE_V2_LEASE_MS,
  OFFLINE_V2_SCHEMA_VERSION,
  type OfflineJobBoardData,
  type OfflinePeopleData,
  type OfflineTemplateData,
  type OfflineV2Snapshot,
} from "@/lib/offline-v2/types"

type RosterShiftRow = Tables<"roster_shifts">

export async function buildOfflineV2Snapshot(): Promise<OfflineV2Snapshot> {
  const membershipPromise = requireActiveMembership()
  const profilePromise = getCurrentProfile()
  const supabasePromise = createClient()
  const membership = await membershipPromise
  const isOperations =
    membership.role === "owner" || membership.role === "manager"
  const isWorker =
    membership.role === "employee" || membership.role === "manager"

  const operationsDashboardPromise = isOperations
    ? getOwnerDashboardData()
    : Promise.resolve(null)
  const employeeDashboardPromise = isWorker
    ? getEmployeeDashboardData()
    : Promise.resolve(null)
  const employeeJobsPromise = isWorker
    ? getEmployeeAssignedJobs()
    : Promise.resolve([])
  const jobBoardPromise = isOperations
    ? getOwnerJobBoardData()
    : Promise.resolve(null)
  const peoplePromise = isOperations ? buildPeopleData() : Promise.resolve(null)
  const templatesPromise = isOperations
    ? getTemplateScheduleData()
    : Promise.resolve(null)
  const activeEmployeesPromise = isOperations
    ? listActiveEmployeeOptions()
    : profilePromise.then((profile) => [toActiveEmployeeOption(profile)])

  const supabase = await supabasePromise
  const [revisionResult, shiftsResult] = await Promise.all([
    supabase.rpc("get_offline_sync_revision"),
    supabase
      .from("roster_shifts")
      .select("*")
      .eq("organisation_id", membership.organisationId)
      .order("starts_at", { ascending: true }),
  ])
  if (revisionResult.error || shiftsResult.error) {
    throw new Error("Unable to prepare offline synchronisation metadata")
  }

  const [
    profile,
    operationsDashboard,
    employeeDashboard,
    employeeJobs,
    jobBoard,
    people,
    templates,
    activeEmployees,
  ] = await Promise.all([
    profilePromise,
    operationsDashboardPromise,
    employeeDashboardPromise,
    employeeJobsPromise,
    jobBoardPromise,
    peoplePromise,
    templatesPromise,
    activeEmployeesPromise,
  ])

  const allJobs = jobBoard?.jobs ?? employeeJobs
  const details = await Promise.all(
    allJobs.map((job) => getJobDetail(job.id))
  )
  const jobDetails = Object.fromEntries(
    details.flatMap((detail) => (detail ? [[detail.id, detail]] : []))
  )
  const rosterJobs: RosterAssignableJob[] = allJobs
    .filter((job) => job.status === "assigned")
    .map((job) => ({
      assigneeMembershipId: job.assigneeMembershipId,
      dueAt: job.dueAt,
      id: job.id,
      scheduledAt: job.scheduledAt,
      title: job.title,
    }))

  const refreshedAt = new Date()
  return {
    dashboard: {
      employee: employeeDashboard,
      operations: operationsDashboard,
    },
    employeeJobs,
    jobs: jobBoard as OfflineJobBoardData | null,
    jobDetails,
    leaseExpiresAt: new Date(
      refreshedAt.getTime() + OFFLINE_V2_LEASE_MS
    ).toISOString(),
    membership: {
      avatarPath: membership.avatarPath,
      displayName: membership.displayName,
      email: membership.email,
      membershipId: membership.membershipId,
      organisationId: membership.organisationId,
      organisationName: membership.organisationName,
      organisationTimezone: membership.organisationTimezone,
      role: membership.role,
      timezone: membership.timezone,
    },
    people,
    profile,
    refreshedAt: refreshedAt.toISOString(),
    revision: revisionResult.data ?? 0,
    roster: {
      employees: activeEmployees,
      jobs: rosterJobs,
      shifts: (shiftsResult.data ?? []).map((row) =>
        toRosterShift(row as RosterShiftRow)
      ),
      timezone: membership.timezone,
    },
    schemaVersion: OFFLINE_V2_SCHEMA_VERSION,
    templates: templates as OfflineTemplateData | null,
  }
}

async function buildPeopleData(): Promise<OfflinePeopleData> {
  const [employees, jobSummaries, shiftSummaries] = await Promise.all([
    listEmployees(),
    listEmployeeJobSummaries(),
    listEmployeeShiftSummaries(),
  ])
  return { employees, jobSummaries, shiftSummaries }
}
