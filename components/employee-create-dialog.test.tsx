import { cleanup, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import { EmployeeCreateDialog } from "@/components/employee-create-dialog"

const viewportMocks = vi.hoisted(() => ({
  mobile: false,
}))

vi.mock("@/app/dashboard/employees/actions", () => ({
  createEmployeeAction: vi.fn(),
}))
vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => viewportMocks.mobile,
}))
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    warning: vi.fn(),
  },
}))

afterEach(() => {
  cleanup()
  viewportMocks.mobile = false
  vi.clearAllMocks()
})

describe("EmployeeCreateDialog", () => {
  it("uses the compact desktop form with capitalised roles", async () => {
    const user = userEvent.setup()
    render(<EmployeeCreateDialog canChooseRole />)

    await user.click(screen.getByRole("button", { name: "Add employee" }))
    const dialog = screen.getByRole("dialog", { name: "Add employee" })

    expect(
      within(dialog).getByRole("button", { name: "Upload profile photo" })
    ).toHaveClass(
      "aspect-square",
      "size-24",
      "shrink-0",
      "rounded-full",
      "overflow-hidden"
    )
    expect(within(dialog).getByLabelText("Profile photo")).toHaveClass(
      "sr-only"
    )
    expect(dialog.querySelector('[data-employee-form-row="name"]')).toHaveClass(
      "grid-cols-2"
    )
    expect(
      dialog.querySelector('[data-employee-form-row="contact"]')
    ).toHaveClass("grid-cols-2")
    expect(within(dialog).queryByLabelText("Job title")).not.toBeInTheDocument()
    for (const label of ["First name", "Last name", "Phone"]) {
      expect(
        within(dialog).getByLabelText(label).closest('[data-slot="field"]')
      ).toHaveClass("pt-2")
    }

    const role = within(dialog).getByRole("combobox", { name: "Role" })
    expect(role).toHaveTextContent("Employee")
    await user.click(role)
    await user.click(await screen.findByRole("option", { name: "Manager" }))
    expect(role).toHaveTextContent("Manager")
    expect(
      within(dialog).getByRole("button", { name: "Create and invite" })
    ).toHaveClass("w-full")
  })

  it("uses a viewport-capped mobile drawer", async () => {
    viewportMocks.mobile = true
    const user = userEvent.setup()
    const { container } = render(<EmployeeCreateDialog canChooseRole />)

    await user.click(screen.getByRole("button", { name: "Add employee" }))

    expect(screen.getByRole("dialog", { name: "Add employee" })).toBeVisible()
    const drawer = container.ownerDocument.querySelector(
      '[data-slot="drawer-popup"]'
    )
    expect(drawer).toHaveClass(
      "[--drawer-content-max-height:calc(100dvh-1rem)]"
    )
    expect(drawer?.getAttribute("style")).not.toContain(
      "--drawer-content-height"
    )
    expect(
      container.ownerDocument.querySelector('[data-slot="drawer-content"]')
    ).toHaveClass("min-h-0", "overflow-y-auto")
    expect(
      container.ownerDocument.querySelector('[data-employee-form-row="name"]')
    ).toHaveClass("grid-cols-2")
    expect(
      container.ownerDocument.querySelector(
        '[data-employee-form-row="contact"]'
      )
    ).toHaveClass("grid-cols-2")
    expect(screen.queryByLabelText("Job title")).not.toBeInTheDocument()
  })
})
