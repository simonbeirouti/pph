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
import { archiveEmployeeRosterShiftAction } from "@/app/dashboard/employees/roster-actions"
import type { RosterShift } from "@/lib/roster/types"

vi.mock("@/app/dashboard/employees/roster-actions", () => ({
  archiveEmployeeRosterShiftAction: vi.fn(),
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
  lockedAt: null,
  lockedByMembershipId: null,
  notes: "Front desk",
  organisationId: 1001,
  startsAt: "2026-07-27T01:00:00.000Z",
  updatedAt: "2026-07-27T00:00:00.000Z",
}

afterEach(cleanup)

describe("EmployeeRosterShiftManager", () => {
  it("shows locked shifts without profile edit controls", () => {
    render(
      <EmployeeRosterShiftManager
        canManage
        employeeMembershipId={1103}
        employeeName="Alex Employee"
        summary={{
          current: {
            ...shift,
            lockedAt: "2026-07-27T00:30:00.000Z",
            lockedByMembershipId: 1101,
          },
          upcoming: [],
        }}
        timezone="Australia/Melbourne"
      />
    )

    expect(screen.getByText("Locked")).toBeVisible()
    expect(
      screen.queryByRole("button", { name: "Edit Alex Employee shift" })
    ).not.toBeInTheDocument()
  })

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

  it("requires confirmation before deleting a shift", async () => {
    vi.mocked(archiveEmployeeRosterShiftAction).mockResolvedValue({
      message: "Shift deleted.",
      ok: true,
    })
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
    await user.click(
      within(screen.getByRole("dialog", { name: "Edit shift" })).getByRole(
        "button",
        { name: "Delete shift" }
      )
    )
    const confirmation = screen.getByRole("alertdialog", {
      name: "Delete this shift?",
    })
    expect(archiveEmployeeRosterShiftAction).not.toHaveBeenCalled()
    await user.click(
      within(confirmation).getByRole("button", { name: "Delete shift" })
    )
    expect(archiveEmployeeRosterShiftAction).toHaveBeenCalledWith(
      1103,
      1301,
      shift.updatedAt
    )
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
