"use client"

import { useCallback } from "react"

import { useOptionalOfflineV2 } from "@/components/offline-v2-provider"
import { putOfflineV2Blob } from "@/lib/offline-v2/storage"
import type {
  OfflineEntityType,
  OfflineOperationKind,
  OfflineV2Snapshot,
} from "@/lib/offline-v2/types"
import type { JobCard, JobDetail } from "@/lib/jobs/types"

type OfflineJobEntity = JobCard &
  Partial<JobDetail> & {
    pendingEvidenceCount?: number
  }

type QueueInput = {
  blob?: Blob
  entityId: number | string
  entityType: OfflineEntityType
  expectedVersion?: number | null
  kind: OfflineOperationKind
  optimistic?: (snapshot: OfflineV2Snapshot) => OfflineV2Snapshot
  payload?: Record<string, unknown>
}

export function useOfflineV2Actions() {
  const offline = useOptionalOfflineV2()

  const queue = useCallback(
    async (input: QueueInput) => {
      if (!offline || offline.isOnline) return false
      const clientOperationId = crypto.randomUUID()
      if (input.blob) {
        await putOfflineV2Blob(clientOperationId, input.blob)
      }
      const dependency = offline.operations
        .filter(
          (operation) =>
            operation.entityType === input.entityType &&
            operation.entity.id === input.entityId
        )
        .at(-1)
      await offline.queueOperation({
        clientOperationId,
        createdAt: new Date().toISOString(),
        dependsOn: dependency ? [dependency.clientOperationId] : [],
        entity:
          typeof input.entityId === "number"
            ? { id: input.entityId, source: "server" }
            : { id: input.entityId, source: "local" },
        entityType: input.entityType,
        expectedVersion: input.expectedVersion ?? null,
        kind: input.kind,
        payload: input.payload ?? {},
        state: "pending",
      })
      if (input.optimistic) {
        await offline.updateSnapshot(input.optimistic)
      }
      return true
    },
    [offline]
  )

  return {
    isOffline: Boolean(offline && !offline.isOnline),
    navigate: offline?.navigate,
    queue,
  }
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
