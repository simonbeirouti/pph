import { describe, expect, it } from "vitest"

import {
  removeJobEverywhere,
  restoreAuthoritativeSubmitConflicts,
  submitJobEverywhere,
} from "@/lib/offline-v2/optimistic"
import type {
  OfflineV2Operation,
  OfflineV2Snapshot,
} from "@/lib/offline-v2/types"
import type { JobCard } from "@/lib/jobs/types"

function job(id: number, status: JobCard["status"]): JobCard {
  return {
    assigneeMembershipId: 1103,
    description: "",
    dueAt: null,
    id,
    location: "",
    minimumCompletionPhotos: 0,
    priority: "normal",
    requiresCompletionNote: false,
    scheduledAt: null,
    status,
    title: `Job ${id}`,
    updatedAt: "2026-08-04T00:00:00.000Z",
  }
}

describe("submitJobEverywhere", () => {
  it("removes submitted work from employee home and promotes the next job", () => {
    const submitted = job(1, "in_progress")
    const next = job(2, "assigned")
    const snapshot = {
      dashboard: {
        employee: {
          jobs: [submitted, next],
          nextActionable: submitted,
          shifts: { current: null, upcoming: [] },
        },
        operations: null,
      },
      employeeJobs: [submitted, next],
      jobDetails: {},
      jobs: null,
    } as unknown as OfflineV2Snapshot

    const updated = submitJobEverywhere(
      snapshot,
      submitted.id,
      "2026-08-04T01:00:00.000Z"
    )

    expect(updated.dashboard.employee?.jobs).toEqual([next])
    expect(updated.dashboard.employee?.nextActionable).toEqual(next)
    expect(updated.employeeJobs[0]).toMatchObject({
      id: submitted.id,
      status: "in_review",
      submittedAt: "2026-08-04T01:00:00.000Z",
    })
  })

  it("restores authoritative status for a conflicted optimistic submit", () => {
    const serverJob = job(1, "in_progress")
    const optimisticJob = {
      ...serverJob,
      status: "in_review" as const,
      updatedAt: "2026-08-05T00:01:00.000Z",
    }
    const base = {
      dashboard: {
        employee: {
          jobs: [serverJob],
          nextActionable: serverJob,
          shifts: { current: null, upcoming: [] },
        },
        operations: null,
      },
      employeeJobs: [serverJob],
      jobDetails: {},
      jobs: null,
    } as unknown as OfflineV2Snapshot
    const optimistic = {
      ...base,
      dashboard: {
        employee: {
          ...base.dashboard.employee!,
          jobs: [],
          nextActionable: null,
        },
        operations: null,
      },
      employeeJobs: [optimisticJob],
    }
    const conflictedSubmit: OfflineV2Operation = {
      clientOperationId: "submit-1",
      createdAt: "2026-08-05T00:01:00.000Z",
      dependsOn: [],
      entity: { id: serverJob.id, source: "server" },
      entityType: "job",
      expectedVersion: 3,
      kind: "job.submit",
      lastError: "version_conflict",
      payload: {},
      state: "needs_attention",
    }

    const restored = restoreAuthoritativeSubmitConflicts(optimistic, base, [
      conflictedSubmit,
    ])

    expect(restored.employeeJobs[0]).toEqual(serverJob)
    expect(restored.dashboard.employee?.jobs).toEqual([serverJob])
    expect(restored.dashboard.employee?.nextActionable).toEqual(serverJob)
  })
})

describe("removeJobEverywhere", () => {
  it("removes a deleted job from every cached projection", () => {
    const removed = job(1, "assigned")
    const retained = job(2, "assigned")
    const base = {
      dashboard: {
        employee: {
          jobs: [removed, retained],
          nextActionable: removed,
          shifts: { current: null, upcoming: [] },
        },
        operations: {
          recentlySubmitted: [removed],
          urgent: [removed, retained],
        },
      },
      employeeJobs: [removed, retained],
      jobDetails: { 1: removed },
      jobs: { jobs: [removed, retained] },
      roster: { jobs: [removed, retained] },
    } as unknown as OfflineV2Snapshot

    const next = removeJobEverywhere(base, removed.id)

    expect(next.dashboard.employee?.jobs).toEqual([retained])
    expect(next.dashboard.employee?.nextActionable).toBeNull()
    expect(next.dashboard.operations?.recentlySubmitted).toEqual([])
    expect(next.dashboard.operations?.urgent).toEqual([retained])
    expect(next.employeeJobs).toEqual([retained])
    expect(next.jobDetails).toEqual({})
    expect(next.jobs?.jobs).toEqual([retained])
    expect(next.roster.jobs).toEqual([retained])
  })
})
