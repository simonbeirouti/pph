import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import { requestEmployeePasswordRecoveryAction } from "@/app/dashboard/employees/actions"
import { EmployeeAccessActions } from "@/components/employees/employee-access-actions"

const mocks = vi.hoisted(() => ({
  queue: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}))

vi.mock("@/app/dashboard/employees/actions", () => ({
  deleteInvitedEmployeeAction: vi.fn(),
  employeeAccessAction: vi.fn(),
  requestEmployeePasswordRecoveryAction: vi.fn(),
}))
vi.mock("@/components/offline/offline-v2-actions", () => ({
  useOfflineV2Actions: () => ({ queue: mocks.queue }),
}))
vi.mock("sonner", () => ({
  toast: { error: mocks.toastError, success: mocks.toastSuccess },
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe("EmployeeAccessActions password recovery", () => {
  it("gives active employees a one-fifth icon reset action with a tooltip", async () => {
    const user = userEvent.setup()
    render(
      <EmployeeAccessActions
        displayName="Sam Worker"
        membershipId={42}
        status="active"
      />
    )

    const reset = screen.getByRole("button", {
      name: "Reset password for Sam Worker",
    })
    expect(reset.querySelector("svg")).toBeInTheDocument()
    expect(reset.parentElement).toHaveClass("grid-cols-5")
    expect(
      screen.getByRole("button", { name: "Deactivate access" })
    ).toHaveClass("col-span-4")

    await user.hover(reset)
    expect(
      await screen.findByText("Reset password", { exact: true })
    ).toHaveAttribute("data-slot", "tooltip-content")
  })

  it.each(["invited", "inactive"] as const)(
    "does not offer password recovery for %s memberships",
    (status) => {
      render(
        <EmployeeAccessActions
          displayName="Sam Worker"
          membershipId={42}
          status={status}
        />
      )
      expect(
        screen.queryByRole("button", { name: /reset password/i })
      ).not.toBeInTheDocument()
    }
  )

  it("sends an active employee recovery email and confirms it", async () => {
    vi.mocked(requestEmployeePasswordRecoveryAction).mockResolvedValue({
      message: "Password reset email sent.",
      ok: true,
    })
    render(
      <EmployeeAccessActions
        displayName="Sam Worker"
        membershipId={42}
        status="active"
      />
    )

    fireEvent.click(
      screen.getByRole("button", { name: "Reset password for Sam Worker" })
    )

    await waitFor(() =>
      expect(requestEmployeePasswordRecoveryAction).toHaveBeenCalledWith(42)
    )
    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      "Password reset email sent."
    )
  })

  it("keeps access actions clickable while password recovery is pending", async () => {
    let finishRecovery!: () => void
    vi.mocked(requestEmployeePasswordRecoveryAction).mockImplementation(
      () =>
        new Promise((resolve) => {
          finishRecovery = () =>
            resolve({ message: "Password reset email sent.", ok: true })
        })
    )
    render(
      <EmployeeAccessActions
        displayName="Sam Worker"
        membershipId={42}
        status="active"
      />
    )

    fireEvent.click(
      screen.getByRole("button", { name: "Reset password for Sam Worker" })
    )

    await waitFor(() =>
      expect(
        screen.getByRole("button", {
          name: "Reset password for Sam Worker",
        })
      ).toBeDisabled()
    )
    expect(
      screen.getByRole("button", { name: "Deactivate access" })
    ).toBeEnabled()

    finishRecovery()
    await waitFor(() =>
      expect(
        screen.getByRole("button", {
          name: "Reset password for Sam Worker",
        })
      ).toBeEnabled()
    )
  })
})
