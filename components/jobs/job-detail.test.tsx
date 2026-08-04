import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
  waitFor,
} from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  addJobNoteAction,
  finalizeJobEvidenceUploadAction,
  prepareJobEvidenceUploadAction,
  submitJobAction,
} from "@/app/dashboard/jobs/actions"
import { EmployeeJobDetail, OwnerJobDetail } from "@/components/jobs/job-detail"
import type { JobDetail } from "@/lib/jobs/types"

const isMobile = vi.fn(() => false)
const navigationMocks = vi.hoisted(() => ({
  job: "1401" as string | null,
  replace: vi.fn(),
}))
const uploadMocks = vi.hoisted(() => ({
  optimize: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  toastWarning: vi.fn(),
  tusFiles: [] as File[],
  tusOptions: [] as Array<{
    metadata: Record<string, string>
    onProgress(uploaded: number, total: number): void
    onSuccess(): Promise<void>
  }>,
}))

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => isMobile(),
}))
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), replace: navigationMocks.replace }),
  useSearchParams: () =>
    new URLSearchParams(
      navigationMocks.job ? `job=${navigationMocks.job}` : ""
    ),
}))
vi.mock("@/lib/uploads/job-evidence-optimizer", () => ({
  optimizeJobEvidenceFile: uploadMocks.optimize,
}))
vi.mock("sonner", () => ({
  toast: {
    error: uploadMocks.toastError,
    success: uploadMocks.toastSuccess,
    warning: uploadMocks.toastWarning,
  },
}))
vi.mock("tus-js-client", () => ({
  Upload: class {
    constructor(file: File, options: (typeof uploadMocks.tusOptions)[number]) {
      uploadMocks.tusFiles.push(file)
      uploadMocks.tusOptions.push(options)
    }

    abort() {
      return Promise.resolve()
    }

    start() {
      const options = uploadMocks.tusOptions.at(-1)!
      options.onProgress(1, 2)
    }
  },
}))
vi.mock("@/app/dashboard/jobs/actions", () => ({
  addJobCommentAction: vi.fn(),
  addJobNoteAction: vi.fn(),
  archiveJobAction: vi.fn(),
  finalizeJobEvidenceUploadAction: vi.fn(),
  prepareJobEvidenceUploadAction: vi.fn(),
  removeJobEvidenceAction: vi.fn(),
  reopenJobAction: vi.fn(),
  retryJobNotificationAction: vi.fn(),
  startJobAction: vi.fn(),
  submitJobAction: vi.fn(),
}))

const detail: JobDetail = {
  archivedAt: null,
  assigneeMembershipId: 1103,
  createdByMembershipId: 1101,
  description: "Inspect and photograph the loading bay.",
  dueAt: null,
  evidence: [],
  id: 1401,
  identities: [],
  latestReopenFeedback: "Please photograph the final label.",
  location: "Loading bay",
  minimumCompletionPhotos: 1,
  noteCount: 0,
  notifications: [],
  priority: "high",
  requiresCompletionNote: true,
  scheduledAt: null,
  startedAt: null,
  status: "assigned",
  submissionVersion: 1,
  submittedByMembershipId: null,
  requiredReviewerRole: null,
  submittedAt: null,
  timeline: [],
  title: "Inspect loading bay",
  updatedAt: "2026-07-27T00:00:00.000Z",
}

Object.defineProperty(URL, "createObjectURL", {
  configurable: true,
  value: vi.fn(() => "blob:job-evidence-preview"),
})
Object.defineProperty(URL, "revokeObjectURL", {
  configurable: true,
  value: vi.fn(),
})

afterEach(() => {
  cleanup()
  isMobile.mockReturnValue(false)
  uploadMocks.tusFiles = []
  uploadMocks.tusOptions = []
  navigationMocks.job = "1401"
  vi.clearAllMocks()
})

describe("job detail surfaces", () => {
  it("uses a desktop dialog for employee execution and shows reopen feedback", () => {
    const { container } = render(
      <EmployeeJobDetail detail={detail} timezone="Australia/Melbourne" />
    )

    expect(screen.getByRole("dialog")).toHaveAttribute(
      "data-slot",
      "dialog-content"
    )
    expect(screen.getByText("Owner feedback")).toBeVisible()
    expect(screen.getByText(detail.description!)).toBeVisible()
    expect(
      screen.queryByText("Add completion information and submit the job.")
    ).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Start job" })).toBeVisible()
    expect(
      screen.queryByLabelText("Work note or comment")
    ).not.toBeInTheDocument()
    expect(screen.getByText("Submission requirements")).toBeVisible()
    expect(screen.getByText("assigned").parentElement).toHaveClass(
      "justify-center"
    )
    expect(
      screen.getByRole("button", { name: "History, 0 updates" })
    ).toHaveAttribute("aria-expanded", "false")
    expect(
      screen.queryByRole("button", { name: "Comments" })
    ).not.toBeInTheDocument()
    expect(screen.queryByLabelText("Add comment")).not.toBeInTheDocument()
    expect(screen.queryByText("Evidence")).not.toBeInTheDocument()
    expect(container.ownerDocument.querySelector("dl")).toHaveClass(
      "grid-cols-2"
    )
    expect(screen.getByText("Assigned to")).toBeVisible()
    expect(screen.getByText("Location").parentElement).toHaveClass("text-left")
    expect(screen.getByText("Due").parentElement).toHaveClass("text-left")
  })

  it("reveals completion controls after the employee starts work", () => {
    render(
      <EmployeeJobDetail
        detail={{ ...detail, status: "in_progress" }}
        timezone="Australia/Melbourne"
      />
    )

    expect(screen.queryByText("Complete the job")).not.toBeInTheDocument()
    expect(
      screen.queryByText("Notes and photos become read-only after submission.")
    ).not.toBeInTheDocument()
    expect(screen.getByLabelText("Work note or comment")).toBeVisible()
    expect(screen.getByLabelText("Completion photos")).toHaveAttribute(
      "accept",
      "image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
    )
    expect(
      screen.getByText(
        "JPEG, PNG, WebP, HEIC, or HEIF · 10 MB source maximum · larger photos are optimized · up to 10 photos"
      )
    ).toBeVisible()
    expect(
      screen.queryByRole("button", { name: "Submit for review" })
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Add completion photos" })
    ).toBeVisible()
    expect(
      screen.queryByRole("button", { name: "Save" })
    ).not.toBeInTheDocument()
    expect(screen.queryByLabelText("Add comment")).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Comments" })
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "History, 0 updates" })
    ).toBeVisible()
    expect(screen.queryByText("Evidence")).not.toBeInTheDocument()
  })

  it("submits completed work from the detail and closes after success", async () => {
    const onClose = vi.fn()
    vi.mocked(submitJobAction).mockResolvedValue({
      message: "Job submitted for review.",
      ok: true,
    })
    render(
      <EmployeeJobDetail
        detail={{
          ...detail,
          evidence: [
            {
              createdAt: "2026-07-27T01:00:00.000Z",
              id: 9,
              mimeType: "image/jpeg",
              removable: true,
              signedUrl: "/evidence/9",
              sizeBytes: 1_024,
              uploadedByMembershipId: 1103,
            },
          ],
          noteCount: 1,
          status: "in_progress",
        }}
        onClose={onClose}
        timezone="Australia/Melbourne"
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "Submit for review" }))

    await waitFor(() => expect(submitJobAction).toHaveBeenCalledWith(detail.id))
    expect(uploadMocks.toastSuccess).toHaveBeenCalledWith(
      "Job submitted for review."
    )
    expect(onClose).toHaveBeenCalledOnce()
  })

  it("keeps completed work open when submission fails", async () => {
    const onClose = vi.fn()
    vi.mocked(submitJobAction).mockResolvedValue({
      message: "The latest requirements are not complete.",
      ok: false,
    })
    render(
      <EmployeeJobDetail
        detail={{
          ...detail,
          evidence: [
            {
              createdAt: "2026-07-27T01:00:00.000Z",
              id: 9,
              mimeType: "image/jpeg",
              removable: true,
              signedUrl: "/evidence/9",
              sizeBytes: 1_024,
              uploadedByMembershipId: 1103,
            },
          ],
          noteCount: 1,
          status: "in_progress",
        }}
        onClose={onClose}
        timezone="Australia/Melbourne"
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "Submit for review" }))

    await waitFor(() =>
      expect(uploadMocks.toastError).toHaveBeenCalledWith(
        "The latest requirements are not complete."
      )
    )
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole("dialog")).toBeVisible()
  })

  it("marks mobile drawer content as swipe ignored while keeping its handle", () => {
    isMobile.mockReturnValue(true)
    render(
      <EmployeeJobDetail
        detail={{ ...detail, status: "in_progress" }}
        timezone="Australia/Melbourne"
      />
    )

    expect(
      document.querySelector('[data-slot="drawer-content"]')
    ).toHaveAttribute("data-base-ui-swipe-ignore")
    expect(
      document.querySelector('[data-slot="drawer-swipe-handle"]')
    ).not.toHaveAttribute("data-base-ui-swipe-ignore")
  })

  it("optimizes before preparing and uploading completion evidence", async () => {
    let finishOptimization:
      | ((value: {
          file: File
          originalSizeBytes: number
          outcome: "optimized"
          uploadSizeBytes: number
        }) => void)
      | undefined
    uploadMocks.optimize.mockImplementation(
      () =>
        new Promise((resolve) => {
          finishOptimization = resolve
        })
    )
    vi.mocked(prepareJobEvidenceUploadAction).mockResolvedValue({
      bucketName: "job-evidence",
      objectName: "1/1401/1103/photo.webp",
      ok: true,
      signature: "signed",
      uploadUrl: "https://storage.example.test/storage/v1/upload/resumable",
    })
    vi.mocked(finalizeJobEvidenceUploadAction).mockResolvedValue({
      message: "Photo added.",
      ok: true,
    })
    render(
      <EmployeeJobDetail
        detail={{ ...detail, status: "in_progress" }}
        timezone="Australia/Melbourne"
      />
    )
    const picker = screen.getByLabelText("Completion photos")
    const original = new File([new Uint8Array(2 * 1024 * 1024)], "photo.jpg", {
      type: "image/jpeg",
    })

    fireEvent.change(picker, { target: { files: [original] } })

    expect(await screen.findByText("Optimising photo…")).toBeVisible()
    expect(picker).toBeDisabled()

    const optimized = new File([new Uint8Array(700_000)], "photo.webp", {
      type: "image/webp",
    })
    finishOptimization?.({
      file: optimized,
      originalSizeBytes: original.size,
      outcome: "optimized",
      uploadSizeBytes: optimized.size,
    })

    expect(
      await screen.findByRole("img", {
        name: "Selected completion photo preview",
      })
    ).toBeVisible()
    expect(prepareJobEvidenceUploadAction).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "Save" }))

    await waitFor(() =>
      expect(prepareJobEvidenceUploadAction).toHaveBeenCalledWith({
        jobId: detail.id,
        mimeType: "image/webp",
        sizeBytes: optimized.size,
      })
    )
    expect(uploadMocks.tusFiles).toEqual([optimized])
    expect(uploadMocks.tusOptions[0]?.metadata.contentType).toBe("image/webp")
    expect(await screen.findByText("Uploading 50%")).toBeVisible()
    expect(picker).toBeDisabled()
    await act(() => uploadMocks.tusOptions[0]!.onSuccess())
    await waitFor(() => expect(picker).not.toBeDisabled())
  })

  it("warns when optimization falls back to the valid original", async () => {
    const original = new File([new Uint8Array(2 * 1024 * 1024)], "photo.jpg", {
      type: "image/jpeg",
    })
    uploadMocks.optimize.mockResolvedValue({
      file: original,
      originalSizeBytes: original.size,
      outcome: "fallback",
      uploadSizeBytes: original.size,
    })
    vi.mocked(prepareJobEvidenceUploadAction).mockResolvedValue({
      message: "Upload unavailable.",
      ok: false,
    })
    render(
      <EmployeeJobDetail
        detail={{ ...detail, status: "in_progress" }}
        timezone="Australia/Melbourne"
      />
    )

    fireEvent.change(screen.getByLabelText("Completion photos"), {
      target: { files: [original] },
    })

    await waitFor(() =>
      expect(uploadMocks.toastWarning).toHaveBeenCalledWith(
        "This photo could not be optimized. Uploading the original instead."
      )
    )
    expect(prepareJobEvidenceUploadAction).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "Save" }))
    await waitFor(() =>
      expect(prepareJobEvidenceUploadAction).toHaveBeenCalled()
    )
    expect(prepareJobEvidenceUploadAction).toHaveBeenCalledWith(
      expect.objectContaining({
        mimeType: "image/jpeg",
        sizeBytes: original.size,
      })
    )
  })

  it("shows Save only for a draft note and persists it", async () => {
    vi.mocked(addJobNoteAction).mockResolvedValue({
      message: "Note added.",
      ok: true,
    })
    render(
      <EmployeeJobDetail
        detail={{ ...detail, status: "in_progress" }}
        timezone="Australia/Melbourne"
      />
    )

    expect(
      screen.queryByRole("button", { name: "Save" })
    ).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText("Work note or comment"), {
      target: { value: "Completed safely." },
    })
    fireEvent.click(screen.getByRole("button", { name: "Save" }))

    await waitFor(() =>
      expect(addJobNoteAction).toHaveBeenCalledWith(
        detail.id,
        "Completed safely."
      )
    )
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Save" })
      ).not.toBeInTheDocument()
    )
  })

  it("omits the requirements block when the job has no requirements", () => {
    render(
      <EmployeeJobDetail
        detail={{
          ...detail,
          minimumCompletionPhotos: 0,
          requiresCompletionNote: false,
        }}
        timezone="Australia/Melbourne"
      />
    )

    expect(
      screen.queryByText("Submission requirements")
    ).not.toBeInTheDocument()
  })

  it("uses a mobile drawer for employee execution", () => {
    isMobile.mockReturnValue(true)
    const { container } = render(
      <EmployeeJobDetail detail={detail} timezone="Australia/Melbourne" />
    )

    expect(
      container.ownerDocument.querySelector('[data-slot="drawer-popup"]')
    ).toBeTruthy()
    expect(
      container.ownerDocument.querySelector('[data-slot="drawer-content"]')
    ).toHaveClass(
      "min-h-0",
      "flex-1",
      "touch-auto",
      "overflow-y-auto",
      "[scrollbar-width:none]",
      "[&::-webkit-scrollbar]:hidden"
    )
    expect(
      container.ownerDocument.querySelector('[data-slot="scroll-area"]')
    ).not.toBeInTheDocument()
  })

  it("defers evidence image decoding until the preview is needed", () => {
    render(
      <OwnerJobDetail
        detail={{
          ...detail,
          evidence: [
            {
              createdAt: "2026-07-27T00:00:00.000Z",
              id: 1601,
              mimeType: "image/jpeg",
              removable: false,
              signedUrl: "https://example.test/evidence.jpg",
              sizeBytes: 1024,
              uploadedByMembershipId: 1103,
            },
          ],
        }}
        employees={[]}
        timezone="Australia/Melbourne"
      />
    )

    expect(
      screen.getByRole("img", { name: /Completion evidence added/ })
    ).toHaveAttribute("loading", "lazy")
    expect(
      screen.getByRole("img", { name: /Completion evidence added/ })
    ).toHaveAttribute("decoding", "async")
  })

  it("opens employee detail from the live URL for the same and another job", () => {
    const { rerender } = render(
      <EmployeeJobDetail detail={detail} timezone="Australia/Melbourne" />
    )

    expect(screen.getByRole("dialog", { name: detail.title })).toHaveAttribute(
      "data-open"
    )

    navigationMocks.job = null
    rerender(
      <EmployeeJobDetail detail={detail} timezone="Australia/Melbourne" />
    )
    expect(screen.getByRole("dialog", { name: detail.title })).toHaveAttribute(
      "data-closed"
    )

    navigationMocks.job = String(detail.id)
    rerender(
      <EmployeeJobDetail detail={detail} timezone="Australia/Melbourne" />
    )
    expect(screen.getByRole("dialog", { name: detail.title })).toHaveAttribute(
      "data-open"
    )

    const nextDetail = {
      ...detail,
      id: 1402,
      title: "Inspect front entry",
    }
    navigationMocks.job = String(nextDetail.id)
    rerender(
      <EmployeeJobDetail detail={nextDetail} timezone="Australia/Melbourne" />
    )

    expect(
      screen.getByRole("dialog", { name: "Inspect front entry" })
    ).toHaveAttribute("data-open")
  })

  it("opens the owner sheet from the live URL and closes through the route", () => {
    const { rerender } = render(
      <OwnerJobDetail
        detail={detail}
        employees={[]}
        timezone="Australia/Melbourne"
      />
    )

    expect(screen.getByRole("dialog", { name: detail.title })).toHaveAttribute(
      "data-open"
    )

    fireEvent.click(screen.getByRole("button", { name: "Close" }))
    expect(navigationMocks.replace).toHaveBeenCalledWith("/dashboard/jobs", {
      scroll: false,
    })

    navigationMocks.job = null
    rerender(
      <OwnerJobDetail
        detail={detail}
        employees={[]}
        timezone="Australia/Melbourne"
      />
    )
    expect(screen.getByRole("dialog", { name: detail.title })).toHaveAttribute(
      "data-closed"
    )
  })

  it("shows the evidence gallery only after a photo exists", () => {
    render(
      <EmployeeJobDetail
        detail={{
          ...detail,
          evidence: [
            {
              createdAt: "2026-07-27T01:00:00.000Z",
              id: 1,
              mimeType: "image/jpeg",
              removable: true,
              signedUrl: "https://example.com/evidence.jpg",
              sizeBytes: 1024,
              uploadedByMembershipId: 1103,
            },
          ],
          status: "in_progress",
        }}
        timezone="Australia/Melbourne"
      />
    )

    expect(screen.getByText("Evidence")).toBeVisible()
    const thumbnail = screen.getByRole("img", {
      name: /Completion evidence added/i,
    })
    expect(thumbnail).toBeVisible()
    expect(thumbnail).toHaveClass("object-contain")

    fireEvent.click(
      screen.getByRole("button", {
        name: /View completion evidence added/i,
      })
    )
    const viewer = screen.getByRole("dialog", {
      name: "Completion evidence",
    })
    expect(viewer).toBeVisible()
    expect(
      within(viewer).getByRole("img", {
        name: /Full completion evidence added/i,
      })
    ).toHaveClass("object-contain")
  })

  it.each(["employee", "owner"] as const)(
    "keeps legacy comments in history for the %s view",
    (role) => {
      const orderedDetail: JobDetail = {
        ...detail,
        evidence: [
          {
            createdAt: "2026-07-27T01:00:00.000Z",
            id: 1,
            mimeType: "image/jpeg",
            removable: false,
            signedUrl: "https://example.com/evidence.jpg",
            sizeBytes: 1024,
            uploadedByMembershipId: 1103,
          },
        ],
        status: "in_review",
        timeline: [
          {
            authorMembershipId: 1103,
            body: "Existing conversation",
            createdAt: "2026-07-27T02:00:00.000Z",
            id: 1,
            metadata: {},
            type: "comment",
          },
        ],
      }
      if (role === "employee") {
        render(
          <EmployeeJobDetail
            detail={orderedDetail}
            timezone="Australia/Melbourne"
          />
        )
      } else {
        render(
          <OwnerJobDetail
            detail={orderedDetail}
            employees={[]}
            timezone="Australia/Melbourne"
          />
        )
      }
      const jobDetails = screen.getByRole("region", { name: "Job details" })
      const evidence = screen.getByRole("heading", { name: "Evidence" })
      const history = screen.getByRole("button", {
        name: "History, 1 update",
      })
      const follows = (first: Element, second: Element) =>
        Boolean(
          first.compareDocumentPosition(second) &
          Node.DOCUMENT_POSITION_FOLLOWING
        )

      expect(follows(jobDetails, evidence)).toBe(true)
      expect(follows(evidence, history)).toBe(true)
      expect(
        screen.queryByRole("button", { name: "Comments" })
      ).not.toBeInTheDocument()
      expect(history).toHaveAttribute(
        "aria-expanded",
        role === "owner" ? "true" : "false"
      )
      if (role === "employee") {
        expect(
          screen.queryByText("Existing conversation")
        ).not.toBeInTheDocument()
        fireEvent.click(history)
      }
      expect(screen.getByText("Existing conversation")).toBeVisible()
    }
  )

  it("uses a narrower owner review sheet with the three latest history events open", () => {
    const timeline = Array.from({ length: 7 }, (_, index) => ({
      authorMembershipId: 1103,
      body: `Owner history ${index + 1}`,
      createdAt: `2026-07-27T0${index}:00:00.000Z`,
      id: index + 1,
      metadata: {},
      type: "note" as const,
    }))
    const { container } = render(
      <OwnerJobDetail
        detail={{
          ...detail,
          identities: [
            {
              displayName: "Morgan Employee",
              membershipId: 1103,
              role: "employee",
            },
          ],
          notifications: [
            {
              attemptCount: 1,
              createdAt: "2026-07-27T07:00:00.000Z",
              errorMessage: null,
              id: 1701,
              lastAttemptedAt: "2026-07-27T07:00:00.000Z",
              recipientEmail: "morgan@example.com",
              sentAt: "2026-07-27T07:00:00.000Z",
              status: "sent",
            },
          ],
          status: "in_review",
          timeline,
        }}
        employees={[]}
        timezone="Australia/Melbourne"
      />
    )

    const sheet = container.ownerDocument.querySelector(
      '[data-slot="sheet-content"]'
    )
    expect(sheet).toHaveClass(
      "data-[side=right]:w-full",
      "data-[side=right]:sm:w-[32rem]",
      "data-[side=right]:sm:max-w-[32rem]"
    )
    expect(
      screen.getByRole("button", { name: "Approve and archive" })
    ).toBeVisible()
    expect(screen.getByRole("button", { name: "Reopen job" })).toBeVisible()
    expect(screen.getByText("Morgan Employee")).toBeVisible()
    expect(screen.getByText("high").parentElement).toHaveClass("justify-start")
    expect(screen.getByText("Location").parentElement).toHaveClass("text-left")
    expect(
      screen.queryByText("Submission requirements")
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "History, 8 updates" })
    ).toHaveAttribute("aria-expanded", "true")
    expect(
      screen.queryByRole("button", { name: "Comments" })
    ).not.toBeInTheDocument()
    expect(screen.queryByLabelText("Add comment")).not.toBeInTheDocument()
    expect(screen.getByText("Owner history 7")).toBeVisible()
    expect(screen.getByText("Owner history 6")).toBeVisible()
    expect(screen.queryByText("Owner history 5")).not.toBeInTheDocument()
    expect(screen.queryByText("Owner history 1")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Show more" }))
    expect(screen.getByText("Owner history 5")).toBeVisible()
    expect(screen.getByText("Owner history 2")).toBeVisible()
    expect(screen.queryByText("Owner history 1")).not.toBeInTheDocument()
    const historyContent = container.ownerDocument.querySelector(
      '[data-slot="accordion-content"]'
    ) as HTMLElement
    const actionFooter = container.ownerDocument.querySelector(
      '[data-slot="sheet-footer"]'
    ) as HTMLElement
    expect(
      within(historyContent).getByText("Submission email: sent")
    ).toBeVisible()
    expect(within(historyContent).getByText("morgan@example.com")).toBeVisible()
    expect(
      within(actionFooter).queryByText("Submission email: sent")
    ).not.toBeInTheDocument()
    expect(actionFooter).toHaveClass("shrink-0", "border-t")
    expect(
      container.ownerDocument.querySelector('[data-slot="scroll-area"]')
    ).toHaveClass("min-h-0", "flex-1", "overflow-hidden")
    expect(
      container.ownerDocument.querySelector(
        '[data-slot="scroll-area-viewport"]'
      )
    ).toBeInTheDocument()
  })

  it("starts with three history entries and reveals four more", () => {
    const timeline = Array.from({ length: 7 }, (_, index) => ({
      authorMembershipId: 1103,
      body: `History entry ${index + 1}`,
      createdAt: `2026-07-27T0${index}:00:00.000Z`,
      id: index + 1,
      metadata: {},
      type: "note" as const,
    }))

    render(
      <EmployeeJobDetail
        detail={{ ...detail, status: "in_progress", timeline }}
        timezone="Australia/Melbourne"
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "History, 7 updates" }))
    expect(screen.getByText("History entry 7")).toBeVisible()
    expect(screen.getByText("History entry 5")).toBeVisible()
    expect(screen.queryByText("History entry 4")).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Show more" }))
    expect(screen.getByText("History entry 4")).toBeVisible()
    expect(screen.getByText("History entry 2")).toBeVisible()
    expect(screen.getByText("History entry 1")).toBeVisible()
    expect(
      screen.queryByRole("button", { name: "Show more" })
    ).not.toBeInTheDocument()
  })
})
