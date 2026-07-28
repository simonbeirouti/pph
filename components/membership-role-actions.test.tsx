import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useEffect } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { changeMembershipRoleAction } from "@/app/dashboard/employees/actions"
import {
  EmployeeEditor,
  EmployeeSaveAction,
  MembershipRoleSelector,
  useEmployeeEdit,
} from "@/components/membership-role-actions"

const { toastSuccess } = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
}))

vi.mock("@/app/dashboard/employees/actions", () => ({
  changeMembershipRoleAction: vi.fn(),
}))

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: toastSuccess,
  },
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe("MembershipRoleActions", () => {
  it("reveals immediate save after a role change and confirms with a toast", async () => {
    const user = userEvent.setup()
    vi.mocked(changeMembershipRoleAction).mockResolvedValue({
      message: "Role changed to manager.",
      ok: true,
    })

    function RoleChangeControl() {
      const { setRole } = useEmployeeEdit()
      return (
        <button onClick={() => setRole("manager")} type="button">
          Choose manager
        </button>
      )
    }

    render(
      <EmployeeEditor
        currentRole="employee"
        displayName="Alex Employee"
        membershipId={1103}
      >
        <MembershipRoleSelector />
        <RoleChangeControl />
        <EmployeeSaveAction />
      </EmployeeEditor>
    )

    expect(
      screen.queryByRole("button", { name: "Save changes" })
    ).not.toBeInTheDocument()

    const roleSelector = screen.getByRole("combobox", {
      name: "Role for Alex Employee",
    })
    expect(roleSelector).toHaveTextContent("Employee")

    await user.click(screen.getByRole("button", { name: "Choose manager" }))
    expect(roleSelector).toHaveTextContent("Manager")
    await user.click(screen.getByRole("button", { name: "Save changes" }))

    expect(changeMembershipRoleAction).toHaveBeenCalledWith(1103, "manager")
    expect(toastSuccess).toHaveBeenCalledWith("Role changed to manager.")
    expect(
      screen.queryByRole("button", { name: "Save changes" })
    ).not.toBeInTheDocument()
  })

  it("uses the same save action and a toast for profile changes", async () => {
    const user = userEvent.setup()
    const saveProfile = vi.fn().mockResolvedValue({
      message: "Employee profile updated.",
      ok: true,
    })

    function ProfileChangeControl() {
      const { markProfileDirty, registerProfileSave } = useEmployeeEdit()
      useEffect(() => {
        registerProfileSave(saveProfile)
        return () => registerProfileSave(null)
      }, [registerProfileSave])
      return (
        <button onClick={markProfileDirty} type="button">
          Edit profile
        </button>
      )
    }

    render(
      <EmployeeEditor
        currentRole="employee"
        displayName="Alex Employee"
        membershipId={1103}
      >
        <ProfileChangeControl />
        <EmployeeSaveAction />
      </EmployeeEditor>
    )

    await user.click(screen.getByRole("button", { name: "Edit profile" }))
    await user.click(screen.getByRole("button", { name: "Save changes" }))

    expect(saveProfile).toHaveBeenCalledOnce()
    expect(changeMembershipRoleAction).not.toHaveBeenCalled()
    expect(toastSuccess).toHaveBeenCalledWith("Employee profile updated.")
    expect(
      screen.queryByRole("button", { name: "Save changes" })
    ).not.toBeInTheDocument()
  })
})
