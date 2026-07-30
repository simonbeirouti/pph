import { cleanup, render, screen, within } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { EmployeeDirectoryTable } from "@/components/employee-directory-table"
import type { EmployeeSummary } from "@/lib/employees/data"

vi.mock("@/app/dashboard/employees/actions", () => ({
  resendEmployeeInvitationAction: vi.fn(),
  updateEmployeeAction: vi.fn(),
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
})
