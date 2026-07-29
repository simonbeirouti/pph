import { createClient } from "@supabase/supabase-js"

import { expect, test } from "./fixtures"

const endpoint = "https://push.example.test/playwright-device"

test("dashboard launch opts in and profile controls opt out and back in", async ({
  employeePage,
}) => {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
  await admin.from("web_push_subscriptions").delete().eq("endpoint", endpoint)

  await employeePage.addInitScript((subscriptionEndpoint) => {
    let currentSubscription: {
      endpoint: string
      toJSON(): { keys: { auth: string; p256dh: string } }
      unsubscribe(): Promise<boolean>
    } | null = null
    const permissionRequests: string[] = []
    Object.defineProperty(window, "__permissionRequests", {
      value: permissionRequests,
    })
    Object.defineProperty(window, "PushManager", {
      configurable: true,
      value: class {},
    })
    Object.defineProperty(window, "Notification", {
      configurable: true,
      value: {
        permission: "default",
        requestPermission: async () => {
          permissionRequests.push("requested")
          return "granted"
        },
      },
    })
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        ready: Promise.resolve({
          pushManager: {
            getSubscription: async () => currentSubscription,
            subscribe: async () => {
              currentSubscription = {
                endpoint: subscriptionEndpoint,
                toJSON: () => ({ keys: { auth: "auth", p256dh: "p256dh" } }),
                unsubscribe: async () => {
                  currentSubscription = null
                  return true
                },
              }
              return currentSubscription
            },
          },
        }),
      },
    })
  }, endpoint)

  try {
    await employeePage.goto("/dashboard/profile")
    const disable = employeePage.getByRole("button", {
      name: "Disable on this browser",
    })
    await expect(disable).toBeVisible()
    await expect
      .poll(() =>
        employeePage.evaluate(
          () =>
            (window as typeof window & { __permissionRequests: string[] })
              .__permissionRequests.length
        )
      )
      .toBe(1)
    const dismissInstallGuidance = employeePage.getByRole("button", {
      name: "Dismiss install guidance",
    })
    if (await dismissInstallGuidance.isVisible()) {
      await dismissInstallGuidance.click()
    }

    await disable.click()
    const enable = employeePage.getByRole("button", {
      name: "Enable notifications",
    })
    await expect(enable).toBeVisible()
    await enable.click()
    await expect(disable).toBeVisible()
    await expect(employeePage.getByText("Offline work")).toHaveCount(0)
  } finally {
    await admin.from("web_push_subscriptions").delete().eq("endpoint", endpoint)
  }
})

test("profile reports browser-denied notification permission", async ({
  employeePage,
}) => {
  await employeePage.addInitScript(() => {
    Object.defineProperty(window, "PushManager", {
      configurable: true,
      value: class {},
    })
    Object.defineProperty(window, "Notification", {
      configurable: true,
      value: { permission: "denied", requestPermission: async () => "denied" },
    })
  })
  await employeePage.goto("/dashboard/profile")

  await expect(
    employeePage.getByText(/blocked in this browser's site settings/)
  ).toBeVisible()
  await expect(
    employeePage.getByRole("button", { name: "Enable notifications" })
  ).toBeDisabled()
})
