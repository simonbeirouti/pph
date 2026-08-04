import { describe, expect, it } from "vitest"

import { reconcileOfflineOperations } from "@/lib/offline-v2/reconcile"
import type {
  OfflineSyncResult,
  OfflineV2Operation,
} from "@/lib/offline-v2/types"

function operation(
  clientOperationId: string,
  {
    dependsOn = [],
    expectedVersion = 3,
    jobId = 1401,
    kind = "job.submit",
  }: {
    dependsOn?: string[]
    expectedVersion?: number
    jobId?: number
    kind?: OfflineV2Operation["kind"]
  } = {}
): OfflineV2Operation {
  return {
    clientOperationId,
    createdAt: "2026-08-05T00:00:00.000Z",
    dependsOn,
    entity: { id: jobId, source: "server" },
    entityType: "job",
    expectedVersion,
    kind,
    payload: {},
    state: "pending",
  }
}

function acknowledged(
  clientOperationId: string,
  version: number
): OfflineSyncResult["operationResults"][number] {
  return {
    clientOperationId,
    result: { version },
    status: "acknowledged",
  }
}

describe("reconcileOfflineOperations", () => {
  it("rebases a dependent submit queued while start was synchronising", () => {
    const start = operation("start", { kind: "job.start" })
    const submit = operation("submit", { dependsOn: [start.clientOperationId] })

    const reconciled = reconcileOfflineOperations({
      operationResults: [acknowledged(start.clientOperationId, 7)],
      replayedOperations: [start],
      storedOperations: [start, submit],
    })

    expect(reconciled).toEqual([
      expect.objectContaining({
        clientOperationId: submit.clientOperationId,
        expectedVersion: 7,
        state: "pending",
      }),
    ])
  })

  it("does not rebase a dependent operation for another job", () => {
    const start = operation("start", { jobId: 1401, kind: "job.start" })
    const submit = operation("submit", {
      dependsOn: [start.clientOperationId],
      expectedVersion: 4,
      jobId: 1402,
    })

    const [retained] = reconcileOfflineOperations({
      operationResults: [acknowledged(start.clientOperationId, 7)],
      replayedOperations: [start],
      storedOperations: [start, submit],
    })

    expect(retained.expectedVersion).toBe(4)
  })

  it("does not rebase an independently stale submit", () => {
    const start = operation("start", { kind: "job.start" })
    const submit = operation("submit", { expectedVersion: 4 })

    const [retained] = reconcileOfflineOperations({
      operationResults: [acknowledged(start.clientOperationId, 7)],
      replayedOperations: [start],
      storedOperations: [start, submit],
    })

    expect(retained.expectedVersion).toBe(4)
  })

  it("retains genuine conflicts as needs attention", () => {
    const submit = operation("submit", { expectedVersion: 4 })

    const [retained] = reconcileOfflineOperations({
      operationResults: [
        {
          clientOperationId: submit.clientOperationId,
          error: "version_conflict",
          status: "conflict",
        },
      ],
      replayedOperations: [submit],
      storedOperations: [submit],
    })

    expect(retained).toMatchObject({
      expectedVersion: 4,
      lastError: "version_conflict",
      state: "needs_attention",
    })
  })
})
