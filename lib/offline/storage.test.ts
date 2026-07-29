import "fake-indexeddb/auto"

import { dehydrate, QueryClient } from "@tanstack/react-query"
import { afterEach, describe, expect, it } from "vitest"

import {
  getOfflineIdentity,
  getOperations,
  getPersistedWorkPack,
  hasOfflineConsent,
  persistQueryClient,
  purgeOfflineData,
  putOperation,
  restoreQueryClient,
  setOfflineConsent,
} from "@/lib/offline/storage"
import type { OfflineOperation, OfflineWorkPack } from "@/lib/offline/types"

const identity = {
  membershipId: 1103,
  organisationId: 1001,
  role: "employee" as const,
}

function workPack(refreshedAt = new Date().toISOString()): OfflineWorkPack {
  return {
    identity,
    jobs: [],
    refreshedAt,
    schemaVersion: 1,
    timezone: "Australia/Melbourne",
  }
}

function persistedClient(pack: OfflineWorkPack) {
  const queryClient = new QueryClient()
  const key = ["assigned-work", 1001, 1103] as const
  queryClient.setQueryDefaults(key, { meta: { offlineWorkPack: true } })
  queryClient.setQueryData(key, pack)
  return {
    buster: "assigned-work-v1",
    clientState: dehydrate(queryClient),
    timestamp: Date.now(),
  }
}

afterEach(async () => {
  await purgeOfflineData()
})

describe("offline IndexedDB storage", () => {
  it("does not persist assigned work before explicit consent", async () => {
    await persistQueryClient(persistedClient(workPack()))
    expect(await restoreQueryClient()).toBeUndefined()
    expect(await hasOfflineConsent()).toBe(false)
  })

  it("restores a consented membership-scoped work pack", async () => {
    await setOfflineConsent(true)
    await persistQueryClient(persistedClient(workPack()))
    expect(await getPersistedWorkPack()).toEqual(workPack(expect.any(String)))
  })

  it("rejects a work pack older than the 24-hour online refresh limit", async () => {
    await setOfflineConsent(true)
    await persistQueryClient(
      persistedClient(workPack(new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString()))
    )
    expect(await getPersistedWorkPack()).toBeNull()
  })

  it("orders outbox operations by creation time and purges all identity data", async () => {
    const later: OfflineOperation = {
      clientOperationId: "20000000-0000-4000-8000-000000000002",
      createdAt: "2026-07-29T02:00:00.000Z",
      dependsOn: [],
      expectedVersion: 2,
      jobId: 1,
      kind: "submit",
      payload: {},
      state: "pending",
    }
    const earlier: OfflineOperation = {
      ...later,
      clientOperationId: "20000000-0000-4000-8000-000000000001",
      createdAt: "2026-07-29T01:00:00.000Z",
      kind: "start",
    }
    await putOperation(later)
    await putOperation(earlier)
    expect((await getOperations()).map((operation) => operation.kind)).toEqual([
      "start",
      "submit",
    ])
    await purgeOfflineData()
    expect(await getOperations()).toEqual([])
    expect(await getOfflineIdentity()).toBeNull()
  })
})
