import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  subscribeToPushAction,
  unsubscribeFromPushAction,
} from "@/app/dashboard/profile/notification-actions"
import { PushNotificationPrompt } from "@/components/notifications/push-notification-prompt"
import { PushNotificationProvider } from "@/components/notifications/push-notification-provider"
import { PushNotificationSettings } from "@/components/notifications/push-notification-settings"

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
    value: {
      ready: Promise.resolve({
        pushManager: { getSubscription, subscribe },
      }),
    },
  })
  vi.stubGlobal("PushManager", class {})
  const requestPermission = vi.fn().mockResolvedValue("granted")
  vi.stubGlobal("Notification", { permission, requestPermission })
  return {
    getSubscription,
    requestPermission,
    subscribe,
    subscription,
    unsubscribe,
  }
}

function renderSettings(key = publicKey) {
  return render(
    <PushNotificationProvider publicKey={key}>
      <PushNotificationSettings />
    </PushNotificationProvider>
  )
}

function renderNotificationExperience() {
  return render(
    <PushNotificationProvider publicKey={publicKey}>
      <PushNotificationPrompt />
      <PushNotificationSettings />
    </PushNotificationProvider>
  )
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

describe("push notification settings", () => {
  it("prompts on launch and persists a subscription after user approval", async () => {
    const mocks = installPushMocks()
    vi.mocked(subscribeToPushAction).mockResolvedValue({ ok: true })
    const user = userEvent.setup()

    renderNotificationExperience()

    const prompt = await screen.findByRole("region", {
      name: "Turn on notifications",
    })
    expect(mocks.requestPermission).not.toHaveBeenCalled()
    await user.click(
      within(prompt).getByRole("button", { name: "Enable notifications" })
    )
    await screen.findByRole("button", { name: "Disable on this browser" })
    expect(prompt).not.toBeInTheDocument()
    expect(mocks.requestPermission).toHaveBeenCalledOnce()
    expect(mocks.subscribe).toHaveBeenCalledWith(
      expect.objectContaining({ userVisibleOnly: true })
    )
    expect(subscribeToPushAction).toHaveBeenCalledWith({
      endpoint: mocks.subscription.endpoint,
      keys: { auth: "auth", p256dh: "p256dh" },
      userAgent: navigator.userAgent,
    })
  })

  it("shows a launch-time denial with recovery instructions", async () => {
    const mocks = installPushMocks("denied")
    renderSettings()

    expect(
      await screen.findByText(/blocked in this browser's site settings/)
    ).toBeVisible()
    expect(
      screen.getByRole("button", {
        name: "Check and enable notifications",
      })
    ).toBeEnabled()
    expect(
      screen.getByText(/set Notifications to Allow, then check again/)
    ).toBeVisible()
    expect(mocks.requestPermission).not.toHaveBeenCalled()
  })

  it("allows a manual retry after the permission prompt is dismissed", async () => {
    const mocks = installPushMocks()
    mocks.requestPermission
      .mockResolvedValueOnce("default")
      .mockResolvedValueOnce("granted")
    vi.mocked(subscribeToPushAction).mockResolvedValue({ ok: true })
    const user = userEvent.setup()
    renderSettings()

    const enableButton = await screen.findByRole("button", {
      name: "Enable notifications",
    })
    await user.click(enableButton)
    await user.click(enableButton)

    expect(mocks.requestPermission).toHaveBeenCalledTimes(2)
    await screen.findByRole("button", { name: "Disable on this browser" })
  })

  it("recognises an existing subscription without requesting permission", async () => {
    const mocks = installPushMocks("granted")
    mocks.getSubscription.mockResolvedValue(mocks.subscription)
    renderSettings()

    await screen.findByRole("button", { name: "Disable on this browser" })
    expect(mocks.requestPermission).not.toHaveBeenCalled()
    expect(mocks.subscribe).not.toHaveBeenCalled()
  })

  it("respects a previously disabled browser when permission remains granted", async () => {
    const mocks = installPushMocks("granted")
    renderSettings()

    expect(
      await screen.findByRole("button", { name: "Enable notifications" })
    ).toBeEnabled()
    expect(mocks.requestPermission).not.toHaveBeenCalled()
    expect(mocks.subscribe).not.toHaveBeenCalled()
  })

  it("keeps failed enrollment non-blocking", async () => {
    installPushMocks()
    vi.mocked(subscribeToPushAction).mockResolvedValue({
      message: "Push notifications could not be enabled.",
      ok: false,
    })
    const user = userEvent.setup()
    renderSettings()

    await user.click(
      await screen.findByRole("button", { name: "Enable notifications" })
    )
    expect(
      await screen.findByText("Push notifications could not be enabled.")
    ).toBeVisible()
    expect(
      screen.getByRole("button", { name: "Enable notifications" })
    ).toBeEnabled()
  })

  it("unsubscribes the current browser and deactivates its endpoint", async () => {
    const mocks = installPushMocks("granted")
    mocks.getSubscription.mockResolvedValue(mocks.subscription)
    vi.mocked(unsubscribeFromPushAction).mockResolvedValue({ ok: true })
    const user = userEvent.setup()
    renderSettings()

    await user.click(
      await screen.findByRole("button", {
        name: "Disable on this browser",
      })
    )

    await waitFor(() =>
      expect(unsubscribeFromPushAction).toHaveBeenCalledWith(
        mocks.subscription.endpoint
      )
    )
    expect(mocks.unsubscribe).toHaveBeenCalledOnce()
  })

  it("reports unsupported when VAPID is not configured", async () => {
    renderSettings("")
    expect(
      await screen.findByText(/not configured for this environment/)
    ).toBeVisible()
  })
})
