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
  test.setTimeout(60_000)
  const pageErrors: string[] = []
  const supabaseRequestsWhileOffline: string[] = []
  let offlinePhase = false
  employeePage.on("pageerror", (error) => pageErrors.push(error.message))
  employeePage.on("request", (request) => {
    const url = new URL(request.url())
    if (offlinePhase && url.port === "54321") {
      supabaseRequestsWhileOffline.push(`${request.method()} ${url.pathname}`)
    }
  })
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
      employeePage.locator('[data-offline-status="offline_ready"]')
    ).toBeVisible({ timeout: 30_000 })
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
    await employeePage.getByRole("button", { name: "Add note" }).click()
    await employeePage
      .getByLabel("Completion photos")
      .setInputFiles(path.resolve("public/icons/icon-192.png"))
    await expect(employeePage.getByText("1 of 1 required")).toBeVisible({
      timeout: 15_000,
    })
    await expect(
      employeePage.getByRole("button", { name: "Submit for review" })
    ).toBeEnabled()
    await employeePage
      .getByRole("button", { name: "Submit for review" })
      .click()
    await expect(
      employeePage.locator('[data-offline-status="changes_pending"]')
    ).toBeVisible()
    expect(supabaseRequestsWhileOffline).toEqual([])

    offlinePhase = false
    await context.setOffline(false)
    await expect(
      employeePage.locator('[data-offline-status="offline_ready"]')
    ).toBeVisible({
      timeout: 30_000,
    })

    const [
      { data: updatedJob },
      { count: receiptCount },
      { count: noteCount },
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
    ])
    expect(updatedJob?.status).toBe("in_review")
    expect(receiptCount).toBe(4)
    expect(noteCount).toBe(1)
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
