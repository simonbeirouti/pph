import { devices } from "@playwright/test"
import { createClient } from "@supabase/supabase-js"

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

test("reopened work resubmits after start and submit straddle sync passes", async ({
  browser,
  managerPage,
}, testInfo) => {
  test.setTimeout(150_000)
  test.skip(
    testInfo.project.name !== "chromium",
    "This multi-session checkpoint creates isolated desktop contexts."
  )

  const title = `Reopened sync race ${Date.now()}`
  const ownerContext = await browser.newContext({
    ...devices["Desktop Chrome"],
  })
  const employeeContext = await browser.newContext({
    ...devices["Desktop Chrome"],
  })
  let releaseStartSync!: () => void
  const startSyncRelease = new Promise<void>((resolve) => {
    releaseStartSync = resolve
  })
  let markStartApplied!: () => void
  const startApplied = new Promise<void>((resolve) => {
    markStartApplied = resolve
  })
  let markSubmitSyncStarted!: () => void
  const submitSyncStarted = new Promise<void>((resolve) => {
    markSubmitSyncStarted = resolve
  })
  let heldStart = false
  let holdStart = false

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
    await expect(
      employeePage.locator("[data-offline-provider]").first()
    ).toHaveAttribute("data-offline-provider", "offline_ready", {
      timeout: 30_000,
    })

    await ownerPage.getByRole("button", { name: "Create job" }).click()
    const createDialog = ownerPage.getByRole("dialog")
    await createDialog.getByLabel("Title").fill(title)
    await createDialog.getByLabel("Assignee").click()
    await ownerPage.getByRole("option", { name: "Alex Employee" }).click()
    await createDialog.getByRole("button", { name: "Create job" }).click()

    const ownerAssigned = ownerPage.getByRole("region", {
      name: "Assigned jobs",
    })
    const ownerReview = ownerPage.getByRole("region", {
      name: "To review jobs",
    })
    const managerReview = managerPage.getByRole("region", {
      name: "To review jobs",
    })
    const employeeJob = employeePage.getByRole("article", {
      name: `Job ${title}`,
    })
    const ownerJob = ownerPage.getByRole("article", {
      name: `Job ${title}`,
    })
    await Promise.all([
      expect(employeeJob).toBeVisible(),
      expect(ownerJob).toBeVisible(),
    ])
    const jobHref = await ownerJob
      .locator(
        'a[role="button"][href^="/dashboard/jobs?job="]:not([href*="job=-"])'
      )
      .getAttribute("href")
    const jobId = Number(
      new URL(jobHref!, "http://localhost").searchParams.get("job")
    )
    expect(jobId).toBeGreaterThan(0)

    await employeeJob.getByRole("button", { name: "Submit for review" }).click()
    await expect
      .poll(async () => {
        const response = await ownerPage.request.get(
          `/api/jobs/live?ids=${jobId}&scope=team`
        )
        if (!response.ok()) return null
        const body = (await response.json()) as {
          jobs?: Array<{ id: number; status: string }>
        }
        return body.jobs?.find((job) => job.id === jobId)?.status ?? null
      })
      .toBe("in_review")
    await ownerPage.evaluate(() =>
      window.dispatchEvent(new Event("pph:offline-invalidate"))
    )
    await expect(
      ownerReview.getByRole("article", { name: `Job ${title}` })
    ).toBeVisible({ timeout: 10_000 })

    await ownerReview
      .getByRole("article", { name: `Job ${title}` })
      .getByRole("button", { name: "Open job" })
      .click()
    const ownerSheet = ownerPage.locator('[data-slot="sheet-content"]')
    await ownerSheet.getByRole("button", { name: "Reopen job" }).click()
    const reopenDialog = ownerPage.getByRole("dialog", { name: "Reopen job" })
    await reopenDialog.getByLabel("Feedback").fill("Please check it again.")
    await reopenDialog.getByLabel("Assign to").click()
    await ownerPage.getByRole("option", { name: "Alex Employee" }).click()
    await reopenDialog.getByRole("button", { name: "Reopen job" }).click()
    await expect(reopenDialog).not.toBeVisible()
    await expect(
      ownerAssigned.getByRole("article", { name: `Job ${title}` })
    ).toBeVisible({ timeout: 5_000 })
    await expect(employeeJob).toBeVisible({ timeout: 5_000 })

    await employeePage.route("**/api/offline/sync", async (route) => {
      const body = route.request().postDataJSON() as {
        operations?: Array<{ kind?: string }>
      }
      const kinds = body.operations?.map((operation) => operation.kind) ?? []
      if (holdStart && !heldStart && kinds.includes("job.start")) {
        heldStart = true
        const response = await route.fetch()
        markStartApplied()
        await startSyncRelease
        await route.fulfill({ response })
        return
      }
      if (heldStart && kinds.includes("job.submit")) {
        markSubmitSyncStarted()
      }
      await route.continue()
    })

    holdStart = true
    await employeeJob.getByRole("button", { name: "Open job" }).click()
    await employeePage.getByRole("button", { name: "Start job" }).click()
    await startApplied
    await employeePage.keyboard.press("Escape")
    await expect(
      employeePage.locator('[data-slot="sheet-content"]')
    ).toBeHidden()
    await employeeJob.getByRole("button", { name: "Submit for review" }).click()
    await employeePage.getByRole("tab", { name: /Submitted/ }).click()
    await expect(employeeJob.getByText("in review")).toBeVisible()

    releaseStartSync()
    await submitSyncStarted
    holdStart = false

    await expect(
      employeePage.locator("[data-offline-provider]").first()
    ).toHaveAttribute("data-offline-provider", "offline_ready", {
      timeout: 30_000,
    })
    await expect
      .poll(() => getOfflineOutboxCount(employeePage), { timeout: 10_000 })
      .toBe(0)
    await expect(
      ownerReview.getByRole("article", { name: `Job ${title}` })
    ).toBeVisible({ timeout: 2_000 })
    await expect(
      managerReview.getByRole("article", { name: `Job ${title}` })
    ).toBeVisible({ timeout: 2_000 })

    const liveResponse = await ownerPage.request.get(
      `/api/jobs/live?ids=${jobId}&scope=team`
    )
    expect(liveResponse.ok()).toBe(true)
    expect(await liveResponse.json()).toMatchObject({
      jobs: [expect.objectContaining({ id: jobId, status: "in_review" })],
    })
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )
    const { data: savedJob, error } = await admin
      .from("jobs")
      .select("status")
      .eq("id", jobId)
      .single()
    expect(error).toBeNull()
    expect(savedJob?.status).toBe("in_review")
  } finally {
    releaseStartSync()
    await Promise.all([ownerContext.close(), employeeContext.close()])
  }
})

async function getOfflineOutboxCount(page: import("@playwright/test").Page) {
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
