import { cleanup, render, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  registerServiceWorker,
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

  it("does not render UI or block the application when registration rejects", async () => {
    const register = vi.fn().mockRejectedValue(new Error("unavailable"))
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { register },
    })

    const { container } = render(<ServiceWorkerRegistration />)

    expect(container).toBeEmptyDOMElement()
    await waitFor(() => expect(register).toHaveBeenCalledOnce())
  })
})
