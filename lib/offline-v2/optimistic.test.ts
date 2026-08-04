import { describe, expect, it } from "vitest"

import { submitJobEverywhere } from "@/lib/offline-v2/optimistic"
import type { OfflineV2Snapshot } from "@/lib/offline-v2/types"
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
})
