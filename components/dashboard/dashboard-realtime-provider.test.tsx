import { act, cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  DashboardRealtimeProvider,
  useRealtimeInvalidations,
} from "@/components/dashboard/dashboard-realtime-provider"
import { createClient } from "@/lib/supabase/browser"
import type { RealtimeInvalidation } from "@/lib/realtime/events"

const refresh = vi.fn()
const router = { refresh }
let viewSource: "cache" | "server" = "cache"

vi.mock("next/navigation", () => ({
  useRouter: () => router,
}))

vi.mock("@/components/offline/offline-v2-provider", () => ({
  useOfflineV2: () => ({ viewSource }),
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
const unsubscribeAuth = vi.fn()
const onAuthStateChange = vi.fn(() => ({
  data: { subscription: { unsubscribe: unsubscribeAuth } },
}))
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
  auth: { onAuthStateChange },
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
  viewSource = "cache"
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
    const invalidate = vi.fn()
    window.addEventListener("pph:offline-invalidate", invalidate)
    const listener = renderProvider()
    await act(async () => {})

    expect(supabase.channel).toHaveBeenCalledWith("org:1001:operations", {
      config: { private: true },
    })
    expect(setAuth).toHaveBeenCalledOnce()
    expect(subscribe).toHaveBeenCalledOnce()

    act(() => updateStatus?.("SUBSCRIBED"))
    act(() => {
      broadcast?.({ payload: { ...event, eventId: "" } })
    })
    act(() => vi.advanceTimersByTime(150))
    expect(listener).not.toHaveBeenCalled()
    expect(invalidate).not.toHaveBeenCalled()
    expect(refresh).not.toHaveBeenCalled()

    act(() => {
      broadcast?.({ payload: event })
      broadcast?.({
        payload: { ...event, entityId: 1402, eventId: "second-event" },
      })
    })

    expect(listener).toHaveBeenCalledTimes(2)
    expect(invalidate).not.toHaveBeenCalled()
    expect(refresh).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(150))
    expect(invalidate).toHaveBeenCalledOnce()
    expect(refresh).not.toHaveBeenCalled()
    window.removeEventListener("pph:offline-invalidate", invalidate)
  })

  it("warns after degraded connectivity and refreshes on recovery", async () => {
    const invalidate = vi.fn()
    window.addEventListener("pph:offline-invalidate", invalidate)
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
    expect(screen.getByRole("status")).toHaveTextContent("Live updates paused")

    act(() => updateStatus?.("SUBSCRIBED"))
    expect(screen.queryByText("Live updates paused")).not.toBeInTheDocument()
    act(() => vi.advanceTimersByTime(150))
    expect(invalidate).toHaveBeenCalledOnce()
    expect(refresh).not.toHaveBeenCalled()
    window.removeEventListener("pph:offline-invalidate", invalidate)
  })

  it("invalidates the repository without refreshing cached routes after a stale tab", async () => {
    const invalidate = vi.fn()
    window.addEventListener("pph:offline-invalidate", invalidate)
    renderProvider()
    await act(async () => {})
    act(() => updateStatus?.("SUBSCRIBED"))

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    })
    act(() => document.dispatchEvent(new Event("visibilitychange")))
    act(() => vi.advanceTimersByTime(30_000))
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    })
    act(() => document.dispatchEvent(new Event("visibilitychange")))

    expect(invalidate).not.toHaveBeenCalled()
    expect(refresh).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(150))
    expect(invalidate).toHaveBeenCalledOnce()
    expect(refresh).not.toHaveBeenCalled()
    window.removeEventListener("pph:offline-invalidate", invalidate)
  })

  it("refreshes the authenticated SSR fallback before preparation completes", async () => {
    viewSource = "server"
    renderProvider()
    await act(async () => {})
    act(() => updateStatus?.("SUBSCRIBED"))
    act(() => broadcast?.({ payload: event }))
    act(() => vi.advanceTimersByTime(150))
    expect(refresh).toHaveBeenCalledOnce()
  })

  it("keeps the channel stable when the dashboard view source changes", async () => {
    const { rerender } = render(
      <DashboardRealtimeProvider
        membership={{
          membershipId: 1101,
          organisationId: 1001,
          role: "owner",
        }}
      >
        <p>Dashboard</p>
      </DashboardRealtimeProvider>
    )
    await act(async () => {})

    viewSource = "server"
    rerender(
      <DashboardRealtimeProvider
        membership={{
          membershipId: 1101,
          organisationId: 1001,
          role: "owner",
        }}
      >
        <p>Dashboard</p>
      </DashboardRealtimeProvider>
    )
    await act(async () => {})

    expect(supabase.channel).toHaveBeenCalledOnce()
    expect(removeChannel).not.toHaveBeenCalled()
  })

  it("removes its channel during cleanup", async () => {
    renderProvider()
    await act(async () => {})
    cleanup()
    expect(removeChannel).toHaveBeenCalledWith(channel)
  })
})
