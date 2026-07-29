import { act, cleanup, render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  DashboardRealtimeProvider,
  useRealtimeInvalidations,
} from "@/components/dashboard-realtime-provider"
import { createClient } from "@/lib/supabase/browser"
import type { RealtimeInvalidation } from "@/lib/realtime/events"

const refresh = vi.fn()
const router = { refresh }

vi.mock("next/navigation", () => ({
  useRouter: () => router,
}))

vi.mock("@/lib/supabase/browser", () => ({
  createClient: vi.fn(),
}))

type SubscribeStatus = "CHANNEL_ERROR" | "CLOSED" | "SUBSCRIBED" | "TIMED_OUT"

let broadcast:
  | ((input: {
      payload: RealtimeInvalidation | Record<string, unknown>
    }) => void)
  | undefined
let updateStatus: ((status: SubscribeStatus) => void) | undefined
const removeChannel = vi.fn()
const setAuth = vi.fn().mockResolvedValue(undefined)
const subscribe = vi.fn((callback: (status: SubscribeStatus) => void) => {
  updateStatus = callback
  return channel
})
const channel = {
  on: vi.fn(
    (_type: string, _filter: { event: string }, callback: typeof broadcast) => {
      broadcast = callback
      return channel
    }
  ),
  subscribe,
}
const supabase = {
  channel: vi.fn(() => channel),
  realtime: { setAuth },
  removeChannel,
}

const event: RealtimeInvalidation = {
  action: "update",
  domain: "job",
  entityId: 1401,
  eventId: "7f879239-866d-4a34-837b-9ca0602c47b3",
  occurredAt: "2026-07-27T01:00:00.000Z",
  version: 1,
}

function JobInvalidationConsumer({
  listener,
}: {
  listener: (event: RealtimeInvalidation) => void
}) {
  useRealtimeInvalidations(["job"], listener)
  return null
}

function renderProvider(listener = vi.fn()) {
  render(
    <DashboardRealtimeProvider
      membership={{
        membershipId: 1101,
        organisationId: 1001,
        role: "owner",
      }}
    >
      <JobInvalidationConsumer listener={listener} />
      <p>Dashboard</p>
    </DashboardRealtimeProvider>
  )
  return listener
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.mocked(createClient).mockReturnValue(
    supabase as unknown as ReturnType<typeof createClient>
  )
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.useRealTimers()
  broadcast = undefined
  updateStatus = undefined
})

describe("DashboardRealtimeProvider", () => {
  it("subscribes privately, validates events, and coalesces refreshes", async () => {
    const listener = renderProvider()
    await act(async () => {})

    expect(supabase.channel).toHaveBeenCalledWith("org:1001:operations", {
      config: { private: true },
    })
    expect(setAuth).toHaveBeenCalledOnce()
    expect(subscribe).toHaveBeenCalledOnce()

    act(() => updateStatus?.("SUBSCRIBED"))
    act(() => {
      broadcast?.({ payload: event })
      broadcast?.({ payload: { ...event, eventId: "" } })
      broadcast?.({ payload: { ...event, entityId: 1402 } })
    })

    expect(listener).toHaveBeenCalledTimes(2)
    expect(refresh).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(150))
    expect(refresh).toHaveBeenCalledOnce()
  })

  it("keeps degraded connectivity unobtrusive and refreshes on recovery", async () => {
    renderProvider()
    await act(async () => {})
    expect(subscribe).toHaveBeenCalledOnce()
    act(() => updateStatus?.("SUBSCRIBED"))
    expect(
      document.querySelector('[data-realtime-status="connected"]')
    ).toBeInTheDocument()
    act(() => updateStatus?.("CHANNEL_ERROR"))
    expect(document.querySelector("[data-realtime-status]")).toHaveAttribute(
      "data-realtime-status",
      "connecting"
    )
    act(() => vi.advanceTimersByTime(4_999))
    expect(document.querySelector("[role=status]")).not.toBeInTheDocument()

    act(() => vi.advanceTimersByTime(1))
    expect(document.querySelector("[data-realtime-status]")).toHaveAttribute(
      "data-realtime-status",
      "degraded"
    )
    expect(document.querySelector("[role=status]")).not.toBeInTheDocument()

    act(() => updateStatus?.("SUBSCRIBED"))
    act(() => vi.advanceTimersByTime(150))
    expect(refresh).toHaveBeenCalledOnce()
  })

  it("removes its channel during cleanup", async () => {
    renderProvider()
    await act(async () => {})
    cleanup()
    expect(removeChannel).toHaveBeenCalledWith(channel)
  })
})
