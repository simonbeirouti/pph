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

import { reassignJobAction } from "@/app/dashboard/jobs/actions"
import { AssignmentDialog, JobWorkspace } from "@/components/job-workspace"
import type { JobBoardEmployee, JobCard } from "@/lib/jobs/types"

vi.mock("@/app/dashboard/jobs/actions", () => ({
  createJobAction: vi.fn(),
  reassignJobAction: vi.fn(),
  updateJobAction: vi.fn(),
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

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe("JobWorkspace", () => {
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
        within(
          screen.getByRole("region", { name: "Assigned jobs" })
        ).getByRole("article", { name: "Job Inspect loading bay" })
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
    const { rerender } = render(
      <JobWorkspace
        employees={employees}
        initialJobs={[job]}
        timezone="Australia/Melbourne"
      />
    )

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
