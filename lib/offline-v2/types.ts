import type {
  OwnerDashboardData,
  EmployeeDashboardData,
} from "@/lib/dashboard/data"
import type {
  ActiveEmployeeOption,
  EmployeeSummary,
} from "@/lib/employees/data"
import type {
  EmployeeJobSummary,
  JobArchivePagination,
  JobBoardEmployee,
  JobCard,
  JobDetail,
  JobRosterShiftOption,
} from "@/lib/jobs/types"
import type {
  EmployeeShiftSummary,
  RosterAssignableJob,
  RosterShift,
} from "@/lib/roster/types"
import type {
  JobSchedule,
  JobTemplate,
  TemplateEmployee,
} from "@/lib/templates/types"

export const OFFLINE_V2_SCHEMA_VERSION = 4
export const OFFLINE_V2_LEASE_MS = 7 * 24 * 60 * 60 * 1000

export type OfflineRole = "owner" | "manager" | "employee"

export type OfflineMembership = {
  avatarPath: string | null
  displayName: string
  email: string
  membershipId: number
  organisationId: number
  organisationName: string
  organisationTimezone: string
  role: OfflineRole
  timezone: string
}

export type OfflineJobBoardData = {
  archivePagination: JobArchivePagination
  employees: JobBoardEmployee[]
  jobs: JobCard[]
  rosterShifts: JobRosterShiftOption[]
  templates: JobTemplate[]
  timezone: string
}

export type OfflineRosterData = {
  employees: ActiveEmployeeOption[]
  jobs: RosterAssignableJob[]
  shifts: RosterShift[]
  timezone: string
}

export type OfflinePeopleData = {
  employees: EmployeeSummary[]
  jobSummaries: Record<number, EmployeeJobSummary>
  shiftSummaries: Record<number, EmployeeShiftSummary>
}

export type OfflineTemplateData = {
  employees: TemplateEmployee[]
  schedules: JobSchedule[]
  templates: JobTemplate[]
  timezone: string
}

export type OfflineV2Snapshot = {
  dashboard: {
    employee: EmployeeDashboardData | null
    operations: OwnerDashboardData | null
  }
  employeeJobs: JobCard[]
  jobs: OfflineJobBoardData | null
  jobDetails: Record<number, JobDetail>
  leaseExpiresAt: string
  membership: OfflineMembership
  people: OfflinePeopleData | null
  profile: EmployeeSummary
  refreshedAt: string
  revision: number
  roster: OfflineRosterData
  schemaVersion: typeof OFFLINE_V2_SCHEMA_VERSION
  templates: OfflineTemplateData | null
}

export type OfflineEntityType =
  | "job"
  | "roster_shift"
  | "membership"
  | "employee_profile"
  | "job_template"
  | "job_schedule"
  | "profile"
  | "notification"

export type OfflineOperationKind =
  | "job.create"
  | "job.update"
  | "job.reassign"
  | "job.start"
  | "job.note"
  | "job.comment"
  | "job.evidence.add"
  | "job.evidence.remove"
  | "job.submit"
  | "job.reopen"
  | "job.archive"
  | "job.delete"
  | "job.notification.retry"
  | "roster.create"
  | "roster.update"
  | "roster.lock"
  | "roster.archive"
  | "membership.create"
  | "membership.update"
  | "membership.access"
  | "membership.role"
  | "membership.delete_invited"
  | "membership.invitation.resend"
  | "template.create"
  | "template.update"
  | "template.active"
  | "schedule.create"
  | "schedule.update"
  | "schedule.enabled"
  | "schedule.delete"
  | "schedule.retry"
  | "profile.update"

export type OfflineEntityReference =
  { id: number; source: "server" } | { id: string; source: "local" }

export type OfflineV2OperationState =
  "pending" | "syncing" | "failed" | "needs_attention"

export type OfflineV2Operation = {
  clientOperationId: string
  createdAt: string
  dependsOn: string[]
  entity: OfflineEntityReference
  entityType: OfflineEntityType
  expectedVersion: number | null
  kind: OfflineOperationKind
  lastError?: string
  payload: Record<string, unknown>
  state: OfflineV2OperationState
}

export type OfflineConflict = {
  clientOperationId: string
  createdAt: string
  entity: OfflineEntityReference
  entityType: OfflineEntityType
  local: Record<string, unknown>
  reason: string
  remote: Record<string, unknown>
}

export type OfflineSyncChange = {
  changedAt: string
  entityId: number
  entityType: string
  operation: "upsert" | "delete"
  relatedJobId: number | null
  revision: number
}

export type OfflineSyncResult = {
  changes: OfflineSyncChange[]
  conflicts: OfflineConflict[]
  fullSnapshot?: OfflineV2Snapshot
  idMappings: Record<string, number>
  leaseExpiresAt: string
  operationResults: Array<{
    clientOperationId: string
    error?: string
    result?: Record<string, unknown>
    status: "acknowledged" | "conflict" | "needs_attention" | "failed"
  }>
  patch?: OfflineV2Patch
  revision: number
}

export type OfflineRepositoryState =
  "preparing" | "ready" | "locked" | "unavailable"

export type OfflineRepositorySyncState =
  "idle" | "syncing" | "pending" | "needs_attention" | "storage_warning"

export type OfflineV2Patch = {
  baseRevision: number
  dashboard?: OfflineV2Snapshot["dashboard"]
  employeeJobs?: OfflineV2Snapshot["employeeJobs"]
  jobDetails?: OfflineJobDetailPatch
  jobs?: OfflineV2Snapshot["jobs"]
  leaseExpiresAt: string
  membership?: OfflineV2Snapshot["membership"]
  people?: OfflineV2Snapshot["people"]
  profile?: OfflineV2Snapshot["profile"]
  refreshedAt: string
  revision: number
  roster?: OfflineV2Snapshot["roster"]
  templates?: OfflineV2Snapshot["templates"]
}

export type OfflineJobDetailPatch = {
  remove: number[]
  reset?: boolean
  upsert: Record<number, JobDetail>
}

export type OfflineSyncStatus =
  | "preparing"
  | "offline_ready"
  | "offline"
  | "changes_pending"
  | "syncing"
  | "needs_attention"
  | "storage_warning"
  | "lease_expired"
  | "cold"

export function isOfflineLeaseValid(leaseExpiresAt: string, now = Date.now()) {
  const expiry = Date.parse(leaseExpiresAt)
  return Number.isFinite(expiry) && expiry > now
}
