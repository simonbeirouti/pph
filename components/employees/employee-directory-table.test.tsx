import { cleanup, render, screen, within } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { EmployeeDirectoryTable } from "@/components/employees/employee-directory-table"
import type { EmployeeSummary } from "@/lib/employees/data"
import type { JobCard } from "@/lib/jobs/types"
import type { RosterShift } from "@/lib/roster/types"

vi.mock("@/app/dashboard/employees/actions", () => ({
  changeMembershipRoleAction: vi.fn(),
  deleteInvitedEmployeeAction: vi.fn(),
  employeeAccessAction: vi.fn(),
  requestEmployeePasswordRecoveryAction: vi.fn(),
  resendEmployeeInvitationAction: vi.fn(),
  updateEmployeeAction: vi.fn(),
}))
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

const baseEmployee: EmployeeSummary = {
  avatarPath: null,
  avatarUrl: null,
  displayName: "Alex Employee",
  email: "alex@example.test",
  firstName: "Alex",
  inviteDeliveryStatus: "sent",
  inviteLastAttemptedAt: "2026-07-27T00:00:00.000Z",
  jobTitle: "Operator",
  lastName: "Employee",
  membershipId: 1103,
  phone: "",
  profileId: 1203,
  role: "employee",
  status: "active",
  userId: "00000000-0000-4000-8000-000000000002",
}

function job(id: number, title: string, dueAt: string): JobCard {
  return {
    assigneeMembershipId: baseEmployee.membershipId,
    description: "",
    dueAt,
    id,
    location: "",
    minimumCompletionPhotos: 0,
    priority: "normal",
    requiresCompletionNote: false,
    scheduledAt: null,
    status: "assigned",
    title,
    updatedAt: "2026-08-01T00:00:00.000Z",
  }
}

function shift(id: number, startsAt: string): RosterShift {
  return {
    archivedAt: null,
    createdAt: "2026-08-01T00:00:00.000Z",
    createdByMembershipId: 1101,
    employeeMembershipId: baseEmployee.membershipId,
    endsAt: new Date(Date.parse(startsAt) + 3_600_000).toISOString(),
    id,
    lockedAt: null,
    lockedByMembershipId: null,
    notes: "",
    organisationId: 1001,
    startsAt,
    updatedAt: "2026-08-01T00:00:00.000Z",
  }
}

afterEach(cleanup)

describe("EmployeeDirectoryTable", () => {
  it("shows one membership status and omits job titles", () => {
    const invitedEmployee: EmployeeSummary = {
      ...baseEmployee,
      displayName: "Indie Invited",
      email: "invited@example.test",
      firstName: "Indie",
      membershipId: 1105,
      profileId: 1205,
      status: "invited",
      userId: null,
    }

    render(
      <EmployeeDirectoryTable
        actorRole="owner"
        employees={[baseEmployee, invitedEmployee]}
        jobSummaries={{}}
        shiftSummaries={{}}
        timezone="Australia/Melbourne"
      />
    )

    const activeRow = screen.getByRole("row", {
      name: "Open Alex Employee details",
    })
    expect(within(activeRow).getByText(/^active$/i)).toBeVisible()
    expect(within(activeRow).queryByText(/^sent$/i)).not.toBeInTheDocument()
    expect(within(activeRow).queryByText("Operator")).not.toBeInTheDocument()

    const invitedRow = screen.getByRole("row", {
      name: "Open Indie Invited details",
    })
    expect(within(invitedRow).getByText(/^invite pending$/i)).toBeVisible()
    expect(within(invitedRow).queryByText(/^invited$/i)).not.toBeInTheDocument()
    expect(
      screen.queryByRole("columnheader", { name: "Job title" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("columnheader", { name: "Invitation" })
    ).not.toBeInTheDocument()
  })

  it("opens a directly selected employee in the responsive sheet", () => {
    render(
      <EmployeeDirectoryTable
        actorRole="owner"
        employees={[baseEmployee]}
        jobSummaries={{}}
        openEmployeeId={baseEmployee.membershipId}
        shiftSummaries={{}}
        timezone="Australia/Melbourne"
      />
    )

    const sheet = screen.getByRole("dialog")
    expect(sheet).toHaveClass(
      "data-[side=right]:sm:w-[min(46rem,calc(100vw-2rem))]",
      "data-[side=right]:sm:max-w-[min(84rem,calc(100vw-2rem))]"
    )
    expect(document.querySelector("[data-employee-work-layout]")).toHaveClass(
      "grid-cols-[repeat(auto-fit,minmax(min(100%,28rem),1fr))]"
    )
    expect(
      screen.getByRole("button", {
        name: "Change Alex Employee profile photo",
      })
    ).toBeVisible()
  })

  it("shows only the three soonest jobs and shifts without shift controls", () => {
    render(
      <EmployeeDirectoryTable
        actorRole="owner"
        employees={[baseEmployee]}
        jobSummaries={{
          [baseEmployee.membershipId]: {
            active: [
              job(1, "Fourth job", "2026-08-08T00:00:00.000Z"),
              job(2, "Second job", "2026-08-06T00:00:00.000Z"),
              job(3, "First job", "2026-08-05T00:00:00.000Z"),
              job(4, "Third job", "2026-08-07T00:00:00.000Z"),
            ],
            archived: [],
          },
        }}
        openEmployeeId={baseEmployee.membershipId}
        shiftSummaries={{
          [baseEmployee.membershipId]: {
            current: null,
            upcoming: [
              shift(4, "2026-08-08T00:00:00.000Z"),
              shift(2, "2026-08-06T00:00:00.000Z"),
              shift(1, "2026-08-05T00:00:00.000Z"),
              shift(3, "2026-08-07T00:00:00.000Z"),
            ],
          },
        }}
        timezone="Australia/Melbourne"
      />
    )

    const jobs = document.querySelector('[data-employee-summary="jobs"]')
    const shifts = document.querySelector('[data-employee-summary="shifts"]')
    const fields = document.querySelector("[data-employee-profile-fields]")
    expect(jobs?.children).toHaveLength(3)
    expect(within(jobs as HTMLElement).getByText("First job")).toBeVisible()
    expect(within(jobs as HTMLElement).getByText("Second job")).toBeVisible()
    expect(within(jobs as HTMLElement).getByText("Third job")).toBeVisible()
    expect(screen.queryByText("Fourth job")).not.toBeInTheDocument()
    expect(screen.queryByText("Active jobs")).not.toBeInTheDocument()
    expect(screen.queryByText("Recent archived")).not.toBeInTheDocument()
    expect(shifts?.children).toHaveLength(3)
    expect(screen.getByRole("button", { name: "View jobs" })).toHaveAttribute(
      "href",
      `/dashboard/jobs?employee=${baseEmployee.membershipId}`
    )
    expect(screen.getByRole("button", { name: "View shifts" })).toHaveAttribute(
      "href",
      `/dashboard/roster?employee=${baseEmployee.membershipId}`
    )
    expect(
      screen.queryByRole("button", { name: "Add shift" })
    ).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/Edit .* shift/)).not.toBeInTheDocument()
    expect(fields).toHaveClass("sm:grid-cols-3", "[&>div]:contents")
  })
})
