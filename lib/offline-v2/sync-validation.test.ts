import { describe, expect, it } from "vitest"

import { parseOfflineSyncRequest } from "@/lib/offline-v2/sync-validation"

const validOperation = {
  clientOperationId: "40000000-0000-4000-8000-000000000001",
  createdAt: "2026-08-05T00:00:00.000Z",
  dependsOn: [],
  entity: { id: 1401, source: "server" },
  entityType: "job",
  expectedVersion: 1,
  kind: "job.delete",
  payload: {},
  state: "pending",
}

describe("parseOfflineSyncRequest", () => {
  it("accepts a valid delete operation", () => {
    const result = parseOfflineSyncRequest({
      operations: [validOperation],
      revision: 1,
      schemaVersion: 2,
    })

    expect(result?.operations).toEqual([validOperation])
    expect(result?.invalidOperations).toEqual([])
  })

  it("isolates a malformed operation without rejecting valid work", () => {
    const malformed = {
      ...validOperation,
      clientOperationId: "40000000-0000-4000-8000-000000000002",
      entity: { id: -1402, source: "server" },
    }
    const result = parseOfflineSyncRequest({
      operations: [malformed, validOperation],
      revision: 1,
      schemaVersion: 2,
    })

    expect(result?.operations).toEqual([validOperation])
    expect(result?.invalidOperations).toEqual([
      expect.objectContaining({
        clientOperationId: malformed.clientOperationId,
      }),
    ])
  })
})
