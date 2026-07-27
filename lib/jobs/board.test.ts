import { describe, expect, it } from "vitest"

import {
  columnsForJobView,
  jobMatchesView,
  jobWorkflowColumn,
  sortJobsByUrgency,
} from "@/lib/jobs/board"
import type { JobCard } from "@/lib/jobs/types"

const job: JobCard = {
  assigneeMembershipId: null,
  description: "",
  dueAt: null,
  id: 10,
  location: "",
  minimumCompletionPhotos: 0,
  priority: "low",
  requiresCompletionNote: false,
  scheduledAt: null,
  status: "assigned",
  title: "Example job",
  updatedAt: "2026-07-27T00:00:00.000Z",
}

describe("job workflow board", () => {
  it("publishes three workflow columns and one archived column", () => {
    expect(columnsForJobView("workflow").map((column) => column.key)).toEqual([
      "unassigned",
      "assigned",
      "review",
    ])
    expect(columnsForJobView("archived").map((column) => column.key)).toEqual([
      "archived",
    ])
  })

  it("maps every status and assignment combination deterministically", () => {
    expect(jobWorkflowColumn(job)).toBe("unassigned")
    expect(jobWorkflowColumn({ ...job, assigneeMembershipId: 1103 })).toBe(
      "assigned"
    )
    expect(
      jobWorkflowColumn({
        ...job,
        assigneeMembershipId: 1103,
        status: "in_progress",
      })
    ).toBe("assigned")
    expect(
      jobWorkflowColumn({
        ...job,
        assigneeMembershipId: 1103,
        status: "in_review",
      })
    ).toBe("review")
    expect(jobWorkflowColumn({ ...job, status: "archived" })).toBe("archived")
  })

  it("separates workflow and archived views", () => {
    expect(jobMatchesView(job, "workflow")).toBe(true)
    expect(jobMatchesView({ ...job, status: "in_review" }, "workflow")).toBe(
      true
    )
    expect(jobMatchesView({ ...job, status: "archived" }, "workflow")).toBe(
      false
    )
    expect(jobMatchesView({ ...job, status: "archived" }, "archived")).toBe(
      true
    )
  })

  it("orders work by priority, due time, then recent activity", () => {
    const jobs = sortJobsByUrgency([
      {
        ...job,
        dueAt: "2026-07-27T11:00:00.000Z",
        id: 11,
        priority: "normal",
        title: "Normal",
      },
      {
        ...job,
        dueAt: "2026-07-27T12:00:00.000Z",
        id: 12,
        priority: "urgent",
        title: "Urgent later",
      },
      {
        ...job,
        dueAt: "2026-07-27T10:00:00.000Z",
        id: 13,
        priority: "urgent",
        title: "Urgent earlier",
      },
      {
        ...job,
        id: 14,
        priority: "high",
        title: "High",
      },
    ])

    expect(jobs.map((current) => current.title)).toEqual([
      "Urgent earlier",
      "Urgent later",
      "High",
      "Normal",
    ])
  })
})
