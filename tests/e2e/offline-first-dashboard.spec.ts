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

test("a warm online owner navigates locally without dashboard RSC requests", async ({
  ownerPage,
}) => {
  await prepare(ownerPage)
  const dashboardRscRequests: string[] = []
  ownerPage.on("request", (request) => {
    const url = new URL(request.url())
    if (url.pathname.startsWith("/dashboard") && url.searchParams.has("_rsc")) {
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
  await ownerPage.waitForTimeout(500)
  expect(dashboardRscRequests).toEqual([])
  await expect(
    ownerPage.locator("[data-offline-provider]").first()
  ).toHaveAttribute("data-view-source", "cache")
})

test("a prepared job opens from IndexedDB without a detail route fetch", async ({
  employeePage,
}) => {
  await prepare(employeePage)
  await employeePage.goto("/dashboard/jobs")
  const openLink = employeePage
    .getByRole("button", { name: "Open job" })
    .first()
  await expect(openLink).toBeVisible()
  const href = await openLink.getAttribute("href")
  expect(href).toMatch(/^\/dashboard\/jobs\?job=\d+$/)
  const jobId = Number(
    new URL(href!, "https://pph.test").searchParams.get("job")
  )
  const cachedDetail = await cachedJobDetail(employeePage, jobId)
  expect(cachedDetail).not.toBeNull()

  let detailRequests = 0
  const dashboardRscRequests: string[] = []
  employeePage.on("request", (request) => {
    const url = new URL(request.url())
    if (url.pathname.startsWith("/dashboard") && url.searchParams.has("_rsc")) {
      dashboardRscRequests.push(url.toString())
    }
  })
  await employeePage.route(`**/api/jobs/${jobId}`, async (route) => {
    detailRequests += 1
    await route.continue()
  })

  const openedAt = Date.now()
  await openLink.click()
  await expect(
    employeePage.getByRole("heading", { name: cachedDetail!.title })
  ).toBeVisible()
  expect(Date.now() - openedAt).toBeLessThan(200)
  await employeePage.waitForTimeout(500)
  expect(detailRequests).toBe(0)
  expect(dashboardRscRequests).toEqual([])
})

test("an online owner mutation uses one durable operation and one receipt", async ({
  ownerPage,
}) => {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
  const title = `Local-first online ${Date.now()}`
  let offlineJobCreateRequests = 0
  let clientOperationId: string | null = null
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
      if (create) {
        offlineJobCreateRequests += 1
        clientOperationId = create.clientOperationId
      }
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
    expect(offlineJobCreateRequests).toBe(1)
    expect(clientOperationId).not.toBeNull()
    await expect
      .poll(async () => {
        const { count } = await admin
          .from("offline_operation_receipts")
          .select("*", { count: "exact", head: true })
          .eq("client_operation_id", clientOperationId!)
        return count
      })
      .toBe(1)
  } finally {
    await admin.from("jobs").delete().eq("title", title)
  }
})

test("cold SSR remains visible and usable until the repository is prepared", async ({
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
  await expect(phone).toBeVisible()
  await expect(phone).toBeEditable()
  const originalBounds = await phone.boundingBox()
  expect(originalBounds).not.toBeNull()
  await phone.fill("+61 400 123 987")
  releaseBootstrap()
  await expect(
    ownerPage.locator("[data-repository-state]").first()
  ).toHaveAttribute("data-repository-state", "ready", { timeout: 30_000 })
  await expect(
    ownerPage.locator("[data-offline-provider]").first()
  ).toHaveAttribute("data-view-source", "cache")
  await expect(phone).toBeEditable()
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

test("a prepared online hard reload is served by the public shell", async ({
  ownerPage,
}) => {
  await prepare(ownerPage)
  await clickDashboardNavigation(ownerPage, "Jobs")
  const title = await ownerPage.getByRole("heading").first().textContent()
  expect(title).toBeTruthy()

  const documentResponse = ownerPage.waitForResponse(
    (response) =>
      response.request().resourceType() === "document" &&
      new URL(response.url()).pathname === "/dashboard/jobs"
  )
  await ownerPage.reload()
  const response = await documentResponse
  expect(response.fromServiceWorker()).toBe(true)
  await expect(ownerPage).toHaveURL(/\/dashboard\/jobs$/)
  await expect(ownerPage.getByRole("heading").first()).toContainText(title!)
  await expect(
    ownerPage.locator("[data-offline-provider]").first()
  ).toHaveAttribute("data-view-source", "cache")
  await expect(ownerPage.getByRole("status", { name: /Loading/i })).toHaveCount(
    0
  )
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

async function cachedJobDetail(page: Page, jobId: number) {
  return page.evaluate(
    (id) =>
      new Promise<{ id: number; title: string } | null>((resolve, reject) => {
        const request = indexedDB.open("pph-offline-v2")
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const value = request.result
            .transaction("snapshots", "readonly")
            .objectStore("snapshots")
            .get("active")
          value.onerror = () => reject(value.error)
          value.onsuccess = () =>
            resolve(value.result?.jobDetails?.[id] ?? null)
        }
      }),
    jobId
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
