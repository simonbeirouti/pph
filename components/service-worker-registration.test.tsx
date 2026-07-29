import { cleanup, render, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  registerServiceWorker,
  resetDevelopmentServiceWorker,
  ServiceWorkerRegistration,
} from "@/components/service-worker-registration"

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe("service-worker registration", () => {
  it("registers the root worker without using the HTTP cache", async () => {
    const registration = {} as ServiceWorkerRegistration
    const register = vi.fn().mockResolvedValue(registration)

    await expect(
      registerServiceWorker({ register } as unknown as ServiceWorkerContainer)
    ).resolves.toBe(registration)
    expect(register).toHaveBeenCalledWith("/sw.js", {
      scope: "/",
      updateViaCache: "none",
    })
  })

  it("returns safely when service workers are unsupported or registration fails", async () => {
    await expect(registerServiceWorker(undefined)).resolves.toBeNull()
    await expect(
      registerServiceWorker({
        register: vi.fn().mockRejectedValue(new Error("unavailable")),
      } as unknown as ServiceWorkerContainer)
    ).resolves.toBeNull()
  })

  it("clears stale development workers and shell caches without rendering UI", async () => {
    const unregister = vi.fn().mockResolvedValue(true)
    const getRegistrations = vi
      .fn()
      .mockResolvedValue([
        { unregister } as unknown as ServiceWorkerRegistration,
      ])
    const deleteCache = vi.fn().mockResolvedValue(true)
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { getRegistrations },
    })
    Object.defineProperty(window, "caches", {
      configurable: true,
      value: {
        delete: deleteCache,
        keys: vi.fn().mockResolvedValue(["pph-shell-v3", "unrelated"]),
      },
    })

    const { container } = render(<ServiceWorkerRegistration />)

    expect(container).toBeEmptyDOMElement()
    await waitFor(() => expect(unregister).toHaveBeenCalledOnce())
    expect(deleteCache).toHaveBeenCalledExactlyOnceWith("pph-shell-v3")
  })

  it("contains development cleanup failures", async () => {
    await expect(
      resetDevelopmentServiceWorker(
        {
          getRegistrations: vi.fn().mockRejectedValue(new Error("unavailable")),
        } as unknown as ServiceWorkerContainer,
        undefined
      )
    ).resolves.toBeUndefined()
  })
})
