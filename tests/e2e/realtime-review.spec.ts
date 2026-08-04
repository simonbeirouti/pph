import { devices } from "@playwright/test"

import { authenticate, expect, test } from "./fixtures"

test("submitted work moves from Assigned to To review within two seconds", async ({
  browser,
  managerPage,
}, testInfo) => {
  test.setTimeout(120_000)
  test.skip(
    testInfo.project.name !== "chromium",
    "This multi-session checkpoint creates isolated desktop contexts."
  )

  const title = `Realtime review ${Date.now()}`
  const ownerContext = await browser.newContext({
    ...devices["Desktop Chrome"],
  })
  const employeeContext = await browser.newContext({
    ...devices["Desktop Chrome"],
  })
  let releaseOwnerSync!: () => void
  const ownerSyncRelease = new Promise<void>((resolve) => {
    releaseOwnerSync = resolve
  })
  let markOwnerSyncStarted!: () => void
  const ownerSyncStarted = new Promise<void>((resolve) => {
    markOwnerSyncStarted = resolve
  })
  let markTrailingSyncStarted!: () => void
  const trailingSyncStarted = new Promise<void>((resolve) => {
    markTrailingSyncStarted = resolve
  })
  let heldSyncCaptured = false
  let holdOwnerSync = false

  try {
    await Promise.all([
      authenticate(ownerContext, "owner@example.test"),
      authenticate(employeeContext, "employee@example.test"),
    ])
    const ownerPage = await ownerContext.newPage()
    const employeePage = await employeeContext.newPage()

    await Promise.all([
      ownerPage.goto("/dashboard/jobs"),
      employeePage.goto("/dashboard/jobs"),
      managerPage.goto("/dashboard/jobs"),
    ])
    await Promise.all(
      [ownerPage, employeePage, managerPage].map((page) =>
        expect(
          page.locator('[data-realtime-status="connected"]')
        ).toBeAttached()
      )
    )

    await ownerPage.route("**/api/offline/sync", async (route) => {
      if (heldSyncCaptured) {
        markTrailingSyncStarted()
        await route.continue()
        return
      }
      if (!holdOwnerSync) {
        await route.continue()
        return
      }
      heldSyncCaptured = true
      const staleResponse = await route.fetch()
      markOwnerSyncStarted()
      await ownerSyncRelease
      await route.fulfill({ response: staleResponse })
    })

    await ownerPage.getByRole("button", { name: "Create job" }).click()
    const createDialog = ownerPage.getByRole("dialog")
    await createDialog.getByLabel("Title").fill(title)
    await createDialog.getByLabel("Assignee").click()
    await ownerPage.getByRole("option", { name: "Alex Employee" }).click()
    await createDialog.getByRole("button", { name: "Create job" }).click()

    const employeeJob = employeePage.getByRole("article", {
      name: `Job ${title}`,
    })
    await expect(employeeJob).toBeVisible()

    const assignedColumn = ownerPage.getByRole("region", {
      name: "Assigned jobs",
    })
    const reviewColumn = ownerPage.getByRole("region", {
      name: "To review jobs",
    })
    const managerReviewColumn = managerPage.getByRole("region", {
      name: "To review jobs",
    })
    await expect(
      assignedColumn.getByRole("article", { name: `Job ${title}` })
    ).toBeVisible()

    holdOwnerSync = true
    await ownerPage.evaluate(() =>
      window.dispatchEvent(new Event("pph:offline-invalidate"))
    )
    await ownerSyncStarted
    await employeeJob.getByRole("button", { name: "Submit for review" }).click()

    await expect(
      assignedColumn.getByRole("article", { name: `Job ${title}` })
    ).toHaveCount(0, { timeout: 2_000 })
    await expect(
      reviewColumn.getByRole("article", { name: `Job ${title}` })
    ).toBeVisible({ timeout: 2_000 })
    await expect(
      managerReviewColumn.getByRole("article", { name: `Job ${title}` })
    ).toBeVisible({ timeout: 2_000 })

    releaseOwnerSync()
    await trailingSyncStarted
    holdOwnerSync = false
  } finally {
    releaseOwnerSync()
    await Promise.all([ownerContext.close(), employeeContext.close()])
  }
})

test("manager-submitted work reaches owner review within two seconds", async ({
  browser,
  managerPage,
}, testInfo) => {
  test.setTimeout(120_000)
  test.skip(
    testInfo.project.name !== "chromium",
    "This multi-session checkpoint creates an isolated owner context."
  )

  const title = `Manager review ${Date.now()}`
  const ownerContext = await browser.newContext({
    ...devices["Desktop Chrome"],
  })

  try {
    await authenticate(ownerContext, "owner@example.test")
    const ownerPage = await ownerContext.newPage()
    await Promise.all([
      ownerPage.goto("/dashboard/jobs"),
      managerPage.goto("/dashboard/jobs?mode=my-work"),
    ])
    await Promise.all(
      [ownerPage, managerPage].map((page) =>
        expect(
          page.locator('[data-realtime-status="connected"]')
        ).toBeAttached()
      )
    )

    await ownerPage.getByRole("button", { name: "Create job" }).click()
    const createDialog = ownerPage.getByRole("dialog")
    await createDialog.getByLabel("Title").fill(title)
    await createDialog.getByLabel("Assignee").click()
    await ownerPage.getByRole("option", { name: "Morgan Manager" }).click()
    await createDialog.getByRole("button", { name: "Create job" }).click()

    const managerJob = managerPage.getByRole("article", {
      name: `Job ${title}`,
    })
    await expect(managerJob).toBeVisible()
    const assignedColumn = ownerPage.getByRole("region", {
      name: "Assigned jobs",
    })
    const reviewColumn = ownerPage.getByRole("region", {
      name: "To review jobs",
    })

    await managerJob.getByRole("button", { name: "Submit for review" }).click()

    await expect(
      assignedColumn.getByRole("article", { name: `Job ${title}` })
    ).toHaveCount(0, { timeout: 2_000 })
    await expect(
      reviewColumn.getByRole("article", { name: `Job ${title}` })
    ).toBeVisible({ timeout: 2_000 })
  } finally {
    await ownerContext.close()
  }
})
