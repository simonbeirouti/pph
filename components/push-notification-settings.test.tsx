import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  subscribeToPushAction,
  unsubscribeFromPushAction,
} from "@/app/dashboard/profile/notification-actions"
import { PushNotificationSettings } from "@/components/push-notification-settings"

vi.mock("@/app/dashboard/profile/notification-actions", () => ({
  subscribeToPushAction: vi.fn(),
  unsubscribeFromPushAction: vi.fn(),
}))
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}))

const publicKey =
  "BEl6XbK5mUu8zGxj8ohQzSJ6XU7sDbsCjW1uE0iSQh5z1Nzf-IqGQpKj5wg8KfvdVgmLRDgOP4Aq76iCXBfNDqo"

function installPushMocks(permission: NotificationPermission = "default") {
  const unsubscribe = vi.fn().mockResolvedValue(true)
  const subscription = {
    endpoint: "https://push.example.test/device",
    toJSON: () => ({ keys: { auth: "auth", p256dh: "p256dh" } }),
    unsubscribe,
  }
  const getSubscription = vi.fn().mockResolvedValue(null)
  const subscribe = vi.fn().mockResolvedValue(subscription)
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: { ready: Promise.resolve({ pushManager: { getSubscription, subscribe } }) },
  })
  vi.stubGlobal("PushManager", class {})
  const requestPermission = vi.fn().mockResolvedValue("granted")
  vi.stubGlobal("Notification", { permission, requestPermission })
  return { getSubscription, requestPermission, subscribe, subscription, unsubscribe }
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

describe("push notification settings", () => {
  it("waits for an explicit click before requesting permission", async () => {
    const mocks = installPushMocks()
    vi.mocked(subscribeToPushAction).mockResolvedValue({ ok: true })
    const user = userEvent.setup()

    render(<PushNotificationSettings publicKey={publicKey} />)
    const button = await screen.findByRole("button", {
      name: "Enable notifications",
    })
    expect(mocks.requestPermission).not.toHaveBeenCalled()

    await user.click(button)

    expect(mocks.requestPermission).toHaveBeenCalledOnce()
    expect(mocks.subscribe).toHaveBeenCalledWith(
      expect.objectContaining({ userVisibleOnly: true })
    )
    expect(subscribeToPushAction).toHaveBeenCalledWith({
      endpoint: mocks.subscription.endpoint,
      keys: { auth: "auth", p256dh: "p256dh" },
      userAgent: navigator.userAgent,
    })
    await screen.findByRole("button", { name: "Disable on this browser" })
  })

  it("shows denied state without requesting permission", async () => {
    const mocks = installPushMocks("denied")
    render(<PushNotificationSettings publicKey={publicKey} />)

    expect(
      await screen.findByText(/blocked in this browser's site settings/)
    ).toBeVisible()
    expect(screen.getByRole("button", { name: "Enable notifications" })).toBeDisabled()
    expect(mocks.requestPermission).not.toHaveBeenCalled()
  })

  it("unsubscribes the current browser and deactivates its endpoint", async () => {
    const mocks = installPushMocks("granted")
    mocks.getSubscription.mockResolvedValue(mocks.subscription)
    vi.mocked(unsubscribeFromPushAction).mockResolvedValue({ ok: true })
    const user = userEvent.setup()
    render(<PushNotificationSettings publicKey={publicKey} />)

    await user.click(
      await screen.findByRole("button", { name: "Disable on this browser" })
    )

    await waitFor(() =>
      expect(unsubscribeFromPushAction).toHaveBeenCalledWith(
        mocks.subscription.endpoint
      )
    )
    expect(mocks.unsubscribe).toHaveBeenCalledOnce()
  })

  it("reports unsupported when VAPID is not configured", async () => {
    render(<PushNotificationSettings publicKey="" />)
    expect(
      await screen.findByText(/not configured for this environment/)
    ).toBeVisible()
  })
})
