import type { Page } from "@playwright/test"

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
  await expect(
    page.locator('[data-offline-status="offline_ready"]')
  ).toBeVisible({ timeout: 30_000 })
}

async function verifyOfflineRoutes(page: Page, routes: string[]) {
  for (const route of routes) {
    await page.evaluate((href) => {
      window.history.pushState(null, "", href)
      window.dispatchEvent(new PopStateEvent("popstate"))
    }, route)
    await expect(page.getByText("No current offline work")).toHaveCount(0)
    await expect(page.getByText("Connect once to prepare this device")).toHaveCount(0)
    await expect(
      page.locator('[data-offline-status="offline"]').first()
    ).toBeVisible()
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
    ownerPage.locator('[data-offline-status="changes_pending"]')
  ).toBeVisible()
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
      employeePage.locator('[data-offline-status="changes_pending"]')
    ).toBeVisible()
  }
})

test("a cold device gets a connect-once explanation instead of personalised data", async ({
  context,
  page,
}) => {
  await page.goto("/offline")
  await page.evaluate(() => navigator.serviceWorker.ready)
  await expect(
    page.getByText("Connect once to prepare this device", { exact: true }).last()
  ).toBeVisible()
  await context.setOffline(true)
  await expect(
    page.getByText("Connect once to prepare this device", { exact: true }).last()
  ).toBeVisible()
})
