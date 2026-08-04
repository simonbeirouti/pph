import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import DashboardLoading from "@/app/dashboard/loading"
import EmployeesLoading from "@/app/dashboard/employees/loading"
import JobsLoading from "@/app/dashboard/jobs/loading"
import ProfileLoading from "@/app/dashboard/profile/loading"
import RosterLoading from "@/app/dashboard/roster/loading"
import TemplatesLoading from "@/app/dashboard/templates/loading"

const loadingStates = [
  ["dashboard", DashboardLoading],
  ["employees", EmployeesLoading],
  ["jobs", JobsLoading],
  ["profile", ProfileLoading],
  ["roster", RosterLoading],
  ["templates and schedules", TemplatesLoading],
] as const

describe("dashboard loading states", () => {
  it("matches the dashboard's flat section layout", () => {
    const { container, unmount } = render(<DashboardLoading />)

    expect(
      container.querySelectorAll("[data-dashboard-loading-section]")
    ).toHaveLength(3)
    expect(
      container.querySelectorAll(
        "[data-dashboard-loading-section].rounded-xl"
      )
    ).toHaveLength(0)
    unmount()
  })

  it.each(loadingStates)(
    "provides an accessible %s route fallback",
    (route, LoadingState) => {
      const { container } = render(<LoadingState />)

      expect(
        screen.getByRole("status", { name: `Loading ${route}` })
      ).toHaveAttribute("aria-busy", "true")
      expect(
        container.querySelectorAll("[data-slot='skeleton']").length
      ).toBeGreaterThan(0)
    }
  )
})
