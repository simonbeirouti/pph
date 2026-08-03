import { act, cleanup, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { useOfflineV2Actions } from "@/components/offline-v2-actions"

const mocks = vi.hoisted(() => ({
  getOperations: vi.fn().mockResolvedValue([]),
  queueOperation: vi.fn().mockResolvedValue(true),
  state: {
    canMutate: false,
    canQueueOfflineMutation: false,
    isOnline: true,
    navigationMode: "next" as const,
    networkReachability: "online" as const,
    repositoryState: "preparing" as const,
    usesLocalRepository: false,
    viewSource: "server" as const,
  },
}))

vi.mock("@/components/offline-v2-provider", () => ({
  useOptionalOfflineV2: () => ({
    ...mocks.state,
    queueOperation: mocks.queueOperation,
  }),
}))

vi.mock("@/lib/offline-v2/storage", () => ({
  getOfflineV2Operations: mocks.getOperations,
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe("useOfflineV2Actions", () => {
  it("holds preparation-time mutations for the durable outbox", async () => {
    const { result } = renderHook(() => useOfflineV2Actions())

    expect(result.current.mutationTransport).toBe("outbox")
    expect(result.current.usesLocalRepository).toBe(true)

    await act(async () => {
      await expect(
        result.current.queue({
          entityId: "local-job",
          entityType: "job",
          kind: "job.create",
        })
      ).resolves.toBe(true)
    })
    expect(mocks.queueOperation).toHaveBeenCalledOnce()
  })
})
