import { describe, expect, it } from "vitest"

import {
  selectDashboardViewSource,
  selectMutationTransport,
} from "@/lib/offline-v2/view-mode"

describe("dashboard view mode", () => {
  it("keeps the server screen mounted during an online cache refresh", () => {
    expect(
      selectDashboardViewSource({
        cachedShell: false,
        conflictCount: 0,
        networkReachability: "online",
        operationCount: 0,
        syncState: "syncing",
      })
    ).toBe("server")
  })

  it.each(["offline", "unreachable"] as const)(
    "uses cached view-models when the origin is %s",
    (networkReachability) => {
      expect(
        selectDashboardViewSource({
          cachedShell: false,
          conflictCount: 0,
          networkReachability,
          operationCount: 0,
          syncState: "idle",
        })
      ).toBe("cache")
    }
  )

  it("keeps cached screens mounted until replay and conflicts are cleared", () => {
    expect(
      selectDashboardViewSource({
        cachedShell: false,
        conflictCount: 0,
        networkReachability: "online",
        operationCount: 1,
        syncState: "pending",
      })
    ).toBe("cache")
    expect(
      selectDashboardViewSource({
        cachedShell: false,
        conflictCount: 1,
        networkReachability: "online",
        operationCount: 0,
        syncState: "needs_attention",
      })
    ).toBe("cache")
  })

  it("uses server actions online and the outbox only for a writable cache", () => {
    expect(
      selectMutationTransport({
        canQueueOfflineMutation: false,
        viewSource: "server",
      })
    ).toBe("server")
    expect(
      selectMutationTransport({
        canQueueOfflineMutation: true,
        viewSource: "cache",
      })
    ).toBe("outbox")
    expect(
      selectMutationTransport({
        canQueueOfflineMutation: false,
        viewSource: "cache",
      })
    ).toBe("unavailable")
  })
})
