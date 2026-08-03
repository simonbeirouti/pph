import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import { RosterCalendar } from "@/components/roster-calendar"
import type { RosterAssignableJob, RosterShift } from "@/lib/roster/types"

const replace = vi.fn()
const push = vi.fn()
const mobileViewport = vi.hoisted(() => ({ value: false }))
const updateCalendarRosterShiftAction = vi.hoisted(() =>
  vi.fn(async () => ({ message: "Shift updated.", ok: true }))
)
const setCalendarRosterShiftLockAction = vi.hoisted(() =>
  vi.fn(async () => ({ message: "Shift locked.", ok: true }))
)
const archiveEmployeeRosterShiftAction = vi.hoisted(() =>
  vi.fn(async () => ({ message: "Shift deleted.", ok: true }))
)
vi.mock("@/app/dashboard/roster/actions", () => ({
  createCalendarRosterShiftAction: vi.fn(),
  editCalendarRosterShiftAction: vi.fn(),
  setCalendarRosterShiftLockAction,
  updateCalendarRosterShiftAction,
}))
vi.mock("@/app/dashboard/employees/roster-actions", () => ({
  archiveEmployeeRosterShiftAction,
}))
vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => mobileViewport.value,
}))
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh: vi.fn(), replace }),
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
  lockedAt: null,
  lockedByMembershipId: null,
  notes: index ? "Close the site" : "Open the site",
  organisationId: 1001,
  startsAt: `2026-07-27T0${index}:00:00.000Z`,
  updatedAt: "2026-07-26T00:00:00.000Z",
}))
const jobs: RosterAssignableJob[] = [
  {
    assigneeMembershipId: null,
    dueAt: null,
    id: 1701,
    scheduledAt: null,
    title: "Inspect loading bay",
  },
]

afterEach(() => {
  cleanup()
  mobileViewport.value = false
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.clearAllMocks()
})

describe("RosterCalendar", () => {
  it("renders Team week with shared day canvases and a sticky rail", () => {
    render(
      <RosterCalendar
        dates={dates}
        employees={employees}
        mode="team"
        now="2026-07-27T02:00:00.000Z"
        selectedDate="2026-07-27"
        selectedEmployeeId={null}
        shifts={shifts}
        timezone="Australia/Melbourne"
        today="2026-07-27"
      />
    )

    expect(screen.getByRole("heading", { name: "Roster" })).toBeVisible()
    const employeeFilter = screen.getByRole("combobox", {
      name: "Filter employee",
    })
    expect(employeeFilter).toHaveTextContent("All team")
    expect(employeeFilter).toHaveClass("w-full", "sm:w-56")
    expect(employeeFilter).not.toHaveClass("max-w-56")
    expect(screen.queryByText("Employee week")).not.toBeInTheDocument()
    const primaryActions = document.querySelector<HTMLElement>(
      "[data-roster-primary-actions]"
    )
    const secondaryActions = document.querySelector<HTMLElement>(
      "[data-roster-secondary-actions]"
    )
    expect(primaryActions).toContainElement(
      screen.getByRole("heading", { name: "Roster" })
    )
    expect(primaryActions).toContainElement(
      screen.getByRole("button", { name: "Add shift" })
    )
    expect(primaryActions).toContainElement(secondaryActions)
    expect(primaryActions).toHaveClass(
      "flex-col",
      "sm:flex-row",
      "sm:items-center"
    )
    expect(screen.getByRole("button", { name: "Add shift" })).toHaveClass(
      "w-full",
      "sm:w-auto"
    )
    expect(secondaryActions).toContainElement(
      screen.getByRole("combobox", { name: "Filter employee" })
    )
    expect(secondaryActions).toContainElement(
      screen.getByRole("button", { name: "Today" })
    )
    expect(secondaryActions).toHaveClass("justify-end")
    expect(screen.getAllByTestId("roster-time-rail")[0]).toHaveClass(
      "sticky",
      "left-0"
    )
    expect(screen.getAllByLabelText("Day 1 team shift canvas")).toHaveLength(2)
    expect(screen.queryByTestId("employee-lanes")).not.toBeInTheDocument()
  })

  it("layers overlapping team shifts with longer shifts underneath", () => {
    const longShift = {
      ...shifts[0],
      endsAt: "2026-07-27T04:00:00.000Z",
      notes: "Long coverage",
    }
    render(
      <RosterCalendar
        dates={dates}
        employees={employees}
        mode="team"
        now="2026-07-27T02:00:00.000Z"
        selectedDate="2026-07-27"
        selectedEmployeeId={null}
        shifts={[longShift, shifts[1]]}
        timezone="Australia/Melbourne"
        today="2026-07-27"
      />
    )

    const calendar = screen.getAllByRole("region", {
      name: "Roster grid",
    })[0]
    const longBlock = within(calendar).getByRole("button", {
      name: /Alex Employee.+Long coverage/,
    })
    const shortBlock = within(calendar).getByRole("button", {
      name: /Morgan Worker.+Close the site/,
    })
    const longContainer = longBlock.closest("[data-shift-block]") as HTMLElement
    const shortContainer = shortBlock.closest(
      "[data-shift-block]"
    ) as HTMLElement
    expect(longContainer).toHaveAttribute("data-stack-layer", "0")
    expect(shortContainer).toHaveAttribute("data-stack-layer", "1")
    expect(Number(longContainer.style.zIndex)).toBeLessThan(
      Number(shortContainer.style.zIndex)
    )
    expect(shortContainer.style.left).not.toBe(longContainer.style.left)
    expect(shortContainer.getAttribute("style")).toContain("transparent")
    expect(within(longBlock).getByText("Alex Employee")).toBeVisible()
    expect(within(shortBlock).getByText("Morgan Worker")).toBeVisible()
  })

  it("filters the Team week and preselects that employee for creation", () => {
    render(
      <RosterCalendar
        dates={dates}
        employees={employees}
        mode="team"
        now="2026-07-27T02:00:00.000Z"
        selectedDate="2026-07-27"
        selectedEmployeeId={1103}
        shifts={shifts}
        timezone="Australia/Melbourne"
        today="2026-07-27"
      />
    )

    expect(
      screen.getByRole("combobox", { name: "Filter employee" })
    ).toHaveTextContent("Alex Employee")
    expect(
      screen.queryByRole("button", { name: /Morgan Worker/ })
    ).not.toBeInTheDocument()

    const calendar = screen.getAllByRole("region", {
      name: "Roster grid",
    })[0]
    const emptyTuesdayLane = calendar.querySelector<HTMLElement>(
      '[data-roster-date="2026-07-28"] [data-team-shift-canvas]'
    )
    expect(emptyTuesdayLane).not.toBeNull()
    vi.spyOn(emptyTuesdayLane!, "getBoundingClientRect").mockReturnValue({
      bottom: 1_440,
      height: 1_440,
      left: 0,
      right: 200,
      toJSON: () => ({}),
      top: 0,
      width: 200,
      x: 0,
      y: 0,
    })
    fireEvent.pointerDown(emptyTuesdayLane!, {
      button: 0,
      clientX: 100,
      clientY: 540,
      isPrimary: true,
      pointerId: 3,
    })
    fireEvent.pointerUp(emptyTuesdayLane!, {
      button: 0,
      clientX: 100,
      clientY: 600,
      isPrimary: true,
      pointerId: 3,
    })

    const dialog = screen.getByRole("dialog", { name: "Add roster shift" })
    expect(within(dialog).getByLabelText("Date")).toHaveValue("2026-07-28")
    expect(
      within(dialog).getByRole("combobox", { name: "Employee" })
    ).toHaveTextContent("Alex Employee")
    expect(
      dialog.querySelector('[data-roster-create-row="employee-date"]')
    ).toHaveClass("grid-cols-2")
    expect(
      within(dialog).getByRole("button", { name: "Create shift" })
    ).toHaveClass("w-full")
  })

  it("keeps an employee roster self-scoped and read-only with allocated jobs", async () => {
    const user = userEvent.setup()
    render(
      <RosterCalendar
        dates={dates}
        employees={[employees[0]]}
        jobs={[
          {
            assigneeMembershipId: 1103,
            dueAt: shifts[0].endsAt,
            id: 1702,
            scheduledAt: shifts[0].startsAt,
            title: "Inspect loading bay",
          },
        ]}
        mode="week"
        now="2026-07-27T02:00:00.000Z"
        readOnly
        selectedDate="2026-07-27"
        selectedEmployeeId={1103}
        shifts={[shifts[0]]}
        timezone="Australia/Melbourne"
        today="2026-07-27"
      />
    )

    expect(
      screen.getByText("Your read-only weekly roster and allocated jobs.")
    ).toBeVisible()
    expect(
      screen.queryByRole("button", { name: "Add shift" })
    ).not.toBeInTheDocument()
    expect(screen.queryByText("Team week")).not.toBeInTheDocument()
    expect(
      screen.queryByRole("combobox", { name: "Filter employee" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /Resize Alex Employee shift/ })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByLabelText("Morgan Worker shift lane")
    ).not.toBeInTheDocument()

    const calendar = screen.getAllByRole("region", {
      name: "Roster grid",
    })[0]
    await user.click(
      within(calendar).getByRole("button", {
        name: /Alex Employee.+Open the site/,
      })
    )
    const dialog = screen.getByRole("dialog", { name: "Alex Employee" })
    expect(
      within(dialog).getByRole("link", { name: "Inspect loading bay" })
    ).toHaveAttribute("href", "/dashboard/jobs?job=1702")
  })

  it("opens complete shift details from a narrow shift block", async () => {
    const user = userEvent.setup()
    render(
      <RosterCalendar
        dates={dates}
        employees={employees}
        mode="team"
        now="2026-07-27T02:00:00.000Z"
        selectedDate="2026-07-27"
        selectedEmployeeId={null}
        shifts={shifts}
        timezone="Australia/Melbourne"
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

  it("opens owner actions on right click and duplicates shift details", async () => {
    const user = userEvent.setup()
    render(
      <RosterCalendar
        dates={dates}
        employees={employees}
        mode="team"
        now="2026-07-27T02:00:00.000Z"
        selectedDate="2026-07-27"
        selectedEmployeeId={null}
        shifts={shifts}
        timezone="Australia/Melbourne"
        today="2026-07-27"
      />
    )

    const calendar = screen.getAllByRole("region", {
      name: "Roster grid",
    })[0]
    fireEvent.contextMenu(
      within(calendar).getByRole("button", {
        name: /Alex Employee.+Open the site/,
      })
    )

    expect(await screen.findByText("Lock shift")).toBeVisible()
    expect(screen.getByText("Duplicate")).toBeVisible()
    expect(screen.getByText("Edit")).toBeVisible()
    expect(screen.getByText("Delete")).toBeVisible()
    await user.click(screen.getByText("Lock shift"))
    await waitFor(() =>
      expect(setCalendarRosterShiftLockAction).toHaveBeenCalledWith({
        employeeMembershipId: 1103,
        locked: true,
        shiftId: 1500,
        updatedAt: "2026-07-26T00:00:00.000Z",
      })
    )
    fireEvent.contextMenu(
      within(calendar).getByRole("button", {
        name: /Alex Employee.+Open the site/,
      })
    )
    await user.click(screen.getByText("Duplicate"))

    const dialog = screen.getByRole("dialog", { name: "Add roster shift" })
    expect(
      within(dialog).getByRole("combobox", { name: "Employee" })
    ).toHaveTextContent("Alex Employee")
    expect(within(dialog).getByLabelText("Notes")).toHaveValue("Open the site")
  })

  it("keeps locked shifts selectable while disabling mutation actions", async () => {
    const lockedShift = {
      ...shifts[0],
      lockedAt: "2026-07-26T01:00:00.000Z",
      lockedByMembershipId: 1101,
    }
    render(
      <RosterCalendar
        dates={dates}
        employees={employees}
        mode="team"
        now="2026-07-27T02:00:00.000Z"
        selectedDate="2026-07-27"
        selectedEmployeeId={null}
        shifts={[lockedShift]}
        timezone="Australia/Melbourne"
        today="2026-07-27"
      />
    )

    const calendar = screen.getAllByRole("region", {
      name: "Roster grid",
    })[0]
    const shiftButton = within(calendar).getByRole("button", {
      name: /Alex Employee.+Open the site/,
    })
    expect(
      within(calendar).queryByRole("button", {
        name: /Resize Alex Employee shift/,
      })
    ).not.toBeInTheDocument()

    fireEvent.contextMenu(shiftButton)
    expect(await screen.findByText("Unlock shift")).toBeVisible()
    expect(screen.getByRole("menuitem", { name: "Duplicate" })).toBeEnabled()
    expect(screen.getByRole("menuitem", { name: "Edit" })).toBeDisabled()
    expect(screen.getByRole("menuitem", { name: "Delete" })).toBeDisabled()
  })

  it("keeps employee and the editable calendar date in one row", async () => {
    const user = userEvent.setup()
    render(
      <RosterCalendar
        dates={dates}
        employees={employees}
        mode="team"
        now="2026-07-27T02:00:00.000Z"
        selectedDate="2026-07-27"
        selectedEmployeeId={null}
        shifts={shifts}
        timezone="Australia/Melbourne"
        today="2026-07-27"
      />
    )

    const calendar = screen.getAllByRole("region", {
      name: "Roster grid",
    })[0]
    fireEvent.contextMenu(
      within(calendar).getByRole("button", {
        name: /Alex Employee.+Open the site/,
      })
    )
    await user.click(screen.getByRole("menuitem", { name: "Edit" }))

    const dialog = screen.getByRole("dialog", { name: "Edit roster shift" })
    const employee = within(dialog).getByRole("combobox", {
      name: "Employee",
    })
    const date = within(dialog).getByRole("textbox", { name: "Date" })
    const sharedRow = employee.closest(".grid-cols-2")
    expect(sharedRow).not.toBeNull()
    expect(sharedRow).toContainElement(date)

    await user.click(date)
    await user.clear(date)
    await user.type(date, "2026-07-29")
    expect(date).toHaveValue("2026-07-29")
    const calendarPopup = document.querySelector(
      '[data-slot="popover-content"]'
    )
    expect(document.querySelector('[data-slot="calendar"]')).toBeVisible()
    expect(calendarPopup).toHaveAttribute("data-side", "bottom")
    const saveFooter = within(dialog).getByRole("button", {
      name: "Save shift",
    }).parentElement
    expect(saveFooter).not.toHaveClass("border-t", "bg-muted/50")
  })

  it("opens exact creation details after a desktop range drag", () => {
    render(
      <RosterCalendar
        dates={dates}
        employees={employees}
        jobs={jobs}
        mode="team"
        now="2026-07-27T02:00:00.000Z"
        selectedDate="2026-07-27"
        selectedEmployeeId={null}
        shifts={shifts}
        timezone="Australia/Melbourne"
        today="2026-07-27"
      />
    )

    const calendar = screen.getAllByRole("region", {
      name: "Roster grid",
    })[0]
    const lane = within(calendar).getByLabelText("Day 1 team shift canvas")
    vi.spyOn(lane, "getBoundingClientRect").mockReturnValue({
      bottom: 1_440,
      height: 1_440,
      left: 0,
      right: 200,
      toJSON: () => ({}),
      top: 0,
      width: 200,
      x: 0,
      y: 0,
    })

    fireEvent.pointerDown(lane, {
      button: 0,
      clientX: 100,
      clientY: 660,
      isPrimary: true,
      pointerId: 1,
    })
    fireEvent.pointerMove(lane, {
      clientX: 100,
      clientY: 547,
      isPrimary: true,
      pointerId: 1,
    })
    fireEvent.pointerUp(lane, {
      button: 0,
      clientX: 100,
      clientY: 547,
      isPrimary: true,
      pointerId: 1,
    })

    const dialog = screen.getByRole("dialog", { name: "Add roster shift" })
    expect(within(dialog).getByLabelText("Date")).toHaveValue("2026-07-27")
    expect(within(dialog).getByLabelText("Start")).toHaveValue("09:00")
    expect(within(dialog).getByLabelText("End")).toHaveValue("11:00")
    expect(
      within(dialog).getByRole("combobox", { name: "Employee" })
    ).toHaveTextContent("Choose employee")
    expect(within(dialog).getByText("Inspect loading bay")).toBeVisible()
  })

  it("starts a new range over an existing shift while Alt is held", () => {
    render(
      <RosterCalendar
        dates={dates}
        employees={employees}
        mode="team"
        now="2026-07-27T02:00:00.000Z"
        selectedDate="2026-07-27"
        selectedEmployeeId={null}
        shifts={shifts}
        timezone="Australia/Melbourne"
        today="2026-07-27"
      />
    )

    const calendar = screen.getAllByRole("region", {
      name: "Roster grid",
    })[0]
    const canvas = within(calendar).getByLabelText("Day 1 team shift canvas")
    const day = canvas.closest("[data-roster-date]") as HTMLElement
    const existingShift = within(calendar).getByRole("button", {
      name: /Alex Employee.+Open the site/,
    })
    vi.spyOn(day, "getBoundingClientRect").mockReturnValue({
      bottom: 1_440,
      height: 1_440,
      left: 0,
      right: 200,
      toJSON: () => ({}),
      top: 0,
      width: 200,
      x: 0,
      y: 0,
    })

    fireEvent.pointerDown(existingShift, {
      button: 0,
      clientX: 100,
      clientY: 630,
      altKey: true,
      isPrimary: true,
      pointerId: 4,
    })
    fireEvent.pointerMove(existingShift, {
      clientX: 100,
      clientY: 690,
      altKey: true,
      isPrimary: true,
      pointerId: 4,
    })
    fireEvent.pointerUp(existingShift, {
      button: 0,
      clientX: 100,
      clientY: 690,
      altKey: true,
      isPrimary: true,
      pointerId: 4,
    })

    expect(
      screen.getByRole("dialog", { name: "Add roster shift" })
    ).toBeVisible()
    expect(
      screen.queryByRole("dialog", { name: "Alex Employee" })
    ).not.toBeInTheDocument()
  })

  it("moves an existing shift by a snapped calendar hour", async () => {
    render(
      <RosterCalendar
        dates={dates}
        employees={employees}
        mode="team"
        now="2026-07-27T02:00:00.000Z"
        selectedDate="2026-07-27"
        selectedEmployeeId={null}
        shifts={shifts}
        timezone="Australia/Melbourne"
        today="2026-07-27"
      />
    )

    const calendar = screen.getAllByRole("region", {
      name: "Roster grid",
    })[0]
    const canvas = within(calendar).getByLabelText("Day 1 team shift canvas")
    const day = canvas.closest("[data-roster-date]") as HTMLElement
    const shift = within(calendar).getByRole("button", {
      name: /Alex Employee.+Open the site/,
    })
    vi.spyOn(day, "getBoundingClientRect").mockReturnValue({
      bottom: 1_440,
      height: 1_440,
      left: 0,
      right: 200,
      toJSON: () => ({}),
      top: 0,
      width: 200,
      x: 0,
      y: 0,
    })

    fireEvent.pointerDown(shift, {
      button: 0,
      clientX: 100,
      clientY: 600,
      isPrimary: true,
      pointerId: 5,
    })
    fireEvent.pointerMove(shift, {
      clientX: 100,
      clientY: 660,
      isPrimary: true,
      pointerId: 5,
    })
    fireEvent.pointerUp(shift, {
      button: 0,
      clientX: 100,
      clientY: 660,
      isPrimary: true,
      pointerId: 5,
    })

    await waitFor(() =>
      expect(updateCalendarRosterShiftAction).toHaveBeenCalledWith({
        employeeMembershipId: 1103,
        endsAt: "2026-07-27T03:00:00.000Z",
        shiftId: 1500,
        startsAt: "2026-07-27T01:00:00.000Z",
        updatedAt: "2026-07-26T00:00:00.000Z",
      })
    )
  })

  it.each([
    {
      edge: "start",
      expectedEndsAt: "2026-07-27T02:00:00.000Z",
      expectedStartsAt: "2026-07-27T01:00:00.000Z",
    },
    {
      edge: "end",
      expectedEndsAt: "2026-07-27T03:00:00.000Z",
      expectedStartsAt: "2026-07-27T00:00:00.000Z",
    },
  ])(
    "resizes an existing shift from its $edge edge",
    async ({ edge, expectedEndsAt, expectedStartsAt }) => {
      render(
        <RosterCalendar
          dates={dates}
          employees={employees}
          mode="team"
          now="2026-07-27T02:00:00.000Z"
          selectedDate="2026-07-27"
          selectedEmployeeId={null}
          shifts={shifts}
          timezone="Australia/Melbourne"
          today="2026-07-27"
        />
      )

      const calendar = screen.getAllByRole("region", {
        name: "Roster grid",
      })[0]
      const canvas = within(calendar).getByLabelText("Day 1 team shift canvas")
      const day = canvas.closest("[data-roster-date]") as HTMLElement
      const handle = within(calendar).getByRole("button", {
        name: `Resize Alex Employee shift ${edge}`,
      })
      vi.spyOn(day, "getBoundingClientRect").mockReturnValue({
        bottom: 1_440,
        height: 1_440,
        left: 0,
        right: 200,
        toJSON: () => ({}),
        top: 0,
        width: 200,
        x: 0,
        y: 0,
      })

      fireEvent.pointerDown(handle, {
        button: 0,
        clientX: 100,
        clientY: edge === "start" ? 600 : 720,
        isPrimary: true,
        pointerId: 6,
      })
      fireEvent.pointerMove(handle, {
        clientX: 100,
        clientY: edge === "start" ? 660 : 780,
        isPrimary: true,
        pointerId: 6,
      })
      fireEvent.pointerUp(handle, {
        button: 0,
        clientX: 100,
        clientY: edge === "start" ? 660 : 780,
        isPrimary: true,
        pointerId: 6,
      })

      await waitFor(() =>
        expect(updateCalendarRosterShiftAction).toHaveBeenCalledWith({
          employeeMembershipId: 1103,
          endsAt: expectedEndsAt,
          shiftId: 1500,
          startsAt: expectedStartsAt,
          updatedAt: "2026-07-26T00:00:00.000Z",
        })
      )
    }
  )

  it("opens an exact form from the keyboard-accessible Add shift button", async () => {
    const user = userEvent.setup()
    render(
      <RosterCalendar
        dates={dates}
        employees={employees}
        jobs={jobs}
        mode="team"
        now="2026-07-27T02:00:00.000Z"
        selectedDate="2026-07-27"
        selectedEmployeeId={null}
        shifts={shifts}
        timezone="Australia/Melbourne"
        today="2026-07-27"
      />
    )

    await user.click(screen.getByRole("button", { name: "Add shift" }))

    const dialog = screen.getByRole("dialog", { name: "Add roster shift" })
    expect(within(dialog).getByLabelText("Date")).toHaveValue("2026-07-27")
    expect(within(dialog).getByLabelText("Start")).toHaveValue("09:00")
    expect(within(dialog).getByLabelText("End")).toHaveValue("10:00")
    expect(
      within(dialog).getByRole("combobox", { name: "Employee" })
    ).toHaveTextContent("Choose employee")
  })

  it("uses the themed picker for exact roster times", async () => {
    const user = userEvent.setup()
    render(
      <RosterCalendar
        dates={dates}
        employees={employees}
        jobs={jobs}
        mode="team"
        now="2026-07-27T02:00:00.000Z"
        selectedDate="2026-07-27"
        selectedEmployeeId={null}
        shifts={shifts}
        timezone="Australia/Melbourne"
        today="2026-07-27"
      />
    )

    await user.click(screen.getByRole("button", { name: "Add shift" }))

    const dialog = screen.getByRole("dialog", { name: "Add roster shift" })
    const start = within(dialog).getByLabelText("Start")
    expect(start).not.toHaveAttribute("type", "time")
    await user.click(
      within(dialog).getByRole("button", { name: "Choose start time" })
    )
    await user.click(screen.getByRole("button", { name: "Set hour to 10" }))
    const minuteOption = screen.getByRole("button", {
      name: "Set minute to 15",
    })
    expect(minuteOption).toHaveClass("w-full")
    expect(
      screen.queryByRole("button", { name: "Set minute to 13" })
    ).not.toBeInTheDocument()
    await user.click(minuteOption)

    expect(start).toHaveValue("10:15")
  })

  it("opens the date calendar from anywhere in the roster date field", async () => {
    const user = userEvent.setup()
    render(
      <RosterCalendar
        dates={dates}
        employees={employees}
        jobs={jobs}
        mode="team"
        now="2026-07-27T02:00:00.000Z"
        selectedDate="2026-07-27"
        selectedEmployeeId={null}
        shifts={shifts}
        timezone="Australia/Melbourne"
        today="2026-07-27"
      />
    )

    await user.click(screen.getByRole("button", { name: "Add shift" }))

    const dialog = screen.getByRole("dialog", { name: "Add roster shift" })
    await user.click(within(dialog).getByLabelText("Date"))

    expect(document.querySelector('[data-slot="calendar"]')).toBeVisible()
  })

  it("uses a bottom drawer for roster forms on mobile", async () => {
    mobileViewport.value = true
    const user = userEvent.setup()
    render(
      <RosterCalendar
        dates={dates}
        employees={employees}
        jobs={jobs}
        mode="team"
        now="2026-07-27T02:00:00.000Z"
        selectedDate="2026-07-27"
        selectedEmployeeId={null}
        shifts={shifts}
        timezone="Australia/Melbourne"
        today="2026-07-27"
      />
    )

    await user.click(screen.getByRole("button", { name: "Add shift" }))

    const drawer = screen
      .getByRole("dialog", { name: "Add roster shift" })
      .closest('[data-slot="drawer-popup"]')
    expect(drawer).not.toBeNull()
    expect(drawer).toHaveAttribute("data-swipe-direction", "down")
  })

  it("opens a one-hour default when mobile empty time is tapped", () => {
    render(
      <RosterCalendar
        dates={dates}
        employees={employees}
        jobs={jobs}
        mode="team"
        now="2026-07-27T02:00:00.000Z"
        selectedDate="2026-07-27"
        selectedEmployeeId={null}
        shifts={shifts}
        timezone="Australia/Melbourne"
        today="2026-07-27"
      />
    )

    const calendar = screen.getAllByRole("region", {
      name: "Roster grid",
    })[1]
    const lane = within(calendar).getByLabelText("Day 1 team shift canvas")
    vi.spyOn(lane, "getBoundingClientRect").mockReturnValue({
      bottom: 1_440,
      height: 1_440,
      left: 0,
      right: 200,
      toJSON: () => ({}),
      top: 0,
      width: 200,
      x: 0,
      y: 0,
    })

    fireEvent.click(lane, { clientX: 100, clientY: 600 })

    const dialog = screen.getByRole("dialog", { name: "Add roster shift" })
    expect(within(dialog).getByLabelText("Start")).toHaveValue("10:00")
    expect(within(dialog).getByLabelText("End")).toHaveValue("11:00")
    expect(
      within(dialog).getByRole("combobox", { name: "Employee" })
    ).toHaveTextContent("Choose employee")
  })

  it("loads the adjacent week when swiping beyond a mobile boundary", () => {
    render(
      <RosterCalendar
        dates={dates}
        employees={employees}
        mode="team"
        now="2026-07-27T02:00:00.000Z"
        selectedDate="2026-07-27"
        selectedEmployeeId={null}
        shifts={shifts}
        timezone="Australia/Melbourne"
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
      "/dashboard/roster?date=2026-07-26&view=team",
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
        mode="team"
        now="2026-07-27T02:34:30.000Z"
        selectedDate="2026-07-27"
        selectedEmployeeId={null}
        shifts={shifts}
        timezone="Australia/Melbourne"
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
})
