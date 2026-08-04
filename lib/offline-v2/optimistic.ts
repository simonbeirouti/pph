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

export function removeJobEverywhere(
  snapshot: OfflineV2Snapshot,
  jobId: number
): OfflineV2Snapshot {
  const withoutJob = <T extends { id: number }>(items: T[]) =>
    items.filter((item) => item.id !== jobId)
  const jobDetails = { ...snapshot.jobDetails }
  delete jobDetails[jobId]

  return {
    ...snapshot,
    dashboard: {
      employee: snapshot.dashboard.employee
        ? {
            ...snapshot.dashboard.employee,
            jobs: withoutJob(snapshot.dashboard.employee.jobs),
            nextActionable:
              snapshot.dashboard.employee.nextActionable?.id === jobId
                ? null
                : snapshot.dashboard.employee.nextActionable,
          }
        : null,
      operations: snapshot.dashboard.operations
        ? {
            ...snapshot.dashboard.operations,
            recentlySubmitted: withoutJob(
              snapshot.dashboard.operations.recentlySubmitted
            ),
            urgent: withoutJob(snapshot.dashboard.operations.urgent),
          }
        : null,
    },
    employeeJobs: withoutJob(snapshot.employeeJobs),
    jobDetails,
    jobs: snapshot.jobs
      ? { ...snapshot.jobs, jobs: withoutJob(snapshot.jobs.jobs) }
      : null,
    roster: {
      ...snapshot.roster,
      jobs: withoutJob(snapshot.roster.jobs),
    },
  }
}

export function restoreAuthoritativeSubmitConflicts(
  optimistic: OfflineV2Snapshot,
  authoritative: OfflineV2Snapshot,
  operations: readonly OfflineV2Operation[]
) {
  const conflictedJobIds = new Set(
    operations.flatMap((operation) =>
      operation.kind === "job.submit" &&
      operation.state === "needs_attention" &&
      operation.entity.source === "server"
        ? [operation.entity.id]
        : []
    )
  )
  if (!conflictedJobIds.size) return optimistic

  const restoreList = <T extends { id: number }>(local: T[], remote: T[]) => {
    const localById = new Map(local.map((item) => [item.id, item]))
    const restored = remote.map((item) =>
      conflictedJobIds.has(item.id) ? item : (localById.get(item.id) ?? item)
    )
    const remoteIds = new Set(remote.map((item) => item.id))
    for (const item of local) {
      if (!remoteIds.has(item.id) && !conflictedJobIds.has(item.id)) {
        restored.push(item)
      }
    }
    return restored
  }

  const employeeDashboard =
    optimistic.dashboard.employee && authoritative.dashboard.employee
      ? {
          ...optimistic.dashboard.employee,
          jobs: restoreList(
            optimistic.dashboard.employee.jobs,
            authoritative.dashboard.employee.jobs
          ),
          nextActionable:
            (optimistic.dashboard.employee.nextActionable &&
              conflictedJobIds.has(
                optimistic.dashboard.employee.nextActionable.id
              )) ||
            (authoritative.dashboard.employee.nextActionable &&
              conflictedJobIds.has(
                authoritative.dashboard.employee.nextActionable.id
              ))
              ? authoritative.dashboard.employee.nextActionable
              : optimistic.dashboard.employee.nextActionable,
        }
      : authoritative.dashboard.employee
  const operationsDashboard =
    optimistic.dashboard.operations && authoritative.dashboard.operations
      ? {
          ...optimistic.dashboard.operations,
          recentlySubmitted: restoreList(
            optimistic.dashboard.operations.recentlySubmitted,
            authoritative.dashboard.operations.recentlySubmitted
          ),
          urgent: restoreList(
            optimistic.dashboard.operations.urgent,
            authoritative.dashboard.operations.urgent
          ),
        }
      : authoritative.dashboard.operations
  const jobDetails = { ...optimistic.jobDetails }
  for (const jobId of conflictedJobIds) {
    const remote = authoritative.jobDetails[jobId]
    if (remote) jobDetails[jobId] = remote
    else delete jobDetails[jobId]
  }

  return {
    ...optimistic,
    dashboard: {
      employee: employeeDashboard,
      operations: operationsDashboard,
    },
    employeeJobs: restoreList(
      optimistic.employeeJobs,
      authoritative.employeeJobs
    ),
    jobDetails,
    jobs:
      optimistic.jobs && authoritative.jobs
        ? {
            ...optimistic.jobs,
            jobs: restoreList(optimistic.jobs.jobs, authoritative.jobs.jobs),
          }
        : authoritative.jobs,
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
  const pendingDeletedJobIds = new Set<number>()
  for (const operation of operations) {
    if (
      operation.entityType !== "job" &&
      operation.entityType !== "notification"
    ) {
      continue
    }
    if (operation.entity.source === "server") {
      pendingJobIds.add(operation.entity.id)
      if (operation.kind === "job.delete") {
        pendingDeletedJobIds.add(operation.entity.id)
      }
      continue
    }
    const temporaryId = operation.payload.temporaryId
    if (typeof temporaryId === "number") pendingJobIds.add(temporaryId)
  }

  const preservePendingJobs = <T extends { id: number }>(
    fresh: T[],
    optimistic: T[]
  ) => {
    const visibleFresh = fresh.filter(
      (job) => !pendingDeletedJobIds.has(job.id)
    )
    if (!pendingJobIds.size) return visibleFresh
    const optimisticById = new Map(
      optimistic
        .filter(
          (job) =>
            pendingJobIds.has(job.id) && !pendingDeletedJobIds.has(job.id)
        )
        .map((job) => [job.id, job])
    )
    const merged = visibleFresh.map((job) => optimisticById.get(job.id) ?? job)
    const freshIds = new Set(visibleFresh.map((job) => job.id))
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
            Object.entries(incoming.jobDetails).flatMap(([id, detail]) =>
              pendingDeletedJobIds.has(Number(id))
                ? []
                : [
                    [
                      id,
                      pendingJobIds.has(Number(id))
                        ? (local.jobDetails[Number(id)] ?? detail)
                        : detail,
                    ],
                  ]
            )
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
    ...(preserveJobs
      ? {
          roster: {
            ...incoming.roster,
            jobs: preservePendingJobs(incoming.roster.jobs, local.roster.jobs),
          },
        }
      : preserveRoster
        ? { roster: local.roster }
        : {}),
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
