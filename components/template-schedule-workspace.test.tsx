import { cleanup, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import { TemplateScheduleWorkspace } from "@/components/template-schedule-workspace"
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
  })

  it("uses shadcn selects in schedule forms and corners schedule actions", async () => {
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
    ).toHaveTextContent("Daily")
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
