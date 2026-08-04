import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { submitJobAction } from "@/app/dashboard/jobs/actions"
import { EmployeeJobsList } from "@/components/jobs/employee-jobs-list"
import type { JobCard } from "@/lib/jobs/types"

const mocks = vi.hoisted(() => ({
  mode: null as string | null,
  queue: vi.fn(),
  refresh: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
  useSearchParams: () =>
    new URLSearchParams(mocks.mode ? `mode=${mocks.mode}` : ""),
}))
vi.mock("sonner", () => ({
  toast: {
    error: mocks.toastError,
    success: mocks.toastSuccess,
  },
}))
vi.mock("@/app/dashboard/jobs/actions", () => ({
  submitJobAction: vi.fn(),
}))
vi.mock("@/components/offline/offline-v2-actions", () => ({
  updateJobEverywhere: vi.fn(),
  useOfflineV2Actions: () => ({
    isOffline: false,
    navigate: undefined,
    queue: mocks.queue,
  }),
}))

const readyJob: JobCard = {
  assigneeMembershipId: 1103,
  completionNoteCount: 1,
  completionPhotoCount: 2,
  description: "Inspect and photograph the loading bay.",
  dueAt: null,
  id: 1401,
  location: "Loading bay",
  minimumCompletionPhotos: 2,
  priority: "high",
  requiresCompletionNote: true,
  scheduledAt: null,
  status: "in_progress",
  title: "Inspect loading bay",
  updatedAt: "2026-07-27T00:00:00.000Z",
  version: 3,
}

afterEach(() => {
  cleanup()
  mocks.mode = null
  vi.clearAllMocks()
})

describe("EmployeeJobsList review actions", () => {
  it("separates submitted work from open and in-progress jobs", () => {
    const submittedJob = {
      ...readyJob,
      id: 1402,
      status: "in_review" as const,
      title: "Submitted loading bay inspection",
    }
    render(
      <EmployeeJobsList
        jobs={[readyJob, submittedJob]}
        timezone="Australia/Melbourne"
      />
    )

    expect(
      screen.getByRole("button", { name: "Open & in progress (1)" })
    ).toHaveClass("w-full", "md:w-auto")
    expect(
      screen.getByRole("button", { name: "Open & in progress (1)" })
    ).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByText(readyJob.title)).toBeInTheDocument()
    expect(screen.queryByText(submittedJob.title)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Submitted (1)" }))

    expect(screen.getByText(submittedJob.title)).toBeInTheDocument()
    expect(screen.queryByText(readyJob.title)).not.toBeInTheDocument()
    expect(
      screen.getByText("Submitted and waiting for owner review.")
    ).toBeInTheDocument()
  })

  it("shows filter-specific empty states", () => {
    render(<EmployeeJobsList jobs={[]} timezone="Australia/Melbourne" />)

    expect(screen.getByText("No open jobs")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Submitted (0)" }))
    expect(screen.getByText("No submitted jobs")).toBeInTheDocument()
  })

  it.each(["assigned", "in_progress"] as const)(
    "shows submission for a ready %s job",
    (status) => {
      render(
        <EmployeeJobsList
          jobs={[{ ...readyJob, status }]}
          timezone="Australia/Melbourne"
        />
      )

      expect(
        screen.getByRole("button", { name: "Submit for review" })
      ).toBeEnabled()
    }
  )

  it("submits a ready job from the card", async () => {
    mocks.queue.mockResolvedValue(false)
    vi.mocked(submitJobAction).mockResolvedValue({
      message: "Job submitted for review.",
      ok: true,
    })
    render(
      <EmployeeJobsList jobs={[readyJob]} timezone="Australia/Melbourne" />
    )

    fireEvent.click(screen.getByRole("button", { name: "Submit for review" }))

    await waitFor(() =>
      expect(submitJobAction).toHaveBeenCalledWith(readyJob.id)
    )
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Job submitted for review.")
    expect(mocks.refresh).toHaveBeenCalled()
  })

  it("keeps server-side validation authoritative for a stale ready card", async () => {
    mocks.queue.mockResolvedValue(false)
    vi.mocked(submitJobAction).mockResolvedValue({
      message: "Add the required completion note before submitting.",
      ok: false,
    })
    render(
      <EmployeeJobsList jobs={[readyJob]} timezone="Australia/Melbourne" />
    )

    fireEvent.click(screen.getByRole("button", { name: "Submit for review" }))

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith(
        "Add the required completion note before submitting."
      )
    )
    expect(mocks.refresh).not.toHaveBeenCalled()
  })

  it("disables submission while the request is pending", async () => {
    mocks.queue.mockResolvedValue(false)
    let finishSubmission:
      ((value: { message: string; ok: boolean }) => void) | undefined
    vi.mocked(submitJobAction).mockImplementation(
      () =>
        new Promise((resolve) => {
          finishSubmission = resolve
        })
    )
    render(
      <EmployeeJobsList jobs={[readyJob]} timezone="Australia/Melbourne" />
    )

    fireEvent.click(screen.getByRole("button", { name: "Submit for review" }))

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Submit for review" })
      ).toBeDisabled()
    )
    finishSubmission?.({ message: "Job submitted for review.", ok: true })
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalled())
  })

  it.each([
    ["missing note", { completionNoteCount: 0 }],
    ["missing photo", { completionPhotoCount: 1 }],
    [
      "missing cached counts",
      { completionNoteCount: undefined, completionPhotoCount: undefined },
    ],
    ["already in review", { status: "in_review" as const }],
  ])("hides submission when %s", (_label, changes) => {
    render(
      <EmployeeJobsList
        jobs={[{ ...readyJob, ...changes }]}
        timezone="Australia/Melbourne"
      />
    )

    expect(
      screen.queryByRole("button", { name: "Submit for review" })
    ).not.toBeInTheDocument()
  })

  it("queues submission offline and preserves manager my-work routing", async () => {
    mocks.mode = "my-work"
    mocks.queue.mockResolvedValue(true)
    render(
      <EmployeeJobsList jobs={[readyJob]} timezone="Australia/Melbourne" />
    )

    const openJob = screen.getByRole("button", { name: "Open job" })
    expect(openJob).toHaveAttribute(
      "href",
      "/dashboard/jobs?mode=my-work&job=1401"
    )
    expect(openJob).toHaveAttribute("data-slot", "button")
    expect(openJob).toHaveClass("bg-primary")
    fireEvent.click(screen.getByRole("button", { name: "Submit for review" }))

    await waitFor(() =>
      expect(mocks.queue).toHaveBeenCalledWith(
        expect.objectContaining({
          entityId: readyJob.id,
          expectedVersion: readyJob.version,
          kind: "job.submit",
        })
      )
    )
    expect(submitJobAction).not.toHaveBeenCalled()
    expect(mocks.refresh).not.toHaveBeenCalled()
  })
})
