import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  JobDetailController,
  useJobDetailNavigation,
} from "@/components/jobs/job-detail-controller"
import type { JobCard, JobDetail } from "@/lib/jobs/types"

const mocks = vi.hoisted(() => ({
  offline: null as unknown,
  toastError: vi.fn(),
}))

vi.mock("@/components/jobs/job-detail", () => ({
  EmployeeJobDetail: ({
    detail,
    onClose,
    onMutationSuccess,
  }: {
    detail: JobDetail
    onClose?: () => void
    onMutationSuccess?: () => Promise<void> | void
  }) => (
    <>
      <p data-detail-source="employee">{detail.title}</p>
      <button onClick={onClose} type="button">
        Close job
      </button>
      <button onClick={() => void onMutationSuccess?.()} type="button">
        Refresh mutated job
      </button>
    </>
  ),
  JobDetailLoading: ({ title }: { title: string }) => <p>Loading {title}</p>,
  OwnerJobDetail: ({ detail }: { detail: JobDetail }) => (
    <p data-detail-source="owner">{detail.title}</p>
  ),
}))
vi.mock("@/components/offline/offline-v2-provider", () => ({
  useOptionalOfflineV2: () => mocks.offline,
}))
vi.mock("@/lib/offline-v2/storage", () => ({
  cacheOfflineSnapshotMedia: vi.fn(),
}))
vi.mock("sonner", () => ({ toast: { error: mocks.toastError } }))

const card: JobCard = {
  assigneeMembershipId: 1103,
  description: "",
  dueAt: null,
  id: 1401,
  location: "",
  minimumCompletionPhotos: 0,
  priority: "normal",
  requiresCompletionNote: false,
  scheduledAt: null,
  status: "assigned",
  title: "Cached job",
  updatedAt: "2026-08-02T00:00:00.000Z",
  version: 1,
}

const cachedDetail = {
  ...card,
  archivedAt: null,
  createdByMembershipId: 1101,
  evidence: [],
  identities: [],
  latestReopenFeedback: null,
  noteCount: 0,
  notifications: [],
  requiredReviewerRole: null,
  startedAt: null,
  submissionVersion: 1,
  submittedAt: null,
  submittedByMembershipId: null,
  timeline: [],
} satisfies JobDetail

const secondCard: JobCard = { ...card, id: 1402, title: "Second cached job" }
const secondCachedDetail = {
  ...cachedDetail,
  id: secondCard.id,
  title: secondCard.title,
} satisfies JobDetail

function OpenButton({ job = card }: { job?: JobCard }) {
  const navigation = useJobDetailNavigation()
  return (
    <button onClick={() => navigation?.openJob(job)} type="button">
      Open {job.id}
    </button>
  )
}

afterEach(() => {
  cleanup()
  mocks.offline = null
  vi.restoreAllMocks()
  window.history.replaceState(null, "", "/dashboard/jobs")
})

describe("JobDetailController", () => {
  it("follows cached-shell detail changes without remounting", () => {
    mocks.offline = {
      operations: [],
      snapshot: {
        jobDetails: {
          [card.id]: cachedDetail,
          [secondCard.id]: secondCachedDetail,
        },
      },
      updateSnapshot: vi.fn(),
      usesLocalRepository: true,
    }

    const renderController = (initialDetail: JobDetail | null) => (
      <JobDetailController
        employees={[]}
        initialDetail={initialDetail}
        isOwner={false}
        jobs={[card, secondCard]}
        role="employee"
        timezone="Australia/Melbourne"
      >
        <span />
      </JobDetailController>
    )

    const { rerender } = render(renderController(null))
    expect(screen.queryByText(cachedDetail.title)).not.toBeInTheDocument()

    rerender(renderController(cachedDetail))
    expect(screen.getByText(cachedDetail.title)).toBeVisible()

    rerender(renderController(secondCachedDetail))
    expect(screen.queryByText(cachedDetail.title)).not.toBeInTheDocument()
    expect(screen.getByText(secondCachedDetail.title)).toBeVisible()

    rerender(renderController(null))
    expect(screen.queryByText(secondCachedDetail.title)).not.toBeInTheDocument()
  })

  it("opens cached detail immediately and replaces it after server revalidation", async () => {
    let resolveFetch!: (value: Response) => void
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            resolveFetch = resolve
          })
      )
    )
    mocks.offline = {
      operations: [],
      snapshot: { jobDetails: { [card.id]: cachedDetail } },
      updateSnapshot: vi.fn(),
      usesLocalRepository: false,
    }

    render(
      <JobDetailController
        employees={[]}
        initialDetail={null}
        isOwner={false}
        jobs={[card]}
        role="employee"
        timezone="Australia/Melbourne"
      >
        <OpenButton />
      </JobDetailController>
    )

    fireEvent.click(screen.getByRole("button", { name: "Open 1401" }))

    expect(screen.getByText("Cached job")).toBeVisible()
    expect(window.location.search).toBe("?job=1401")
    expect(fetch).toHaveBeenCalledWith(
      "/api/jobs/1401",
      expect.objectContaining({ cache: "no-store" })
    )

    resolveFetch(
      new Response(JSON.stringify({ ...cachedDetail, title: "Fresh job" }), {
        status: 200,
      })
    )
    await waitFor(() => expect(screen.getByText("Fresh job")).toBeVisible())
  })

  it("revalidates the open detail after a successful server mutation", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({ ...cachedDetail, status: "in_progress" }),
            { status: 200 }
          )
      )
    )

    render(
      <JobDetailController
        employees={[]}
        initialDetail={cachedDetail}
        isOwner={false}
        jobs={[card]}
        role="employee"
        timezone="Australia/Melbourne"
      >
        <span />
      </JobDetailController>
    )

    fireEvent.click(screen.getByRole("button", { name: "Refresh mutated job" }))

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/jobs/1401",
        expect.objectContaining({ cache: "no-store" })
      )
    )
  })

  it("shows a drawer skeleton when the local detail has not prepared yet", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>(() => {}))
    )
    mocks.offline = {
      operations: [],
      snapshot: { jobDetails: {} },
      updateSnapshot: vi.fn(),
      usesLocalRepository: false,
    }

    render(
      <JobDetailController
        employees={[]}
        initialDetail={null}
        isOwner={false}
        jobs={[card]}
        role="employee"
        timezone="Australia/Melbourne"
      >
        <OpenButton />
      </JobDetailController>
    )

    fireEvent.click(screen.getByRole("button", { name: "Open 1401" }))
    expect(screen.getByText("Loading Cached job")).toBeVisible()
  })

  it("ignores a stale response after selecting another job", async () => {
    const resolvers = new Map<number, (response: Response) => void>()
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        const jobId = Number(url.split("/").at(-1))
        return new Promise<Response>((resolve) => resolvers.set(jobId, resolve))
      })
    )
    mocks.offline = {
      operations: [],
      snapshot: {
        jobDetails: {
          [card.id]: cachedDetail,
          [secondCard.id]: secondCachedDetail,
        },
      },
      updateSnapshot: vi.fn(),
      usesLocalRepository: false,
    }

    render(
      <JobDetailController
        employees={[]}
        initialDetail={null}
        isOwner={false}
        jobs={[card, secondCard]}
        role="employee"
        timezone="Australia/Melbourne"
      >
        <OpenButton />
        <OpenButton job={secondCard} />
      </JobDetailController>
    )

    fireEvent.click(screen.getByRole("button", { name: "Open 1401" }))
    fireEvent.click(screen.getByRole("button", { name: "Open 1402" }))
    resolvers.get(card.id)!(
      new Response(JSON.stringify({ ...cachedDetail, title: "Stale response" }))
    )

    await expect(screen.getByText(secondCard.title)).toBeVisible()
    expect(screen.queryByText("Stale response")).toBeNull()
  })

  it("retains cached content and provides a retry after revalidation fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 500 }))
    )
    mocks.offline = {
      operations: [],
      snapshot: { jobDetails: { [card.id]: cachedDetail } },
      updateSnapshot: vi.fn(),
      usesLocalRepository: false,
    }

    render(
      <JobDetailController
        employees={[]}
        initialDetail={null}
        isOwner={false}
        jobs={[card]}
        role="employee"
        timezone="Australia/Melbourne"
      >
        <OpenButton />
      </JobDetailController>
    )

    fireEvent.click(screen.getByRole("button", { name: "Open 1401" }))

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Retry job refresh" })
      ).toBeVisible()
    )
    expect(screen.getByText(cachedDetail.title)).toBeVisible()
  })

  it("keeps the job query in sync when closing and using browser history", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>(() => {}))
    )
    mocks.offline = {
      operations: [],
      snapshot: { jobDetails: { [card.id]: cachedDetail } },
      updateSnapshot: vi.fn(),
      usesLocalRepository: false,
    }

    render(
      <JobDetailController
        employees={[]}
        initialDetail={null}
        isOwner={false}
        jobs={[card]}
        role="employee"
        timezone="Australia/Melbourne"
      >
        <OpenButton />
      </JobDetailController>
    )

    fireEvent.click(screen.getByRole("button", { name: "Open 1401" }))
    fireEvent.click(screen.getByRole("button", { name: "Close job" }))
    expect(window.location.search).toBe("")

    window.history.pushState(null, "", "/dashboard/jobs?job=1401")
    window.dispatchEvent(new PopStateEvent("popstate"))

    await expect(screen.getByText(cachedDetail.title)).toBeVisible()
  })
})
