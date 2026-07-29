import type { OfflineV2Snapshot } from "@/lib/offline-v2/types"
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
