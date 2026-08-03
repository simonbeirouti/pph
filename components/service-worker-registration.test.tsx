import { cleanup, render, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  clearOfflineRepositoryPrepared,
  isOfflineRepositoryPrepared,
  markOfflineRepositoryPrepared,
  OFFLINE_SHELL_VERSION,
  registerServiceWorker,
  resetDevelopmentServiceWorker,
  ServiceWorkerRegistration,
} from "@/components/service-worker-registration"

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
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

  it("marks a prepared repository through the controlled shell", async () => {
    vi.stubEnv("NEXT_PUBLIC_PPH_PLAYWRIGHT_SERVER", "1")
    const postMessage = vi.fn(
      (_message: unknown, ports: readonly MessagePort[]) =>
        ports[0]?.postMessage({ ok: true })
    )
    const serviceWorker = {
      controller: { postMessage },
    } as unknown as ServiceWorkerContainer
    postMessage.mockImplementationOnce(
      (_message: unknown, ports: readonly MessagePort[]) =>
        ports[0]?.postMessage({ version: OFFLINE_SHELL_VERSION })
    )

    await expect(
      markOfflineRepositoryPrepared(serviceWorker, {} as CacheStorage)
    ).resolves.toBe(true)
    expect(postMessage).toHaveBeenLastCalledWith(
      { type: "PPH_OFFLINE_REPOSITORY_READY" },
      expect.any(Array)
    )
  })

  it("clears the readiness marker even without a controlling worker", async () => {
    vi.stubEnv("NEXT_PUBLIC_PPH_PLAYWRIGHT_SERVER", "1")
    const deleteMarker = vi.fn().mockResolvedValue(true)
    const cacheStorage = {
      open: vi.fn().mockResolvedValue({ delete: deleteMarker }),
    } as unknown as CacheStorage

    await expect(
      clearOfflineRepositoryPrepared(undefined, cacheStorage)
    ).resolves.toBe(true)
    expect(deleteMarker).toHaveBeenCalledWith("/offline-repository-ready")
  })

  it("inspects the readiness marker without reading private data", async () => {
    vi.stubEnv("NEXT_PUBLIC_PPH_PLAYWRIGHT_SERVER", "1")
    const match = vi.fn().mockResolvedValue(new Response("ready"))
    const cacheStorage = {
      open: vi.fn().mockResolvedValue({ match }),
    } as unknown as CacheStorage

    await expect(isOfflineRepositoryPrepared(cacheStorage)).resolves.toBe(true)
    expect(match).toHaveBeenCalledWith("/offline-repository-ready")
  })
})
