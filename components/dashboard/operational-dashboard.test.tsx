import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  EmployeeOperationalDashboard,
  OwnerOperationalDashboard,
} from "@/components/dashboard/operational-dashboard"
import type {
  EmployeeDashboardData,
  OwnerDashboardData,
} from "@/lib/dashboard/data"
import type { JobCard } from "@/lib/jobs/types"
import type { RosterShift } from "@/lib/roster/types"

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

function shift(
  id: number,
  startsAt: string,
  endsAt: string,
  notes: string
): RosterShift {
  return {
    archivedAt: null,
    createdAt: "2030-01-01T00:00:00Z",
    createdByMembershipId: 1101,
    employeeMembershipId: 1103,
    endsAt,
    id,
    lockedAt: null,
    lockedByMembershipId: null,
    notes,
    organisationId: 1001,
    startsAt,
    updatedAt: "2030-01-01T00:00:00Z",
  }
}

describe("employee operational dashboard", () => {
  it("hides pending review and shows only actionable work", () => {
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
    expect(screen.queryByText("Pending review")).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "View submission" })
    ).not.toBeInTheDocument()
  })

  it("uses plain sections and shows only the current and next shifts", () => {
    const current = shift(
      11,
      "2030-01-01T01:00:00Z",
      "2030-01-01T09:00:00Z",
      "Current shift"
    )
    const next = shift(
      12,
      "2030-01-02T01:00:00Z",
      "2030-01-02T09:00:00Z",
      "Next shift"
    )
    const later = shift(
      13,
      "2030-01-03T01:00:00Z",
      "2030-01-03T09:00:00Z",
      "Later shift"
    )
    const data: EmployeeDashboardData = {
      jobs: [baseJob],
      nextActionable: baseJob,
      shifts: { current, upcoming: [next, later] },
    }

    render(
      <EmployeeOperationalDashboard
        data={data}
        name="Alex"
        timezone="Australia/Melbourne"
      />
    )

    const roster = screen
      .getByRole("heading", { name: "Your roster" })
      .closest("section")
    const work = screen
      .getByRole("heading", { name: "Assigned work" })
      .closest("section")
    expect(roster?.closest('[data-slot="card"]')).toBeNull()
    expect(work?.closest('[data-slot="card"]')).toBeNull()
    expect(screen.getByText("Urgent and due work appears first.")).toBeVisible()
    expect(screen.getByText("Current shift")).toBeVisible()
    expect(screen.getByText("Next shift")).toBeVisible()
    expect(screen.queryByText("Later shift")).not.toBeInTheDocument()
    expect(roster?.querySelectorAll(".rounded-md.border")).toHaveLength(2)
    expect(
      screen.getByText("Actionable").closest(".rounded-lg.border")
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
    const firstShift = shift(
      21,
      "2030-01-01T01:00:00Z",
      "2030-01-01T09:00:00Z",
      ""
    )
    const secondShift = shift(
      22,
      "2030-01-01T02:00:00Z",
      "2030-01-01T08:00:00Z",
      ""
    )
    const data: OwnerDashboardData = {
      awaitingReview: 0,
      outstanding: 0,
      recentlySubmitted: [{ ...baseJob, submittedAt: "2030-01-01T12:00:00Z" }],
      todayRoster: [
        { ...firstShift, employeeName: "Bill Burr", workingNow: false },
        { ...secondShift, employeeName: "Axel Rod", workingNow: true },
      ],
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
    const rosterGrid = roster?.querySelector("[data-roster-grid]")
    expect(rosterGrid).toHaveClass(
      "grid-cols-[repeat(auto-fit,minmax(min(100%,22rem),1fr))]"
    )
    expect(rosterGrid?.children).toHaveLength(2)
    expect(screen.getByText("Bill Burr")).toBeVisible()
    expect(screen.getByText("Axel Rod")).toBeVisible()
    expect(
      container.querySelector('a[href="/dashboard/roster"] svg')
    ).toHaveClass("size-10")
    expect(container.firstElementChild).toHaveClass("gap-8")
  })
})
