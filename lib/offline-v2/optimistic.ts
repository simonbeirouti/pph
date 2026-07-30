import type {
  OfflineV2Operation,
  OfflineV2Snapshot,
} from "@/lib/offline-v2/types"
import type { JobCard, JobDetail } from "@/lib/jobs/types"

export type OfflineJobEntity = JobCard &
  Partial<JobDetail> & {
    pendingEvidenceCount?: number
  }

export function updateJobEverywhere(
  snapshot: OfflineV2Snapshot,
  jobId: number,
  update: (job: OfflineJobEntity) => OfflineJobEntity
) {
  const updateList = <T extends { id: number }>(items: T[]) =>
    items.map((item) =>
      item.id === jobId
        ? (update(item as unknown as OfflineJobEntity) as unknown as T)
        : item
    )
  const detail = snapshot.jobDetails[jobId]
  return {
    ...snapshot,
    dashboard: {
      employee: snapshot.dashboard.employee
        ? {
            ...snapshot.dashboard.employee,
            jobs: updateList(snapshot.dashboard.employee.jobs),
            nextActionable:
              snapshot.dashboard.employee.nextActionable?.id === jobId
                ? (update(
                    snapshot.dashboard.employee.nextActionable
                  ) as typeof snapshot.dashboard.employee.nextActionable)
                : snapshot.dashboard.employee.nextActionable,
          }
        : null,
      operations: snapshot.dashboard.operations
        ? {
            ...snapshot.dashboard.operations,
            recentlySubmitted: updateList(
              snapshot.dashboard.operations.recentlySubmitted
            ),
            urgent: updateList(snapshot.dashboard.operations.urgent),
          }
        : null,
    },
    employeeJobs: updateList(snapshot.employeeJobs),
    jobs: snapshot.jobs
      ? { ...snapshot.jobs, jobs: updateList(snapshot.jobs.jobs) }
      : null,
    jobDetails: detail
      ? {
          ...snapshot.jobDetails,
          [jobId]: update(detail) as JobDetail,
        }
      : snapshot.jobDetails,
  }
}

export function preservePendingOptimisticDomains(
  incoming: OfflineV2Snapshot,
  local: OfflineV2Snapshot,
  operations: OfflineV2Operation[]
) {
  const entityTypes = new Set(
    operations.map((operation) => operation.entityType)
  )
  const preserveJobs =
    entityTypes.has("job") || entityTypes.has("notification")
  const preservePeople =
    preserveJobs ||
    entityTypes.has("membership") ||
    entityTypes.has("employee_profile")
  const preserveRoster =
    entityTypes.has("roster_shift") ||
    entityTypes.has("membership") ||
    entityTypes.has("employee_profile")
  const preserveTemplates =
    entityTypes.has("job_template") || entityTypes.has("job_schedule")
  const preserveProfile = entityTypes.has("profile")

  return {
    ...incoming,
    ...(preserveJobs
      ? {
          dashboard: local.dashboard,
          employeeJobs: local.employeeJobs,
          jobDetails: local.jobDetails,
          jobs: local.jobs,
        }
      : {}),
    ...(preservePeople ? { people: local.people } : {}),
    ...(preserveRoster ? { roster: local.roster } : {}),
    ...(preserveTemplates ? { templates: local.templates } : {}),
    ...(preserveProfile
      ? {
          membership: {
            ...incoming.membership,
            displayName: local.membership.displayName,
          },
          profile: local.profile,
        }
      : {}),
  }
}
