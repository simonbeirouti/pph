import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { EmployeeAvatar, employeeInitials } from "@/components/employee-avatar"

describe("EmployeeAvatar", () => {
  it("uses a two-character initials fallback", () => {
    expect(employeeInitials("Alex Employee")).toBe("AE")
    render(<EmployeeAvatar name="Alex Employee" url={null} />)
    expect(screen.getByText("AE")).toBeVisible()
  })

  it("keeps the initials fallback while an image loads", () => {
    render(
      <EmployeeAvatar name="Alex Employee" url="https://example.test/avatar" />
    )
    expect(screen.getAllByText("AE").at(-1)).toBeVisible()
  })
})
