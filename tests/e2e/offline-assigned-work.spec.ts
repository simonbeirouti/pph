import path from "node:path"

import { createClient } from "@supabase/supabase-js"

import { expect, test } from "./fixtures"

test.skip(
  ({ browserName }) => browserName === "webkit",
  "Playwright WebKit does not support service-worker testing; verify this journey on a real Safari device over trusted HTTPS."
)

test("employee completes an assigned job through the offline outbox", async ({
  context,
  employeePage,
}) => {
  test.setTimeout(90_000)
  const pageErrors: string[] = []
  const supabaseRequestsWhileOffline: string[] = []
  let offlinePhase = false
  let rejectQueuedUploads = true
  let queuedUploadAttempts = 0
  const queuedUploadResponses: number[] = []
  employeePage.on("pageerror", (error) => pageErrors.push(error.message))
  employeePage.on("request", (request) => {
    const url = new URL(request.url())
    if (offlinePhase && url.port === "54321") {
      supabaseRequestsWhileOffline.push(`${request.method()} ${url.pathname}`)
    }
  })
  await employeePage.route(
    "**/storage/v1/object/upload/sign/job-evidence/**",
    async (route) => {
      if (route.request().method() !== "PUT") {
        await route.continue()
        return
      }
      queuedUploadAttempts += 1
      if (!rejectQueuedUploads) {
        const response = await route.fetch()
        queuedUploadResponses.push(response.status())
        await route.fulfill({ response })
        return
      }
      await route.fulfill({
        body: JSON.stringify({
          message: "The uploaded multipart body has no supported MIME type.",
          statusCode: "400",
        }),
        contentType: "application/json",
        status: 400,
      })
    }
  )
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
  const title = `S11 offline ${Date.now()}`
  const { data: job, error } = await admin
    .from("jobs")
    .insert({
      assignee_membership_id: 1103,
      created_by: 1101,
      minimum_completion_photos: 1,
      organisation_id: 1001,
      requires_completion_note: true,
      status: "assigned",
      title,
    })
    .select("id")
    .single()
  expect(error).toBeNull()

  try {
    await employeePage.goto("/dashboard/jobs")
    await expect(employeePage.locator("[data-offline-provider]")).toHaveCount(1)
    await expect(
      employeePage.locator("[data-offline-provider]").first()
    ).toHaveAttribute("data-offline-provider", "offline_ready", {
      timeout: 30_000,
    })
    await employeePage.evaluate(() => navigator.serviceWorker.ready)
    const persisted = await employeePage.evaluate(
      () =>
        new Promise<boolean>((resolve, reject) => {
          const request = indexedDB.open("pph-offline-v2")
          request.onerror = () => reject(request.error)
          request.onsuccess = () => {
            const transaction = request.result.transaction(
              "snapshots",
              "readonly"
            )
            const value = transaction.objectStore("snapshots").get("active")
            value.onerror = () => reject(value.error)
            value.onsuccess = () => resolve(Boolean(value.result))
          }
        })
    )
    expect(persisted).toBe(true)

    offlinePhase = true
    await context.setOffline(true)
    await employeePage
      .getByRole("article", { name: `Job ${title}` })
      .getByRole("button", { name: "Open job" })
      .click()
    expect(pageErrors).toEqual([])
    const persistedAfterNavigation = await employeePage.evaluate(
      () =>
        new Promise<boolean>((resolve, reject) => {
          const request = indexedDB.open("pph-offline-v2")
          request.onerror = () => reject(request.error)
          request.onsuccess = () => {
            const value = request.result
              .transaction("snapshots", "readonly")
              .objectStore("snapshots")
              .get("active")
            value.onerror = () => reject(value.error)
            value.onsuccess = () => resolve(Boolean(value.result))
          }
        })
    )
    expect(persistedAfterNavigation).toBe(true)
    await expect(
      employeePage.getByRole("heading", { name: title })
    ).toBeVisible()
    await employeePage.getByRole("button", { name: "Start job" }).click()
    await employeePage.getByLabel("Work note").fill("Completed while offline.")
    await employeePage
      .getByLabel("Completion photos", { exact: true })
      .setInputFiles(path.resolve("public/icons/icon-192.png"))
    await expect(
      employeePage.getByRole("img", {
        name: "Selected completion photo preview",
      })
    ).toBeVisible({ timeout: 15_000 })
    await employeePage.getByRole("button", { name: "Save" }).click()
    await expect(employeePage.getByText("1 of 1 required")).toBeVisible({
      timeout: 15_000,
    })
    await expect(
      employeePage.getByRole("img", {
        name: /Completion evidence added/,
      })
    ).toBeVisible()
    await closeJobDetail(employeePage, title)
    const jobCard = employeePage.getByRole("article", {
      name: `Job ${title}`,
    })
    await expect(
      jobCard.getByRole("button", { name: "Submit for review" })
    ).toBeEnabled()
    await jobCard.getByRole("button", { name: "Submit for review" }).click()
    await expect(
      employeePage.locator("[data-offline-provider]").first()
    ).toHaveAttribute("data-offline-provider", "changes_pending")
    expect(supabaseRequestsWhileOffline).toEqual([])

    offlinePhase = false
    await context.setOffline(false)
    await expect
      .poll(() => queuedUploadAttempts, { timeout: 15_000 })
      .toBeGreaterThan(0)
    await expect(
      employeePage.locator("[data-offline-provider]").first()
    ).toHaveAttribute("data-offline-provider", "changes_pending")
    await expect(jobCard.getByText("in review")).toBeVisible()
    await jobCard.getByRole("button", { name: "Open job" }).click()
    await expect(
      employeePage.getByRole("img", {
        name: /Completion evidence added/,
      })
    ).toBeVisible()
    await expect(employeePage.getByText("1 of 1 required")).toBeVisible()
    await closeJobDetail(employeePage, title)

    const pendingOutboxCount = await getOfflineOutboxCount(employeePage)
    expect(pendingOutboxCount).toBeGreaterThanOrEqual(2)
    const queuedPhotoOperationId = await getOfflineOperationId(
      employeePage,
      "job.evidence.add"
    )
    expect(queuedPhotoOperationId).not.toBeNull()

    rejectQueuedUploads = false
    await expect
      .poll(() => queuedUploadResponses, { timeout: 30_000 })
      .toContain(200)
    await expect(
      employeePage.locator("[data-offline-provider]").first()
    ).toHaveAttribute("data-offline-provider", "offline_ready", {
      timeout: 30_000,
    })

    const [
      { data: updatedJob },
      { count: receiptCount },
      { count: noteCount },
      { count: assetCount },
      { count: submissionCount },
    ] = await Promise.all([
      admin.from("jobs").select("status").eq("id", job!.id).single(),
      admin
        .from("offline_operation_receipts")
        .select("*", { count: "exact", head: true })
        .eq("entity_id", String(job!.id)),
      admin
        .from("job_updates")
        .select("*", { count: "exact", head: true })
        .eq("job_id", job!.id)
        .eq("type", "note"),
      admin
        .from("job_assets")
        .select("*", { count: "exact", head: true })
        .eq("job_id", job!.id),
      admin
        .from("job_updates")
        .select("*", { count: "exact", head: true })
        .eq("job_id", job!.id)
        .eq("type", "status_change")
        .contains("metadata", { new_status: "in_review" }),
    ])
    expect(updatedJob?.status).toBe("in_review")
    expect(receiptCount).toBe(4)
    expect(noteCount).toBe(1)
    expect(assetCount).toBe(1)
    expect(submissionCount).toBe(1)
    expect(await getOfflineOutboxCount(employeePage)).toBe(0)
    expect(await hasOfflineBlob(employeePage, queuedPhotoOperationId!)).toBe(
      false
    )

    await employeePage.reload()
    await expect(
      employeePage.locator("[data-offline-provider]").first()
    ).toHaveAttribute("data-offline-provider", "offline_ready", {
      timeout: 30_000,
    })
    const reloadedJobCard = employeePage.getByRole("article", {
      name: `Job ${title}`,
    })
    await expect(reloadedJobCard.getByText("in review")).toBeVisible()
    await reloadedJobCard.getByRole("button", { name: "Open job" }).click()
    await expect(
      employeePage.getByRole("img", {
        name: /Completion evidence added/,
      })
    ).toBeVisible()
  } finally {
    const { data: assets } = await admin
      .from("job_assets")
      .select("storage_path")
      .eq("job_id", job!.id)
    if (assets?.length) {
      await admin.storage
        .from("job-evidence")
        .remove(assets.map((asset) => asset.storage_path))
    }
    await admin
      .from("job_notification_deliveries")
      .delete()
      .eq("job_id", job!.id)
    await admin
      .from("offline_operation_receipts")
      .delete()
      .eq("entity_id", String(job!.id))
    await admin.from("job_assets").delete().eq("job_id", job!.id)
    await admin.from("job_updates").delete().eq("job_id", job!.id)
    await admin.from("jobs").delete().eq("id", job!.id)
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

async function closeJobDetail(
  page: import("@playwright/test").Page,
  title: string
) {
  const closeButton = page.getByRole("button", { name: "Close" })
  if (await closeButton.count()) {
    await closeButton.click()
  } else {
    await page.keyboard.press("Escape")
  }
  await expect(page.getByRole("heading", { name: title })).not.toBeVisible()
}

async function getOfflineOperationId(
  page: import("@playwright/test").Page,
  kind: string
) {
  return page.evaluate(
    (operationKind) =>
      new Promise<string | null>((resolve, reject) => {
        const request = indexedDB.open("pph-offline-v2")
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const operations = request.result
            .transaction("outbox", "readonly")
            .objectStore("outbox")
            .getAll()
          operations.onerror = () => reject(operations.error)
          operations.onsuccess = () => {
            const operation = (
              operations.result as Array<{
                clientOperationId: string
                kind: string
              }>
            ).find((candidate) => candidate.kind === operationKind)
            resolve(operation?.clientOperationId ?? null)
          }
        }
      }),
    kind
  )
}

async function hasOfflineBlob(
  page: import("@playwright/test").Page,
  clientOperationId: string
) {
  return page.evaluate(
    (operationId) =>
      new Promise<boolean>((resolve, reject) => {
        const request = indexedDB.open("pph-offline-v2")
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const blob = request.result
            .transaction("blobs", "readonly")
            .objectStore("blobs")
            .get(operationId)
          blob.onerror = () => reject(blob.error)
          blob.onsuccess = () => resolve(Boolean(blob.result))
        }
      }),
    clientOperationId
  )
}
