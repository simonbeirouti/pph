import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  EmployeeOperationalDashboard,
  OwnerOperationalDashboard,
} from "@/components/operational-dashboard"
import type {
  EmployeeDashboardData,
  OwnerDashboardData,
} from "@/lib/dashboard/data"
import type { JobCard } from "@/lib/jobs/types"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))
vi.mock("@/app/dashboard/jobs/actions", () => ({
  startJobAction: vi.fn(),
}))

afterEach(cleanup)

const baseJob: JobCard = {
  assigneeMembershipId: 1103,
  description: "",
  dueAt: "2030-01-02T00:00:00Z",
  id: 1,
  location: "",
  minimumCompletionPhotos: 0,
  priority: "normal",
  requiresCompletionNote: false,
  scheduledAt: null,
  status: "assigned",
  title: "Actionable",
  updatedAt: "2030-01-01T00:00:00Z",
}

describe("employee operational dashboard", () => {
  it("selects actionable work independently of pending review", () => {
    const review = {
      ...baseJob,
      id: 2,
      priority: "urgent" as const,
      status: "in_review" as const,
      title: "Pending review",
    }
    const resume = {
      ...baseJob,
      id: 3,
      status: "in_progress" as const,
      title: "Resume task",
    }
    const data: EmployeeDashboardData = {
      jobs: [review, baseJob, resume],
      nextActionable: baseJob,
      shifts: { current: null, upcoming: [] },
    }
    render(
      <EmployeeOperationalDashboard
        data={data}
        name="Alex"
        timezone="Australia/Melbourne"
      />
    )

    expect(
      screen.getByText("Next actionable").closest("div")
    ).toHaveTextContent("Actionable")
    expect(screen.getByRole("button", { name: "Start" })).toBeVisible()
    expect(screen.getByRole("button", { name: "Resume" })).toBeVisible()
    expect(
      screen.getByRole("button", { name: "View submission" })
    ).toBeVisible()
  })
})

describe("owner operational dashboard", () => {
  it("links statistics to visible job filters", () => {
    const data: OwnerDashboardData = {
      awaitingReview: 3,
      outstanding: 7,
      recentlySubmitted: [],
      todayRoster: [],
      urgent: [],
      urgentCount: 2,
      workingNow: 1,
    }
    render(
      <OwnerOperationalDashboard
        data={data}
        name="Owner"
        timezone="Australia/Melbourne"
      />
    )

    expect(screen.getByText("Outstanding").closest("a")).toHaveAttribute(
      "href",
      "/dashboard/jobs?status=outstanding"
    )
    expect(screen.getByText("Awaiting review").closest("a")).toHaveAttribute(
      "href",
      "/dashboard/jobs?status=in_review"
    )
    expect(screen.getByText("Urgent").closest("a")).toHaveAttribute(
      "href",
      "/dashboard/jobs?priority=urgent"
    )
  })

  it("uses borderless scrollable panels and keeps roster in the action grid", () => {
    const data: OwnerDashboardData = {
      awaitingReview: 0,
      outstanding: 0,
      recentlySubmitted: [{ ...baseJob, submittedAt: "2030-01-01T12:00:00Z" }],
      todayRoster: [],
      urgent: [{ ...baseJob, priority: "urgent" }],
      urgentCount: 1,
      workingNow: 0,
    }
    const { container } = render(
      <OwnerOperationalDashboard
        data={data}
        name="Owner"
        timezone="Australia/Melbourne"
      />
    )

    for (const title of ["Urgent jobs", "Recently submitted"]) {
      const panel = screen
        .getByRole("heading", { name: title })
        .closest("section")
      expect(panel).toHaveClass("h-[28rem]")
      expect(panel?.lastElementChild).toHaveClass("overflow-y-auto")
      expect(panel?.closest('[data-slot="card"]')).toBeNull()
    }

    const roster = screen
      .getByRole("heading", { name: "Today’s roster" })
      .closest("section")
    expect(roster).toHaveClass("xl:col-span-2")
    expect(roster?.closest('[data-slot="card"]')).toBeNull()
    expect(
      screen.getByText("Working now").closest("a")?.querySelector("svg")
    ).toHaveClass("size-10")
    expect(container.firstElementChild).toHaveClass("gap-8")
  })
})
