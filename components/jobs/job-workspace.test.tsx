import {
  act,
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  createJobAction,
  deleteJobAction,
  reassignJobAction,
} from "@/app/dashboard/jobs/actions"
import { AssignmentDialog, JobWorkspace } from "@/components/jobs/job-workspace"
import type { JobBoardEmployee, JobCard } from "@/lib/jobs/types"

const viewportMocks = vi.hoisted(() => ({
  mobile: false,
}))
const toastMocks = vi.hoisted(() => ({
  error: vi.fn(),
}))

vi.mock("@/app/dashboard/jobs/actions", () => ({
  createJobAction: vi.fn(),
  deleteJobAction: vi.fn(),
  reassignJobAction: vi.fn(),
  updateJobAction: vi.fn(),
}))
vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => viewportMocks.mobile,
}))
vi.mock("sonner", () => ({
  toast: toastMocks,
}))

const employees: JobBoardEmployee[] = [
  {
    active: true,
    avatarUrl: null,
    displayName: "Alex Employee",
    jobTitle: "Operator",
    membershipId: 1103,
  },
  {
    active: false,
    avatarUrl: null,
    displayName: "Casey Inactive",
    jobTitle: "Former operator",
    membershipId: 1104,
  },
]

const job: JobCard = {
  assigneeMembershipId: 1103,
  description: "Check the loading bay.",
  dueAt: "2026-07-27T02:00:00.000Z",
  id: 1401,
  location: "Loading bay",
  minimumCompletionPhotos: 0,
  priority: "normal",
  requiresCompletionNote: false,
  scheduledAt: null,
  status: "assigned",
  title: "Inspect loading bay",
  updatedAt: "2026-07-27T00:00:00.000Z",
}

const rosterShifts = [
  {
    employeeMembershipId: 1103,
    endsAt: "2026-07-28T07:00:00.000Z",
    id: 1501,
    startsAt: "2026-07-27T23:07:00.000Z",
  },
]

afterEach(() => {
  cleanup()
  viewportMocks.mobile = false
  vi.clearAllMocks()
})

describe("JobWorkspace", () => {
  it("offers Edit and Delete from the job actions menu and deletes after confirmation", async () => {
    const user = userEvent.setup()
    vi.mocked(deleteJobAction).mockResolvedValue({
      message: "Job deleted.",
      ok: true,
    })
    render(
      <JobWorkspace
        employees={employees}
        initialJobs={[job]}
        rosterShifts={rosterShifts}
        timezone="Australia/Melbourne"
      />
    )

    await user.click(
      screen.getByRole("button", {
        name: "Job actions for Inspect loading bay",
      })
    )
    expect(await screen.findByRole("menuitem", { name: "Edit" })).toBeVisible()
    await user.click(screen.getByRole("menuitem", { name: "Delete" }))
    expect(
      screen.getByRole("alertdialog", { name: "Delete job?" })
    ).toBeVisible()
    await user.click(screen.getByRole("button", { name: "Delete job" }))

    await waitFor(() => {
      expect(deleteJobAction).toHaveBeenCalledWith(1401)
    })
    expect(
      screen.queryByLabelText("Job Inspect loading bay")
    ).not.toBeInTheDocument()
  })

  it("prefills template defaults while keeping every job field editable", async () => {
    const user = userEvent.setup()
    render(
      <JobWorkspace
        employees={employees}
        initialJobs={[]}
        templates={[
          {
            assigneeMembershipId: 1103,
            description: "Template description",
            id: 1701,
            location: "Front foyer",
            minimumCompletionPhotos: 3,
            priority: "high",
            requiresCompletionNote: true,
            title: "Template title",
          },
        ]}
        timezone="Australia/Melbourne"
      />
    )

    await user.click(
      screen.getByRole("button", { name: "Start job from template" })
    )
    await user.click(
      await screen.findByRole("menuitem", { name: "Template title" })
    )
    const dialog = screen.getByRole("dialog", { name: "Create job" })

    expect(within(dialog).getByLabelText("Title")).toHaveValue("Template title")
    expect(within(dialog).getByLabelText("Description")).toHaveValue(
      "Template description"
    )
    expect(within(dialog).getByLabelText("Location")).toHaveValue("Front foyer")
    expect(
      within(dialog).getByRole("combobox", {
        name: "Minimum completion photos",
      })
    ).toHaveTextContent("3")
    expect(
      within(dialog).getByRole("combobox", { name: "Priority" })
    ).toHaveTextContent("High")
    expect(
      within(dialog).getByRole("combobox", { name: "Assignee" })
    ).toHaveTextContent("Alex Employee")
    expect(
      within(dialog).getByRole("checkbox", {
        name: "Require note",
      })
    ).toBeChecked()
    expect(
      within(dialog).queryByRole("combobox", { name: "Template" })
    ).not.toBeInTheDocument()
    for (const row of [
      "location-priority",
      "assignee-shift",
      "schedule-due",
      "requirements",
    ]) {
      expect(dialog.querySelector(`[data-job-form-row="${row}"]`)).toHaveClass(
        "grid-cols-2"
      )
    }

    await user.clear(within(dialog).getByLabelText("Title"))
    await user.type(within(dialog).getByLabelText("Title"), "Overridden title")
    expect(within(dialog).getByLabelText("Title")).toHaveValue(
      "Overridden title"
    )
  })

  it("uses a capped scrollable drawer for mobile job creation", async () => {
    viewportMocks.mobile = true
    const user = userEvent.setup()
    const { container } = render(
      <JobWorkspace
        employees={employees}
        initialJobs={[]}
        timezone="Australia/Melbourne"
      />
    )

    await user.click(screen.getByRole("button", { name: "Create job" }))

    const drawer = container.ownerDocument.querySelector(
      '[data-slot="drawer-popup"]'
    )
    expect(drawer).toHaveClass(
      "[--drawer-content-max-height:calc(100dvh-1rem)]"
    )
    expect(drawer).not.toHaveStyle({
      height: "calc(100dvh - 1rem)",
    })
    expect(drawer?.getAttribute("style")).not.toContain(
      "--drawer-content-height"
    )
    expect(
      container.ownerDocument.querySelector('[data-slot="drawer-content"]')
    ).toHaveClass("min-h-0", "overflow-y-auto")
    expect(screen.getByRole("dialog", { name: "Create job" })).toBeVisible()
    expect(
      within(screen.getByRole("dialog", { name: "Create job" }))
        .getByRole("checkbox", { name: "Require note" })
        .closest('[data-slot="field"]')
    ).toHaveClass("h-8", "self-end")
  })

  it("toasts specific validation issues and only marks invalid controls", async () => {
    vi.mocked(createJobAction).mockResolvedValue({
      errors: {
        assigneeMembershipId: ["Choose an active assignee."],
        dueAt: ["Make sure the due time is after the scheduled time."],
      },
      message: "Check the highlighted fields.",
      ok: false,
      values: {
        assigneeMembershipId: "1103",
        dueAt: "2026-07-31T10:00",
        title: "Clean the yard",
      },
    })
    const user = userEvent.setup()
    render(
      <JobWorkspace
        employees={employees}
        initialJobs={[]}
        timezone="Australia/Melbourne"
      />
    )

    await user.click(screen.getByRole("button", { name: "Create job" }))
    const dialog = screen.getByRole("dialog", { name: "Create job" })
    await user.type(within(dialog).getByLabelText("Title"), "Clean the yard")
    await user.click(within(dialog).getByRole("button", { name: "Create job" }))

    await waitFor(() =>
      expect(toastMocks.error).toHaveBeenCalledWith(
        "Choose an active assignee. Make sure the due time is after the scheduled time."
      )
    )
    expect(within(dialog).queryByRole("alert")).not.toBeInTheDocument()
    expect(
      within(dialog).getByRole("combobox", { name: "Assignee" })
    ).toHaveAttribute("aria-invalid", "true")
    expect(within(dialog).getByRole("button", { name: "Due" })).toHaveAttribute(
      "aria-invalid",
      "true"
    )
    expect(within(dialog).getByLabelText("Title")).toHaveAttribute(
      "aria-invalid",
      "false"
    )
    expect(
      within(dialog).queryByText("Choose an active assignee.")
    ).not.toBeInTheDocument()
  })

  it("schedules a job from the selected employee's rostered shift", async () => {
    const user = userEvent.setup()
    render(
      <JobWorkspace
        employees={employees}
        initialJobs={[]}
        rosterShifts={rosterShifts}
        timezone="Australia/Melbourne"
      />
    )

    await user.click(screen.getByRole("button", { name: "Create job" }))
    const dialog = screen.getByRole("dialog", { name: "Create job" })
    expect(
      within(dialog).getByRole("combobox", { name: "Rostered shift" })
    ).toBeDisabled()

    await user.click(within(dialog).getByRole("combobox", { name: "Assignee" }))
    await user.click(
      await screen.findByRole("option", { name: "Alex Employee" })
    )
    await user.click(
      within(dialog).getByRole("combobox", { name: "Rostered shift" })
    )
    await user.click(
      await screen.findByRole("option", {
        name: /Tue, 28 July · 9:07 am–5:00 pm/,
      })
    )

    expect(
      within(dialog).getByRole("button", { name: "Scheduled" })
    ).toHaveTextContent("28 July 2026 at 09:07")
    expect(
      within(dialog).getByRole("button", { name: "Due" })
    ).toHaveTextContent("28 July 2026 at 17:00")
  })

  it("opens scheduled date and time choices above their control", async () => {
    const user = userEvent.setup()
    render(
      <JobWorkspace
        employees={employees}
        initialJobs={[]}
        timezone="Australia/Melbourne"
      />
    )

    await user.click(screen.getByRole("button", { name: "Create job" }))
    const dialog = screen.getByRole("dialog", { name: "Create job" })
    await user.click(within(dialog).getByRole("button", { name: "Scheduled" }))

    const content = document.querySelector(
      '[data-slot="popover-content"][data-open]'
    )
    expect(content?.parentElement).toHaveAttribute("data-side", "top")
  })

  it("shows the fixed workflow, assignee identity, and archived view", async () => {
    const user = userEvent.setup()
    const { container } = render(
      <JobWorkspace
        employees={employees}
        initialJobs={[
          job,
          {
            ...job,
            assigneeMembershipId: 1104,
            id: 1402,
            status: "in_review",
            title: "Submitted checklist",
          },
          {
            ...job,
            archivedAt: "2026-07-27T04:30:00.000Z",
            id: 1403,
            status: "archived",
            title: "Archived checklist",
          },
        ]}
        timezone="Australia/Melbourne"
      />
    )

    expect(screen.getAllByRole("region")).toHaveLength(3)
    expect(
      screen.getByRole("region", { name: "Unassigned jobs" })
    ).toBeVisible()
    expect(
      screen.getByRole("region", { name: "Assigned jobs" })
    ).toHaveTextContent("Alex Employee")
    const assignedCard = within(
      screen.getByRole("region", { name: "Assigned jobs" })
    ).getByRole("article", { name: "Job Inspect loading bay" })
    expect(
      within(assignedCard).getByRole("combobox", { name: "Assign to" })
    ).toHaveTextContent("Alex Employee - Operator")
    expect(
      within(assignedCard).getByRole("combobox", { name: "Assign to" })
    ).not.toHaveTextContent("1103")
    expect(
      within(assignedCard).getByLabelText("Drag Inspect loading bay")
    ).not.toContainElement(
      within(assignedCard).getByRole("combobox", { name: "Assign to" })
    )
    expect(
      screen.getByRole("region", { name: "To review jobs" })
    ).toHaveTextContent("Casey Inactive")
    expect(
      screen.getByRole("region", { name: "To review jobs" })
    ).toHaveTextContent("Inactive")
    expect(container.querySelector("[data-board-scroll]")).toHaveClass(
      "snap-mandatory",
      "h-full"
    )
    expect(container.firstElementChild).toHaveClass(
      "h-full",
      "min-h-0",
      "overflow-hidden"
    )
    for (const column of screen.getAllByRole("region")) {
      expect(column).toHaveClass("h-full", "snap-start")
      expect(column.querySelector("[data-card-list]")).toHaveClass(
        "min-h-0",
        "overflow-y-auto"
      )
    }

    await user.click(screen.getByRole("tab", { name: "Archived" }))
    expect(screen.getAllByRole("region")).toHaveLength(1)
    expect(
      screen.getByRole("region", { name: "Archived jobs" })
    ).toHaveTextContent("Archived checklist")
    expect(
      screen.getByRole("region", { name: "Archived jobs" })
    ).toHaveTextContent("Completed by")
    expect(
      screen.getByRole("region", { name: "Archived jobs" })
    ).toHaveTextContent("27 Jul, 2:30 pm")
    expect(container.querySelector("[data-archive-grid]")).toHaveClass(
      "md:grid-cols-2",
      "xl:grid-cols-3"
    )
    expect(
      within(
        screen.getByRole("region", { name: "Archived jobs" })
      ).queryByLabelText("Drag Archived checklist")
    ).not.toBeInTheDocument()
  })

  it("paginates archived jobs in pages of 15", async () => {
    const user = userEvent.setup()
    render(
      <JobWorkspace
        archivePagination={{
          page: 1,
          pageSize: 15,
          total: 31,
          totalPages: 3,
        }}
        employees={employees}
        initialJobs={[
          {
            ...job,
            archivedAt: "2026-07-27T04:30:00.000Z",
            id: 1403,
            status: "archived",
            title: "Archived checklist",
          },
        ]}
        timezone="Australia/Melbourne"
      />
    )

    await user.click(screen.getByRole("tab", { name: "Archived" }))

    expect(
      screen.getByRole("navigation", { name: "Archived jobs pagination" })
    ).toHaveTextContent("Showing 1–15 of 31")
    expect(screen.getByText("Page 1 of 3")).toBeVisible()
    expect(
      screen.getByRole("button", { name: "Next archived jobs page" })
    ).toHaveAttribute("href", "/dashboard/jobs?view=archived&page=2")
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled()
  })

  it("filters the board by urgency and employee", async () => {
    const user = userEvent.setup()
    render(
      <JobWorkspace
        employees={employees}
        initialJobs={[
          job,
          {
            ...job,
            assigneeMembershipId: null,
            id: 1402,
            priority: "urgent",
            title: "Urgent unassigned work",
          },
        ]}
        timezone="Australia/Melbourne"
      />
    )

    expect(
      screen.getByRole("combobox", { name: "Filter by urgency" })
    ).toHaveTextContent("All urgencies")
    expect(
      screen.getByRole("combobox", { name: "Filter by employee" })
    ).toHaveTextContent("All employees")

    await user.click(
      screen.getByRole("combobox", { name: "Filter by urgency" })
    )
    await user.click(await screen.findByRole("option", { name: "Urgent" }))
    expect(screen.getByText("Urgent unassigned work")).toBeVisible()
    expect(screen.queryByText("Inspect loading bay")).not.toBeInTheDocument()

    await user.click(
      screen.getByRole("combobox", { name: "Filter by employee" })
    )
    await user.click(await screen.findByRole("option", { name: "Unassigned" }))
    expect(screen.getByText("Urgent unassigned work")).toBeVisible()

    await user.click(
      screen.getByRole("combobox", { name: "Filter by employee" })
    )
    await user.click(
      await screen.findByRole("option", { name: "Alex Employee" })
    )
    expect(screen.queryByText("Urgent unassigned work")).not.toBeInTheDocument()
  })

  it("requires employee selection and supports cancellation", async () => {
    const user = userEvent.setup()
    const onAssign = vi.fn()
    const onOpenChange = vi.fn()
    render(
      <AssignmentDialog
        employees={employees}
        job={{ ...job, assigneeMembershipId: null }}
        onAssign={onAssign}
        onOpenChange={onOpenChange}
      />
    )

    const dialog = screen.getByRole("dialog", {
      name: "Assign Inspect loading bay",
    })
    expect(
      within(dialog).getByRole("button", { name: "Assign job" })
    ).toBeDisabled()
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(onAssign).not.toHaveBeenCalled()

    await user.click(within(dialog).getByRole("combobox", { name: "Employee" }))
    await user.click(
      await screen.findByRole("option", { name: "Alex Employee" })
    )
    expect(
      within(dialog).getByRole("combobox", { name: "Employee" })
    ).toHaveTextContent("Alex Employee")
    await user.click(within(dialog).getByRole("button", { name: "Assign job" }))
    expect(onAssign).toHaveBeenCalledWith(1103)
  })

  it("rolls an optimistic reassignment back when persistence fails", async () => {
    vi.mocked(reassignJobAction).mockResolvedValue({
      message: "Could not save the assignment. The card was moved back.",
      ok: false,
    })
    const user = userEvent.setup()

    render(
      <JobWorkspace
        employees={employees}
        initialJobs={[job]}
        timezone="Australia/Melbourne"
      />
    )

    const assignedColumn = screen.getByRole("region", {
      name: "Assigned jobs",
    })
    const card = within(assignedColumn).getByRole("article", {
      name: "Job Inspect loading bay",
    })

    await user.click(within(card).getByRole("combobox", { name: "Assign to" }))
    await user.click(await screen.findByRole("option", { name: "Unassign" }))

    await waitFor(() =>
      expect(
        within(screen.getByRole("region", { name: "Assigned jobs" })).getByRole(
          "article",
          { name: "Job Inspect loading bay" }
        )
      ).toBeVisible()
    )
    expect(
      within(
        screen.getByRole("region", { name: "Unassigned jobs" })
      ).queryByRole("article", { name: "Job Inspect loading bay" })
    ).not.toBeInTheDocument()
    expect(reassignJobAction).toHaveBeenCalledWith(1401, null)
  })

  it("defers a refreshed server snapshot until an optimistic move settles", async () => {
    let resolveAssignment:
      ((value: { job: JobCard; message: string; ok: true }) => void) | undefined
    vi.mocked(reassignJobAction).mockReturnValue(
      new Promise((resolve) => {
        resolveAssignment = resolve
      })
    )
    const user = userEvent.setup()
    const { container, rerender } = render(
      <JobWorkspace
        employees={employees}
        initialJobs={[job]}
        timezone="Australia/Melbourne"
      />
    )
    const boardScroller = container.querySelector("[data-board-scroll]")

    const originalCard = screen.getByRole("article", {
      name: "Job Inspect loading bay",
    })
    await user.click(
      within(originalCard).getByRole("combobox", { name: "Assign to" })
    )
    await user.click(await screen.findByRole("option", { name: "Unassign" }))
    expect(
      within(screen.getByRole("region", { name: "Unassigned jobs" })).getByRole(
        "article",
        { name: "Job Inspect loading bay" }
      )
    ).toBeVisible()
    expect(container.querySelector("[data-board-scroll]")).toBe(boardScroller)

    const refreshedJob: JobCard = {
      ...job,
      assigneeMembershipId: null,
      title: "Realtime loading bay inspection",
      updatedAt: "2026-07-27T01:05:00.000Z",
    }
    rerender(
      <JobWorkspace
        employees={employees}
        initialJobs={[refreshedJob]}
        timezone="Australia/Melbourne"
      />
    )
    expect(
      screen.queryByRole("article", {
        name: "Job Realtime loading bay inspection",
      })
    ).not.toBeInTheDocument()

    await act(async () => {
      resolveAssignment?.({
        job: { ...job, assigneeMembershipId: null },
        message: "Assignment updated.",
        ok: true,
      })
    })
    await waitFor(() =>
      expect(
        screen.getByRole("article", {
          name: "Job Realtime loading bay inspection",
        })
      ).toBeVisible()
    )
  })
})
