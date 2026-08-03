import "server-only"

import {
  getEmployeeDashboardData,
  getOwnerDashboardData,
} from "@/lib/dashboard/data"
import {
  getCurrentProfile,
  listActiveRosterEmployeeOptions,
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
import { listEmployeeShiftSummaries, toRosterShift } from "@/lib/roster/data"
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

export type OfflineV2DomainName =
  | "dashboard"
  | "employeeJobs"
  | "jobDetails"
  | "jobs"
  | "membership"
  | "people"
  | "profile"
  | "roster"
  | "templates"

export type OfflineV2DomainData = Partial<
  Pick<
    OfflineV2Snapshot,
    | "dashboard"
    | "employeeJobs"
    | "jobDetails"
    | "jobs"
    | "membership"
    | "people"
    | "profile"
    | "roster"
    | "templates"
  >
>

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
  const rosterEmployeesPromise = isOperations
    ? listActiveRosterEmployeeOptions()
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
    rosterEmployees,
  ] = await Promise.all([
    profilePromise,
    operationsDashboardPromise,
    employeeDashboardPromise,
    employeeJobsPromise,
    jobBoardPromise,
    peoplePromise,
    templatesPromise,
    rosterEmployeesPromise,
  ])

  const allJobs = jobBoard?.jobs ?? employeeJobs
  const details = await Promise.all(allJobs.map((job) => getJobDetail(job.id)))
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
      employees: rosterEmployees,
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

export async function buildOfflineV2Domains(
  domains: ReadonlySet<OfflineV2DomainName>,
  jobDetailIds?: ReadonlySet<number>
): Promise<OfflineV2DomainData> {
  if (!domains.size) return {}
  const membership = await requireActiveMembership()
  const isOperations =
    membership.role === "owner" || membership.role === "manager"
  const isWorker =
    membership.role === "employee" || membership.role === "manager"
  const needsJobBoard =
    domains.has("jobs") ||
    domains.has("roster") ||
    (domains.has("jobDetails") && !jobDetailIds)
  const profilePromise =
    domains.has("profile") || domains.has("roster")
      ? getCurrentProfile()
      : Promise.resolve(null)
  const jobBoardPromise =
    needsJobBoard && isOperations
      ? getOwnerJobBoardData()
      : Promise.resolve(null)
  const employeeJobsPromise =
    (domains.has("employeeJobs") || needsJobBoard) && isWorker
      ? getEmployeeAssignedJobs()
      : Promise.resolve([])
  const dashboardPromise = domains.has("dashboard")
    ? Promise.all([
        isOperations ? getOwnerDashboardData() : Promise.resolve(null),
        isWorker ? getEmployeeDashboardData() : Promise.resolve(null),
      ])
    : Promise.resolve(null)
  const peoplePromise =
    domains.has("people") && isOperations
      ? buildPeopleData()
      : Promise.resolve(null)
  const templatesPromise =
    domains.has("templates") && isOperations
      ? getTemplateScheduleData()
      : Promise.resolve(null)
  const [jobBoard, employeeJobs, dashboard, people, templates, profile] =
    await Promise.all([
      jobBoardPromise,
      employeeJobsPromise,
      dashboardPromise,
      peoplePromise,
      templatesPromise,
      profilePromise,
    ])
  const allJobs = jobBoard?.jobs ?? employeeJobs
  const result: OfflineV2DomainData = {}

  if (domains.has("membership")) {
    result.membership = offlineMembership(membership)
  }
  if (domains.has("profile")) {
    result.profile = profile ?? (await getCurrentProfile())
  }
  if (domains.has("dashboard") && dashboard) {
    result.dashboard = {
      employee: dashboard[1],
      operations: dashboard[0],
    }
  }
  if (domains.has("employeeJobs")) result.employeeJobs = employeeJobs
  if (domains.has("jobs")) {
    result.jobs = jobBoard as OfflineJobBoardData | null
  }
  if (domains.has("jobDetails")) {
    const details = await Promise.all(
      (jobDetailIds ? [...jobDetailIds] : allJobs.map((job) => job.id)).map(
        (jobId) => getJobDetail(jobId)
      )
    )
    result.jobDetails = Object.fromEntries(
      details.flatMap((detail) => (detail ? [[detail.id, detail]] : []))
    )
  }
  if (domains.has("people")) result.people = people
  if (domains.has("templates")) {
    result.templates = templates as OfflineTemplateData | null
  }
  if (domains.has("roster")) {
    const supabase = await createClient()
    const activeEmployees = isOperations
      ? await listActiveRosterEmployeeOptions()
      : [toActiveEmployeeOption(profile ?? (await getCurrentProfile()))]
    const { data: shifts, error } = await supabase
      .from("roster_shifts")
      .select("*")
      .eq("organisation_id", membership.organisationId)
      .order("starts_at", { ascending: true })
    if (error) throw new Error("Unable to refresh the offline roster")
    result.roster = {
      employees: activeEmployees,
      jobs: allJobs
        .filter((job) => job.status === "assigned")
        .map((job) => ({
          assigneeMembershipId: job.assigneeMembershipId,
          dueAt: job.dueAt,
          id: job.id,
          scheduledAt: job.scheduledAt,
          title: job.title,
        })),
      shifts: (shifts ?? []).map((row) => toRosterShift(row as RosterShiftRow)),
      timezone: membership.timezone,
    }
  }
  return result
}

async function buildPeopleData(): Promise<OfflinePeopleData> {
  const [employees, jobSummaries, shiftSummaries] = await Promise.all([
    listEmployees(),
    listEmployeeJobSummaries(),
    listEmployeeShiftSummaries(),
  ])
  return { employees, jobSummaries, shiftSummaries }
}

function offlineMembership(
  membership: Awaited<ReturnType<typeof requireActiveMembership>>
) {
  return {
    avatarPath: membership.avatarPath,
    displayName: membership.displayName,
    email: membership.email,
    membershipId: membership.membershipId,
    organisationId: membership.organisationId,
    organisationName: membership.organisationName,
    organisationTimezone: membership.organisationTimezone,
    role: membership.role,
    timezone: membership.timezone,
  }
}
