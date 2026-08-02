import { describe, expect, it } from "vitest"

import { preservePendingOptimisticDomains } from "@/lib/offline-v2/optimistic"
import { applyOfflineV2Patch } from "@/lib/offline-v2/patch"
import {
  OFFLINE_V2_SCHEMA_VERSION,
  type OfflineV2Snapshot,
} from "@/lib/offline-v2/types"

const snapshot = {
  dashboard: { employee: null, operations: null },
  employeeJobs: [],
  jobDetails: {},
  jobs: null,
  leaseExpiresAt: "2026-08-05T00:00:00.000Z",
  membership: {
    avatarPath: null,
    displayName: "Alex Employee",
    email: "employee@example.test",
    membershipId: 1103,
    organisationId: 1001,
    organisationName: "Test Organisation",
    organisationTimezone: "Australia/Melbourne",
    role: "employee",
    timezone: "Australia/Melbourne",
  },
  people: null,
  profile: {} as OfflineV2Snapshot["profile"],
  refreshedAt: "2026-07-29T00:00:00.000Z",
  revision: 1,
  roster: {
    employees: [],
    jobs: [],
    shifts: [],
    timezone: "Australia/Melbourne",
  },
  schemaVersion: OFFLINE_V2_SCHEMA_VERSION,
  templates: null,
} satisfies OfflineV2Snapshot

describe("offline v2 patches", () => {
  it("updates only supplied domains and freshness metadata", () => {
    const next = applyOfflineV2Patch(snapshot, {
      baseRevision: 1,
      employeeJobs: [],
      leaseExpiresAt: "2026-08-06T00:00:00.000Z",
      refreshedAt: "2026-07-30T00:00:00.000Z",
      revision: 2,
    })

    expect(next.revision).toBe(2)
    expect(next.roster).toBe(snapshot.roster)
    expect(next.leaseExpiresAt).toBe("2026-08-06T00:00:00.000Z")
  })

  it("rejects a patch based on a different local revision", () => {
    expect(() =>
      applyOfflineV2Patch(snapshot, {
        baseRevision: 2,
        leaseExpiresAt: snapshot.leaseExpiresAt,
        refreshedAt: snapshot.refreshedAt,
        revision: 3,
      })
    ).toThrow("revision")
  })

  it("merges one changed job detail without discarding unrelated details", () => {
    const first = { id: 1401 } as OfflineV2Snapshot["jobDetails"][number]
    const second = { id: 1402 } as OfflineV2Snapshot["jobDetails"][number]
    const next = applyOfflineV2Patch(
      { ...snapshot, jobDetails: { 1401: first, 1402: second } },
      {
        baseRevision: 1,
        jobDetails: {
          remove: [1402],
          upsert: { 1401: { ...first, title: "Fresh job" } },
        },
        leaseExpiresAt: "2026-08-06T00:00:00.000Z",
        refreshedAt: "2026-07-30T00:00:00.000Z",
        revision: 2,
      }
    )

    expect(next.jobDetails).toEqual({
      1401: expect.objectContaining({ title: "Fresh job" }),
    })
  })

  it("replaces all job details for a legacy full refresh", () => {
    const next = applyOfflineV2Patch(
      { ...snapshot, jobDetails: { 1401: { id: 1401 } as never } },
      {
        baseRevision: 1,
        jobDetails: { remove: [], reset: true, upsert: {} },
        leaseExpiresAt: "2026-08-06T00:00:00.000Z",
        refreshedAt: "2026-07-30T00:00:00.000Z",
        revision: 2,
      }
    )

    expect(next.jobDetails).toEqual({})
  })

  it("preserves pending projections without retaining stale access state", () => {
    const local = {
      ...snapshot,
      membership: {
        ...snapshot.membership,
        displayName: "Local Name",
      },
      profile: {
        ...snapshot.profile,
        displayName: "Local Name",
      },
      roster: {
        ...snapshot.roster,
        shifts: [{ id: 99 }] as OfflineV2Snapshot["roster"]["shifts"],
      },
    }
    const incoming = {
      ...snapshot,
      membership: {
        ...snapshot.membership,
        displayName: "Server Name",
        role: "manager" as const,
      },
      revision: 2,
    }
    const next = preservePendingOptimisticDomains(incoming, local, [
      {
        clientOperationId: "profile-1",
        createdAt: snapshot.refreshedAt,
        dependsOn: [],
        entity: { id: snapshot.membership.membershipId, source: "server" },
        entityType: "profile",
        expectedVersion: null,
        kind: "profile.update",
        payload: {},
        state: "needs_attention",
      },
      {
        clientOperationId: "shift-1",
        createdAt: snapshot.refreshedAt,
        dependsOn: [],
        entity: { id: 99, source: "server" },
        entityType: "roster_shift",
        expectedVersion: null,
        kind: "roster.update",
        payload: {},
        state: "pending",
      },
    ])

    expect(next.roster).toBe(local.roster)
    expect(next.profile).toBe(local.profile)
    expect(next.membership.role).toBe("manager")
    expect(next.membership.displayName).toBe("Local Name")
  })
})
