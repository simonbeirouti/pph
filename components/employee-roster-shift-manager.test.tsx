import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import { EmployeeRosterShiftManager } from "@/components/employee-roster-shift-manager"
import type { RosterShift } from "@/lib/roster/types"

vi.mock("@/app/dashboard/employees/roster-actions", () => ({
  saveEmployeeRosterShiftAction: vi.fn(),
}))
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

const shift: RosterShift = {
  archivedAt: null,
  createdAt: "2026-07-27T00:00:00.000Z",
  createdByMembershipId: 1101,
  employeeMembershipId: 1103,
  endsAt: "2026-07-27T07:00:00.000Z",
  id: 1301,
  notes: "Front desk",
  organisationId: 1001,
  startsAt: "2026-07-27T01:00:00.000Z",
  updatedAt: "2026-07-27T00:00:00.000Z",
}

afterEach(cleanup)

describe("EmployeeRosterShiftManager", () => {
  it("opens a prefilled exact edit form", async () => {
    const user = userEvent.setup()
    render(
      <EmployeeRosterShiftManager
        canManage
        employeeMembershipId={1103}
        employeeName="Alex Employee"
        summary={{ current: shift, upcoming: [] }}
        timezone="Australia/Melbourne"
      />
    )

    await user.click(
      screen.getByRole("button", { name: "Edit Alex Employee shift" })
    )
    const dialog = screen.getByRole("dialog", { name: "Edit shift" })
    expect(within(dialog).getByLabelText("Date")).toHaveValue("2026-07-27")
    expect(within(dialog).getByLabelText("Start")).toHaveValue("11:00")
    expect(within(dialog).getByLabelText("End")).toHaveValue("17:00")
    expect(within(dialog).getByLabelText("Notes")).toHaveValue("Front desk")
  })

  it("opens a create form from an empty shift area", async () => {
    const user = userEvent.setup()
    render(
      <EmployeeRosterShiftManager
        canManage
        employeeMembershipId={1103}
        employeeName="Alex Employee"
        summary={{ current: null, upcoming: [] }}
        timezone="Australia/Melbourne"
      />
    )

    expect(screen.getByText("No current or upcoming shifts.")).toBeVisible()
    await user.click(screen.getByRole("button", { name: "Add shift" }))
    const dialog = screen.getByRole("dialog", { name: "Add shift" })
    expect(within(dialog).getByLabelText("Start")).toHaveValue("09:00")
    expect(within(dialog).getByLabelText("End")).toHaveValue("17:00")
    expect(within(dialog).getByLabelText("Start")).toHaveAttribute("step", "60")
    expect(within(dialog).getByLabelText("End")).toHaveAttribute("step", "60")
    expect(
      within(dialog).getByRole("button", { name: "Create shift" })
    ).toBeEnabled()
  })

  it("moves the end time with the start while preserving duration", async () => {
    const user = userEvent.setup()
    render(
      <EmployeeRosterShiftManager
        canManage
        employeeMembershipId={1103}
        employeeName="Alex Employee"
        summary={{ current: shift, upcoming: [] }}
        timezone="Australia/Melbourne"
      />
    )

    await user.click(
      screen.getByRole("button", { name: "Edit Alex Employee shift" })
    )
    const dialog = screen.getByRole("dialog", { name: "Edit shift" })
    const start = within(dialog).getByLabelText("Start")
    const end = within(dialog).getByLabelText("End")

    fireEvent.change(start, { target: { value: "20:00" } })

    expect(end).toHaveValue("02:00")
  })

  it("keeps inactive employee history read-only", () => {
    render(
      <EmployeeRosterShiftManager
        canManage={false}
        employeeMembershipId={1103}
        employeeName="Alex Employee"
        summary={{ current: shift, upcoming: [] }}
        timezone="Australia/Melbourne"
      />
    )

    expect(
      screen.getByText("Activate this employee to change their shifts.")
    ).toBeVisible()
    expect(
      screen.queryByRole("button", { name: "Add shift" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Edit Alex Employee shift" })
    ).not.toBeInTheDocument()
  })
})
