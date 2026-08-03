import { describe, expect, it } from "vitest"

import {
  selectDashboardViewSource,
  selectMutationTransport,
} from "@/lib/offline-v2/view-mode"

describe("dashboard view mode", () => {
  it("keeps SSR mounted until the repository has a usable snapshot", () => {
    expect(
      selectDashboardViewSource({
        cachedShell: false,
        repositoryState: "preparing",
        snapshotAvailable: false,
      })
    ).toBe("server")
  })

  it.each(["ready", "locked"] as const)(
    "uses the local snapshot while the repository is %s",
    (repositoryState) => {
      expect(
        selectDashboardViewSource({
          cachedShell: false,
          repositoryState,
          snapshotAvailable: true,
        })
      ).toBe("cache")
    }
  )

  it("always uses cached routes inside the public shell", () => {
    expect(
      selectDashboardViewSource({
        cachedShell: true,
        repositoryState: "unavailable",
        snapshotAvailable: false,
      })
    ).toBe("cache")
  })

  it("uses the outbox for every repository-managed mutation", () => {
    expect(
      selectMutationTransport({
        canQueueOfflineMutation: false,
        repositoryManaged: false,
        repositoryState: "unavailable",
      })
    ).toBe("server")
    expect(
      selectMutationTransport({
        canQueueOfflineMutation: true,
        repositoryManaged: true,
        repositoryState: "ready",
      })
    ).toBe("outbox")
    expect(
      selectMutationTransport({
        canQueueOfflineMutation: false,
        repositoryManaged: true,
        repositoryState: "locked",
      })
    ).toBe("unavailable")
  })

  it("holds a mutation for the outbox while the repository prepares", () => {
    expect(
      selectMutationTransport({
        canQueueOfflineMutation: false,
        repositoryManaged: true,
        repositoryState: "preparing",
      })
    ).toBe("outbox")
  })
})
