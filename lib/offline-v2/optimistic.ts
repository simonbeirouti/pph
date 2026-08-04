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

export function submitJobEverywhere(
  snapshot: OfflineV2Snapshot,
  jobId: number,
  submittedAt: string
) {
  const updated = updateJobEverywhere(snapshot, jobId, (job) => ({
    ...job,
    status: "in_review",
    submittedAt,
  }))
  const employeeDashboard = updated.dashboard.employee
  if (!employeeDashboard) return updated

  const actionableJobs = employeeDashboard.jobs.filter(
    (job) => job.status === "assigned" || job.status === "in_progress"
  )
  return {
    ...updated,
    dashboard: {
      ...updated.dashboard,
      employee: {
        ...employeeDashboard,
        jobs: actionableJobs,
        nextActionable: actionableJobs[0] ?? null,
      },
    },
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
  const preserveJobs = entityTypes.has("job") || entityTypes.has("notification")
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

  const pendingJobIds = new Set<number>()
  for (const operation of operations) {
    if (
      operation.entityType !== "job" &&
      operation.entityType !== "notification"
    ) {
      continue
    }
    if (operation.entity.source === "server") {
      pendingJobIds.add(operation.entity.id)
      continue
    }
    const temporaryId = operation.payload.temporaryId
    if (typeof temporaryId === "number") pendingJobIds.add(temporaryId)
  }

  const preservePendingJobs = <T extends { id: number }>(
    fresh: T[],
    optimistic: T[]
  ) => {
    if (!pendingJobIds.size) return fresh
    const optimisticById = new Map(
      optimistic
        .filter((job) => pendingJobIds.has(job.id))
        .map((job) => [job.id, job])
    )
    const merged = fresh.map((job) => optimisticById.get(job.id) ?? job)
    const freshIds = new Set(fresh.map((job) => job.id))
    for (const job of optimisticById.values()) {
      if (!freshIds.has(job.id)) merged.push(job)
    }
    return merged
  }

  const dashboard = preserveJobs
    ? {
        employee:
          incoming.dashboard.employee && local.dashboard.employee
            ? {
                ...incoming.dashboard.employee,
                jobs: preservePendingJobs(
                  incoming.dashboard.employee.jobs,
                  local.dashboard.employee.jobs
                ),
                nextActionable:
                  local.dashboard.employee.nextActionable &&
                  pendingJobIds.has(local.dashboard.employee.nextActionable.id)
                    ? local.dashboard.employee.nextActionable
                    : incoming.dashboard.employee.nextActionable,
              }
            : incoming.dashboard.employee,
        operations:
          incoming.dashboard.operations && local.dashboard.operations
            ? {
                ...incoming.dashboard.operations,
                recentlySubmitted: preservePendingJobs(
                  incoming.dashboard.operations.recentlySubmitted,
                  local.dashboard.operations.recentlySubmitted
                ),
                urgent: preservePendingJobs(
                  incoming.dashboard.operations.urgent,
                  local.dashboard.operations.urgent
                ),
              }
            : incoming.dashboard.operations,
      }
    : incoming.dashboard

  return {
    ...incoming,
    ...(preserveJobs
      ? {
          dashboard,
          employeeJobs: preservePendingJobs(
            incoming.employeeJobs,
            local.employeeJobs
          ),
          jobDetails: Object.fromEntries(
            Object.entries(incoming.jobDetails).map(([id, detail]) => [
              id,
              pendingJobIds.has(Number(id))
                ? (local.jobDetails[Number(id)] ?? detail)
                : detail,
            ])
          ),
          jobs:
            incoming.jobs && local.jobs
              ? {
                  ...incoming.jobs,
                  jobs: preservePendingJobs(
                    incoming.jobs.jobs,
                    local.jobs.jobs
                  ),
                }
              : incoming.jobs,
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
