import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it } from "vitest"

import { EmployeeStatusFilter } from "@/components/employee-status-filter"

afterEach(cleanup)

describe("EmployeeStatusFilter", () => {
  it.each([
    ["all", "All statuses"],
    ["invited", "Invited"],
    ["active", "Active"],
    ["inactive", "Inactive"],
  ] as const)("renders %s with the explicit %s label", (status, label) => {
    render(<EmployeeStatusFilter status={status} />)

    expect(
      screen.getByRole("combobox", { name: "Filter by status" })
    ).toHaveTextContent(label)
  })

  it("keeps lowercase option values while showing title-case labels", async () => {
    const user = userEvent.setup()
    const { container } = render(
      <form>
        <EmployeeStatusFilter status="all" />
      </form>
    )

    const trigger = screen.getByRole("combobox", {
      name: "Filter by status",
    })
    await user.click(trigger)
    await user.click(screen.getByRole("option", { name: "Active" }))

    expect(trigger).toHaveTextContent("Active")
    expect(
      new FormData(container.querySelector("form")!).get("status")
    ).toBe("active")
  })
})
