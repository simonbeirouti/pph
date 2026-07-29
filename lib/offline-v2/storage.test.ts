import "fake-indexeddb/auto"

import { afterEach, describe, expect, it } from "vitest"

import {
  getOfflineV2Identity,
  getOfflineV2Operations,
  getOfflineV2Snapshot,
  isOfflineLogoutPending,
  persistOfflineV2Snapshot,
  purgeOfflineV2Data,
  putOfflineV2Operation,
  setOfflineLogoutPending,
} from "@/lib/offline-v2/storage"
import {
  isOfflineLeaseValid,
  OFFLINE_V2_SCHEMA_VERSION,
  type OfflineV2Snapshot,
} from "@/lib/offline-v2/types"

function snapshot(
  membershipId = 1103,
  organisationId = 1001
): OfflineV2Snapshot {
  const refreshedAt = "2026-07-29T00:00:00.000Z"
  return {
    dashboard: { employee: null, operations: null },
    employeeJobs: [],
    jobDetails: {},
    jobs: null,
    leaseExpiresAt: "2026-08-05T00:00:00.000Z",
    membership: {
      avatarPath: null,
      displayName: "Alex Employee",
      email: "employee@example.test",
      membershipId,
      organisationId,
      organisationName: "Test Organisation",
      organisationTimezone: "Australia/Melbourne",
      role: "employee",
      timezone: "Australia/Melbourne",
    },
    people: null,
    profile: {
      avatarPath: null,
      avatarUrl: null,
      displayName: "Alex Employee",
      email: "employee@example.test",
      firstName: "Alex",
      inviteDeliveryStatus: "sent",
      inviteLastAttemptedAt: null,
      jobTitle: "Operator",
      lastName: "Employee",
      membershipId,
      phone: "0400 000 002",
      profileId: 1202,
      role: "employee",
      status: "active",
      userId: "00000000-0000-4000-8000-000000000002",
    },
    refreshedAt,
    revision: 1,
    roster: {
      employees: [],
      jobs: [],
      shifts: [],
      timezone: "Australia/Melbourne",
    },
    schemaVersion: OFFLINE_V2_SCHEMA_VERSION,
    templates: null,
  }
}

afterEach(async () => {
  await purgeOfflineV2Data()
})

describe("offline v2 IndexedDB", () => {
  it("persists a membership-scoped snapshot and replaces another identity", async () => {
    await persistOfflineV2Snapshot(snapshot())
    expect(await getOfflineV2Identity()).toEqual({
      membershipId: 1103,
      organisationId: 1001,
    })

    await putOfflineV2Operation({
      clientOperationId: "40000000-0000-4000-8000-000000000001",
      createdAt: "2026-07-29T01:00:00.000Z",
      dependsOn: [],
      entity: { id: 1, source: "server" },
      entityType: "job",
      expectedVersion: 1,
      kind: "job.start",
      payload: {},
      state: "pending",
    })
    await persistOfflineV2Snapshot(snapshot(2103, 2001))

    expect((await getOfflineV2Snapshot())?.membership.membershipId).toBe(2103)
    expect(await getOfflineV2Operations()).toEqual([])
  })

  it("keeps the non-sensitive remote logout marker while purging data", async () => {
    await persistOfflineV2Snapshot(snapshot())
    await setOfflineLogoutPending(true)
    await purgeOfflineV2Data({ preserveLogoutMarker: true })

    expect(await getOfflineV2Snapshot()).toBeNull()
    expect(await getOfflineV2Identity()).toBeNull()
    expect(await isOfflineLogoutPending()).toBe(true)
  })

  it("enforces the exact seven-day lease timestamp", () => {
    const expiry = "2026-08-05T00:00:00.000Z"
    expect(
      isOfflineLeaseValid(expiry, Date.parse("2026-08-04T23:59:59.999Z"))
    ).toBe(true)
    expect(isOfflineLeaseValid(expiry, Date.parse(expiry))).toBe(false)
    expect(isOfflineLeaseValid("invalid", Date.now())).toBe(false)
  })
})
