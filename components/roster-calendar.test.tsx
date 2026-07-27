import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import { RosterCalendar } from "@/components/roster-calendar"
import type { RosterShift } from "@/lib/roster/types"
import * as timezone from "@/lib/timezone"

const replace = vi.fn()
const push = vi.fn()
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace }),
}))

const employees = [
  {
    avatarPath: null,
    displayName: "Alex Employee",
    employeeMembershipId: 1103,
    jobTitle: "Operator",
  },
  {
    avatarPath: null,
    displayName: "Morgan Worker",
    employeeMembershipId: 1105,
    jobTitle: "Supervisor",
  },
]
const localDates = [
  "2026-07-27",
  "2026-07-28",
  "2026-07-29",
  "2026-07-30",
  "2026-07-31",
  "2026-08-01",
  "2026-08-02",
]
const dates = localDates.map((date, index) => ({
  date,
  label: `Day ${index + 1}`,
  shortLabel: `D${index + 1}`,
}))
const shifts: RosterShift[] = employees.map((employee, index) => ({
  archivedAt: null,
  createdAt: "2026-07-26T00:00:00.000Z",
  createdByMembershipId: 1101,
  employeeMembershipId: employee.employeeMembershipId,
  endsAt: `2026-07-27T0${index + 2}:00:00.000Z`,
  id: 1500 + index,
  notes: index ? "Close the site" : "Open the site",
  organisationId: 1001,
  startsAt: `2026-07-27T0${index}:00:00.000Z`,
  updatedAt: "2026-07-26T00:00:00.000Z",
}))

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.clearAllMocks()
})

describe("RosterCalendar", () => {
  it("renders Team day with equal compressed employee columns and sticky rail", () => {
    render(
      <RosterCalendar
        dates={dates}
        employees={employees}
        mode="day"
        now="2026-07-27T02:00:00.000Z"
        selectedDate="2026-07-27"
        selectedEmployeeId={null}
        shifts={shifts}
        timezone="Australia/Melbourne"
        timezoneExplicit
        today="2026-07-27"
      />
    )

    expect(screen.getByRole("heading", { name: "Roster" })).toBeVisible()
    expect(screen.getByText("Team day")).toBeVisible()
    expect(screen.getAllByTestId("roster-time-rail")[0]).toHaveClass(
      "sticky",
      "left-0"
    )
    for (const lanes of screen.getAllByTestId("employee-lanes")) {
      expect(lanes).toHaveStyle({
        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
      })
    }
  })

  it("keeps every active employee lane visible on days without their shift", () => {
    render(
      <RosterCalendar
        dates={dates}
        employees={employees}
        mode="day"
        now="2026-07-27T02:00:00.000Z"
        selectedDate="2026-07-27"
        selectedEmployeeId={null}
        shifts={[shifts[0]]}
        timezone="Australia/Melbourne"
        timezoneExplicit
        today="2026-07-27"
      />
    )

    const calendar = screen.getAllByRole("region", {
      name: "Roster grid",
    })[0]
    expect(
      within(calendar).getByLabelText("Morgan Worker shift lane")
    ).toBeVisible()
    expect(
      within(calendar).queryByRole("button", { name: /Morgan Worker/ })
    ).not.toBeInTheDocument()
  })

  it("renders one selected employee across the week", () => {
    render(
      <RosterCalendar
        dates={dates}
        employees={employees}
        mode="week"
        now="2026-07-27T02:00:00.000Z"
        selectedDate="2026-07-27"
        selectedEmployeeId={1103}
        shifts={shifts}
        timezone="Australia/Melbourne"
        timezoneExplicit
        today="2026-07-27"
      />
    )

    expect(
      screen.getByRole("combobox", { name: "Choose employee" })
    ).toHaveTextContent("Alex Employee")
    expect(screen.getAllByLabelText("Alex Employee shift lane")).toHaveLength(2)
    expect(
      screen.queryByLabelText("Morgan Worker shift lane")
    ).not.toBeInTheDocument()
  })

  it("opens complete shift details from a narrow shift block", async () => {
    const user = userEvent.setup()
    render(
      <RosterCalendar
        dates={dates}
        employees={employees}
        mode="day"
        now="2026-07-27T02:00:00.000Z"
        selectedDate="2026-07-27"
        selectedEmployeeId={null}
        shifts={shifts}
        timezone="Australia/Melbourne"
        timezoneExplicit
        today="2026-07-27"
      />
    )

    const calendar = screen.getAllByRole("region", {
      name: "Roster grid",
    })[0]
    await user.click(
      within(calendar).getByRole("button", {
        name: /Alex Employee.+Open the site/,
      })
    )
    expect(
      screen.getByRole("dialog", { name: "Alex Employee" })
    ).toHaveTextContent("Open the site")
  })

  it("loads the adjacent week when swiping beyond a mobile boundary", () => {
    render(
      <RosterCalendar
        dates={dates}
        employees={employees}
        mode="day"
        now="2026-07-27T02:00:00.000Z"
        selectedDate="2026-07-27"
        selectedEmployeeId={null}
        shifts={shifts}
        timezone="Australia/Melbourne"
        timezoneExplicit
        today="2026-07-27"
      />
    )

    const mobileCalendar = screen.getAllByRole("region", {
      name: "Roster grid",
    })[1]
    fireEvent.touchStart(mobileCalendar, {
      touches: [{ clientX: 100 }],
    })
    fireEvent.touchEnd(mobileCalendar, {
      changedTouches: [{ clientX: 180 }],
    })

    expect(replace).toHaveBeenCalledWith(
      "/dashboard/roster?date=2026-07-26&timezone=Australia%2FMelbourne&view=day",
      { scroll: false }
    )
  })

  it("shows and advances the current-time line in the viewer timezone", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-07-27T02:34:30.000Z"))

    render(
      <RosterCalendar
        dates={dates}
        employees={employees}
        mode="day"
        now="2026-07-27T02:34:30.000Z"
        selectedDate="2026-07-27"
        selectedEmployeeId={null}
        shifts={shifts}
        timezone="Australia/Melbourne"
        timezoneExplicit
        today="2026-07-27"
      />
    )

    expect(
      screen.getAllByRole("timer", { name: "Current time 12:34 pm" })
    ).toHaveLength(2)

    act(() => vi.advanceTimersByTime(30_000))

    expect(
      screen.getAllByRole("timer", { name: "Current time 12:35 pm" })
    ).toHaveLength(2)
  })

  it("fits the complete 24-hour day while keeping a late current time visible", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-07-27T12:30:00.000Z"))

    render(
      <RosterCalendar
        dates={dates}
        employees={employees}
        mode="week"
        now="2026-07-27T12:30:00.000Z"
        selectedDate="2026-07-27"
        selectedEmployeeId={1103}
        shifts={shifts}
        timezone="Australia/Melbourne"
        timezoneExplicit
        today="2026-07-27"
      />
    )

    expect(
      screen.getAllByRole("timer", { name: "Current time 10:30 pm" })
    ).toHaveLength(2)
    for (const rail of screen.getAllByTestId("roster-time-rail")) {
      expect(rail).toHaveAttribute("data-start-hour", "0")
      expect(rail).toHaveAttribute("data-end-hour", "24")
    }
  })

  it("switches initial roster state to the browser timezone", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-07-27T02:00:00.000Z"))
    vi.spyOn(timezone, "detectBrowserTimezone").mockReturnValue(
      "America/Los_Angeles"
    )

    render(
      <RosterCalendar
        dates={dates}
        employees={employees}
        mode="day"
        now="2026-07-27T02:00:00.000Z"
        selectedDate="2026-07-27"
        selectedEmployeeId={null}
        shifts={shifts}
        timezone="Australia/Melbourne"
        timezoneExplicit={false}
        today="2026-07-27"
      />
    )

    expect(replace).toHaveBeenCalledWith(
      "/dashboard/roster?date=2026-07-26&timezone=America%2FLos_Angeles&view=day",
      { scroll: false }
    )
  })
})
