import type { Page } from "@playwright/test"
import { createClient } from "@supabase/supabase-js"

import { expect, test } from "./fixtures"

test.skip(
  ({ browserName }) => browserName === "webkit",
  "Playwright WebKit does not expose service-worker offline emulation reliably; this path is covered by the required real iOS PWA checkpoint."
)

async function prepare(page: Page) {
  const bootstrapResponse = page.waitForResponse((response) =>
    response.url().endsWith("/api/offline/bootstrap")
  )
  await page.goto("/dashboard")
  expect((await bootstrapResponse).status()).toBe(200)
  await page.evaluate(() => navigator.serviceWorker.ready)
  await expect(page.locator("[data-offline-provider]").first()).toHaveAttribute(
    "data-offline-provider",
    "offline_ready",
    {
      timeout: 30_000,
    }
  )
  await expect(page.getByText("Offline ready", { exact: true })).toHaveCount(0)
}

async function verifyOfflineRoutes(page: Page, routes: string[]) {
  for (const route of routes) {
    await page.evaluate((href) => {
      window.history.pushState(null, "", href)
      window.dispatchEvent(new PopStateEvent("popstate"))
    }, route)
    await expect(page.getByText("No current offline work")).toHaveCount(0)
    await expect(
      page.getByText("Connect once to prepare this device")
    ).toHaveCount(0)
    await expect(
      page.locator("[data-offline-provider]").first()
    ).toHaveAttribute("data-offline-provider", "offline")
  }
}

test("owner bootstraps once, then navigates across the dashboard offline", async ({
  context,
  ownerPage,
}) => {
  await prepare(ownerPage)
  await context.setOffline(true)
  await verifyOfflineRoutes(ownerPage, [
    "/dashboard",
    "/dashboard/jobs",
    "/dashboard/roster",
    "/dashboard/employees",
    "/dashboard/templates",
    "/dashboard/profile",
  ])

  await ownerPage.evaluate(() => {
    window.history.pushState(null, "", "/dashboard/jobs")
    window.dispatchEvent(new PopStateEvent("popstate"))
  })
  await ownerPage.getByRole("button", { name: "Create job" }).click()
  await ownerPage.getByLabel("Title").fill(`Offline owner ${Date.now()}`)
  await ownerPage
    .getByRole("button", { name: "Create job", exact: true })
    .last()
    .click()
  await expect(
    ownerPage.locator("[data-offline-provider]").first()
  ).toHaveAttribute("data-offline-provider", "changes_pending")
})

test("a warm online owner keeps App Router navigation and server screens", async ({
  ownerPage,
}) => {
  await prepare(ownerPage)
  const dashboardRscRequests: string[] = []
  ownerPage.on("request", (request) => {
    const url = new URL(request.url())
    if (
      url.pathname.startsWith("/dashboard") &&
      url.searchParams.has("_rsc")
    ) {
      dashboardRscRequests.push(url.toString())
    }
  })

  await clickDashboardNavigation(ownerPage, "Jobs")
  await expect(ownerPage).toHaveURL(/\/dashboard\/jobs$/)
  await expect(
    ownerPage.getByRole("status", { name: "Loading jobs" })
  ).toHaveCount(0)
  await clickDashboardNavigation(ownerPage, "Employees")
  await expect(ownerPage).toHaveURL(/\/dashboard\/employees$/)
  await expect
    .poll(() => dashboardRscRequests.length, { timeout: 10_000 })
    .toBeGreaterThan(0)
  await expect(
    ownerPage.locator("[data-offline-provider]").first()
  ).toHaveAttribute("data-view-source", "server")
})

test("an online owner mutation uses the server action and leaves the outbox empty", async ({
  ownerPage,
}) => {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
  const title = `Server-first online ${Date.now()}`
  let offlineJobCreateRequests = 0
  ownerPage.on("request", (request) => {
    if (
      request.url().endsWith("/api/offline/sync") &&
      request.method() === "POST"
    ) {
      const body = request.postDataJSON() as {
        operations?: Array<{ clientOperationId: string; kind: string }>
      }
      const create = body.operations?.find(
        (operation) => operation.kind === "job.create"
      )
      if (create) offlineJobCreateRequests += 1
    }
  })

  try {
    await prepare(ownerPage)
    await clickDashboardNavigation(ownerPage, "Jobs")
    await ownerPage.getByRole("button", { name: "Create job" }).click()
    await ownerPage.getByLabel("Title").fill(title)
    await ownerPage
      .getByRole("button", { name: "Create job", exact: true })
      .last()
      .click()
    await expect(ownerPage.getByText(title, { exact: true })).toBeVisible()
    await expect
      .poll(() => offlineOutboxCount(ownerPage), { timeout: 30_000 })
      .toBe(0)
    await expect
      .poll(async () => {
        const { count } = await admin
          .from("jobs")
          .select("*", { count: "exact", head: true })
          .eq("title", title)
        return count
      })
      .toBe(1)
    expect(offlineJobCreateRequests).toBe(0)
  } finally {
    await admin.from("jobs").delete().eq("title", title)
  }
})

test("cache bootstrap does not replace or reset the online profile form", async ({
  ownerPage,
}) => {
  let releaseBootstrap!: () => void
  const bootstrapGate = new Promise<void>((resolve) => {
    releaseBootstrap = resolve
  })
  await ownerPage.route("**/api/offline/bootstrap", async (route) => {
    await bootstrapGate
    await route.continue()
  })

  await ownerPage.goto("/dashboard/profile")
  const phone = ownerPage.getByLabel("Phone")
  await expect(phone).toBeEnabled()
  const originalBounds = await phone.boundingBox()
  expect(originalBounds).not.toBeNull()
  await phone.fill("+61 400 123 987")
  releaseBootstrap()
  await expect(
    ownerPage.locator("[data-repository-state]").first()
  ).toHaveAttribute("data-repository-state", "ready", { timeout: 30_000 })
  await expect(
    ownerPage.locator("[data-offline-provider]").first()
  ).toHaveAttribute("data-view-source", "server")
  await expect(phone).toHaveValue("+61 400 123 987")
  await expect(
    ownerPage.getByText("Profile information", { exact: true })
  ).toHaveCount(1)
  const hydratedBounds = await phone.boundingBox()
  expect(hydratedBounds).not.toBeNull()
  expect(Math.round(hydratedBounds!.width)).toBe(
    Math.round(originalBounds!.width)
  )
  expect(Math.round(hydratedBounds!.x)).toBe(Math.round(originalBounds!.x))
})

test("manager receives both operations routes and personal assigned work offline", async ({
  context,
  managerPage,
}) => {
  await prepare(managerPage)
  await context.setOffline(true)
  await verifyOfflineRoutes(managerPage, [
    "/dashboard",
    "/dashboard/jobs",
    "/dashboard/jobs?mode=my-work",
    "/dashboard/roster",
    "/dashboard/employees",
    "/dashboard/templates?view=schedules",
    "/dashboard/profile",
  ])
})

test("employee opens unseen permitted routes and queues work offline", async ({
  context,
  employeePage,
}) => {
  await prepare(employeePage)
  await context.setOffline(true)
  await verifyOfflineRoutes(employeePage, [
    "/dashboard",
    "/dashboard/jobs",
    "/dashboard/roster",
    "/dashboard/profile",
  ])

  await employeePage.evaluate(() => {
    window.history.pushState(null, "", "/dashboard/jobs")
    window.dispatchEvent(new PopStateEvent("popstate"))
  })
  const start = employeePage.getByRole("button", { name: "Start job" }).first()
  if (await start.isVisible()) {
    await start.click()
    await expect(
      employeePage.locator("[data-offline-provider]").first()
    ).toHaveAttribute("data-offline-provider", "changes_pending")
  }
})

test("a cold device gets a connect-once explanation instead of personalised data", async ({
  context,
  page,
}) => {
  await page.goto("/offline")
  await page.evaluate(() => navigator.serviceWorker.ready)
  await expect(
    page
      .getByText("Connect once to prepare this device", { exact: true })
      .last()
  ).toBeVisible()
  await context.setOffline(true)
  await expect(
    page
      .getByText("Connect once to prepare this device", { exact: true })
      .last()
  ).toBeVisible()
})

function offlineOutboxCount(page: Page) {
  return page.evaluate(
    () =>
      new Promise<number>((resolve, reject) => {
        const request = indexedDB.open("pph-offline-v2")
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const count = request.result
            .transaction("outbox", "readonly")
            .objectStore("outbox")
            .count()
          count.onerror = () => reject(count.error)
          count.onsuccess = () => resolve(count.result)
        }
      })
  )
}

async function clickDashboardNavigation(page: Page, name: string) {
  const link = page
    .locator('a[data-sidebar="menu-button"]')
    .filter({ hasText: new RegExp(`^${name}$`) })
  const mobileToggle = page.getByRole("button", { name: "Toggle navigation" })
  const mobile = (page.viewportSize()?.width ?? 1024) < 768
  if (!(await link.isVisible())) {
    await mobileToggle.click()
    await expect(link).toBeVisible()
  }
  await link.click()
  if (mobile) await expect(link).toBeHidden()
}
