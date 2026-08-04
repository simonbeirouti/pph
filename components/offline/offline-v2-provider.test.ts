import { describe, expect, it, vi } from "vitest"

import { runTrailingRefreshLoop } from "@/components/offline/offline-v2-provider"

describe("offline refresh coordination", () => {
  it("runs a trailing pass when invalidated during an in-flight refresh", async () => {
    let releaseFirst!: () => void
    const first = new Promise<void>((resolve) => {
      releaseFirst = resolve
    })
    const queued = { current: false }
    const refresh = vi
      .fn<() => Promise<void>>()
      .mockImplementationOnce(() => first)
      .mockResolvedValueOnce(undefined)

    const result = runTrailingRefreshLoop(queued, refresh, () => true)
    await Promise.resolve()
    queued.current = true
    releaseFirst()
    await result

    expect(refresh).toHaveBeenCalledTimes(2)
  })

  it("does not retry while the browser is offline", async () => {
    const queued = { current: true }
    const refresh = vi.fn(async () => {
      queued.current = true
    })

    await runTrailingRefreshLoop(queued, refresh, () => false)

    expect(refresh).toHaveBeenCalledOnce()
  })
})
