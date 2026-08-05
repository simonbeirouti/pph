import { cleanup, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import { TemplateScheduleWorkspace } from "@/components/templates/template-schedule-workspace"
import type { JobTemplate } from "@/lib/templates/types"

const mobileViewport = vi.hoisted(() => ({ value: false }))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))
vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => mobileViewport.value,
}))
vi.mock("@/app/dashboard/templates/actions", () => ({
  deleteScheduleAction: vi.fn(),
  retryScheduleAction: vi.fn(),
  saveScheduleAction: vi.fn(),
  saveTemplateAction: vi.fn(),
  setScheduleEnabledAction: vi.fn(),
  setTemplateActiveAction: vi.fn(),
}))

const template = (
  overrides: Partial<JobTemplate> & Pick<JobTemplate, "id" | "title">
): JobTemplate => ({
  assigneeMembershipId: 1103,
  createdAt: "2026-07-28T00:00:00.000Z",
  description: "Reusable defaults",
  isActive: true,
  location: "Foyer",
  minimumCompletionPhotos: 2,
  priority: "urgent",
  requiresCompletionNote: true,
  updatedAt: "2026-07-28T00:00:00.000Z",
  ...overrides,
})

const employees = [{ displayName: "Alex Employee", membershipId: 1103 }]

afterEach(() => {
  cleanup()
  mobileViewport.value = false
  vi.clearAllMocks()
})

describe("TemplateScheduleWorkspace", () => {
  it("places inactive templates last and moves card actions into a menu", async () => {
    const user = userEvent.setup()
    render(
      <TemplateScheduleWorkspace
        employees={employees}
        initialView="templates"
        schedules={[]}
        templates={[
          template({ id: 2, isActive: false, title: "Inactive template" }),
          template({ id: 1, title: "Active template" }),
        ]}
        timezone="Australia/Melbourne"
      />
    )

    expect(screen.queryByText("Reusable work")).not.toBeInTheDocument()
    expect(
      screen.getByRole("heading", { name: "Templates & schedules" })
    ).toHaveClass("text-2xl", "font-semibold", "tracking-tight")
    expect(
      screen.getByText(
        "Standardise jobs and generate recurring work in Australia/Melbourne."
      )
    ).toHaveClass("text-muted-foreground")
    expect(
      screen.getByRole("tablist", { name: "Template workspace" })
    ).toBeVisible()
    expect(screen.getByRole("tab", { name: "Templates" })).toHaveAttribute(
      "data-active"
    )
    expect(
      Array.from(document.querySelectorAll('[data-slot="card-title"]')).map(
        (title) => title.textContent
      )
    ).toEqual(["Active template", "Inactive template"])
    expect(
      screen.queryByRole("button", { name: "Edit" })
    ).not.toBeInTheDocument()
    expect(
      screen
        .getByRole("button", {
          name: "Template actions for Active template",
        })
        .closest('[data-slot="card-action"]')
    ).toBeTruthy()

    await user.click(
      screen.getByRole("button", {
        name: "Template actions for Active template",
      })
    )
    await user.click(await screen.findByRole("menuitem", { name: "Edit" }))

    const dialog = screen.getByRole("dialog", { name: "Edit template" })
    const priority = within(dialog).getByRole("combobox", {
      name: "Priority",
    })
    const assignee = within(dialog).getByRole("combobox", {
      name: "Default assignee",
    })
    expect(priority).toHaveTextContent("Urgent")
    expect(assignee).toHaveTextContent("Alex Employee")
    expect(priority).toHaveAttribute("data-slot", "select-trigger")
    expect(priority).toHaveClass("w-full")
    expect(
      dialog.querySelector('[data-template-form-row="location-priority"]')
    ).toHaveClass("grid-cols-2")
    expect(
      dialog.querySelector('[data-template-form-row="assignee-photos"]')
    ).toHaveClass("grid-cols-2")
    const minimumPhotos = within(dialog).getByRole("combobox", {
      name: "Minimum completion photos",
    })
    expect(minimumPhotos).toHaveTextContent("2")
    await user.click(minimumPhotos)
    expect(await screen.findAllByRole("option")).toHaveLength(11)
  })

  it("uses shadcn selects and roster date/time pickers in schedule forms", async () => {
    const user = userEvent.setup()
    render(
      <TemplateScheduleWorkspace
        employees={employees}
        initialView="schedules"
        schedules={[
          {
            assigneeMembershipId: 1103,
            createdAt: "2026-07-28T00:00:00.000Z",
            deletedAt: null,
            endsOn: null,
            id: 1801,
            isEnabled: true,
            localTime: "09:00",
            nextOccurrenceAt: null,
            occurrences: [],
            recurrenceType: "daily",
            startsOn: "2026-07-28",
            templateId: 1,
            timezone: "Australia/Melbourne",
            updatedAt: "2026-07-28T00:00:00.000Z",
            weekdays: [],
          },
        ]}
        templates={[template({ id: 1, title: "Active template" })]}
        timezone="Australia/Melbourne"
      />
    )

    expect(
      screen
        .getByRole("button", { name: "Schedule actions" })
        .closest('[data-slot="card-action"]')
    ).toBeTruthy()

    await user.click(screen.getByRole("button", { name: "New schedule" }))
    const dialog = screen.getByRole("dialog", { name: "New schedule" })
    const selects = within(dialog).getAllByRole("combobox")
    expect(selects).toHaveLength(3)
    expect(
      selects.every((select) => select.dataset.slot === "select-trigger")
    ).toBe(true)
    expect(
      within(dialog).getByRole("combobox", { name: "Template" })
    ).toHaveTextContent("Active template")
    expect(
      within(dialog).getByRole("combobox", { name: "Assignee" })
    ).toHaveTextContent("Alex Employee")
    expect(
      within(dialog).getByRole("combobox", { name: "Repeats" })
    ).toHaveTextContent("Weekly")
    for (const weekday of ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]) {
      expect(
        within(dialog).getByRole("checkbox", { name: weekday })
      ).toBeVisible()
    }
    const localTime = within(dialog).getByLabelText("Local time")
    const startsOn = within(dialog).getByLabelText("Starts on")
    const endsOn = within(dialog).getByLabelText("Ends on")
    expect(localTime).toBeRequired()
    expect(startsOn).toBeRequired()
    expect(endsOn).not.toBeRequired()
    expect(dialog.querySelector('input[type="date"]')).toBeNull()
    expect(dialog.querySelector('input[type="time"]')).toBeNull()
    for (const row of ["template-assignee", "repeat-time", "dates"]) {
      expect(
        dialog.querySelector(`[data-schedule-form-row="${row}"]`)
      ).toHaveClass("grid-cols-2")
    }

    await user.click(
      within(dialog).getByRole("button", { name: "Choose local time" })
    )
    await user.click(
      await screen.findByRole("button", { name: "Set hour to 14" })
    )
    await user.click(screen.getByRole("button", { name: "Set minute to 30" }))
    expect(localTime).toHaveValue("14:30")

    await user.click(
      within(dialog).getByRole("button", { name: "Choose starts on" })
    )
    const calendar = document.querySelector('[data-slot="calendar"]')
    expect(calendar).not.toBeNull()
    const availableDays = Array.from(
      calendar!.querySelectorAll<HTMLButtonElement>("button[data-day]")
    ).filter((button) => !button.disabled)
    expect(availableDays.length).toBeGreaterThan(0)
    await user.click(availableDays.at(-1)!)
    expect((startsOn as HTMLInputElement).value).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it("opens template forms in a bottom drawer on mobile", async () => {
    mobileViewport.value = true
    const user = userEvent.setup()
    render(
      <TemplateScheduleWorkspace
        employees={employees}
        initialView="templates"
        schedules={[]}
        templates={[]}
        timezone="Australia/Melbourne"
      />
    )

    await user.click(screen.getByRole("button", { name: "New template" }))

    expect(screen.getByRole("dialog", { name: "New template" })).toBeVisible()
    expect(document.querySelector('[data-slot="drawer-popup"]')).toBeTruthy()
    expect(document.querySelector('[data-slot="dialog-content"]')).toBeNull()
  })
})
