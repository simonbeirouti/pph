import { act, cleanup, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { RealtimeInvalidation } from "@/lib/realtime/events"
import type { JobCard } from "@/lib/jobs/types"

const mocks = vi.hoisted(() => ({
  listener: null as ((event: RealtimeInvalidation) => void) | null,
  operations: [] as Array<{
    entity: { id: number; source: "server" }
    entityType: "job"
  }>,
}))

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock("@/components/dashboard/dashboard-realtime-provider", () => ({
  useOptionalRealtimeInvalidations: (
    _domains: string[],
    listener: (event: RealtimeInvalidation) => void
  ) => {
    mocks.listener = listener
  },
}))
vi.mock("@/components/offline/offline-v2-provider", () => ({
  useOptionalOfflineV2: () => ({ operations: mocks.operations }),
}))
vi.mock("@/components/jobs/job-detail-controller", () => ({
  JobDetailController: ({ children }: { children: React.ReactNode }) =>
    children,
}))
vi.mock("@/components/jobs/job-workspace", () => ({
  JobWorkspace: ({ initialJobs }: { initialJobs: JobCard[] }) => (
    <div>
      {initialJobs.map((job) => (
        <p key={job.id}>{`${job.title}:${job.status}`}</p>
      ))}
    </div>
  ),
}))

import { JobsScreen } from "@/components/jobs/jobs-screen"

const assignedJob: JobCard = {
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
  title: "Live review",
  updatedAt: "2026-08-04T00:00:00.000Z",
  version: 1,
}

function renderScreen() {
  return render(
    <JobsScreen
      detail={null}
      employees={[]}
      filterActive={false}
      jobs={[assignedJob]}
      mode="team"
      role="owner"
      rosterShifts={[]}
      templates={[]}
      timezone="Australia/Melbourne"
      view="workflow"
    />
  )
}

beforeEach(() => {
  mocks.listener = null
  mocks.operations = []
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe("JobsScreen live updates", () => {
  it("moves an affected card to its authoritative status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          jobs: [
            {
              ...assignedJob,
              status: "in_review",
              updatedAt: "2026-08-04T00:01:00.000Z",
              version: 2,
            },
          ],
          removedIds: [],
        })
      )
    )
    renderScreen()

    act(() => {
      mocks.listener?.({
        action: "update",
        domain: "job",
        entityId: assignedJob.id,
        eventId: "55b948a9-1dc0-4725-89c7-c17fa23ffaad",
        occurredAt: "2026-08-04T00:01:00.000Z",
        version: 1,
      })
    })
    await waitFor(() =>
      expect(screen.getByText("Live review:in_review")).toBeVisible()
    )
  })

  it("does not overwrite a job with a queued local operation", async () => {
    mocks.operations = [
      {
        entity: { id: assignedJob.id, source: "server" },
        entityType: "job",
      },
    ]
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          jobs: [{ ...assignedJob, status: "in_review", version: 2 }],
          removedIds: [],
        })
      )
    )
    renderScreen()

    act(() => {
      mocks.listener?.({
        action: "update",
        domain: "job",
        entityId: assignedJob.id,
        eventId: "9958d057-6bcb-41cf-871d-27f3ee4579f3",
        occurredAt: "2026-08-04T00:01:00.000Z",
        version: 1,
      })
    })
    await waitFor(() => expect(fetch).toHaveBeenCalledOnce())
    expect(screen.getByText("Live review:assigned")).toBeVisible()
  })
})
