import { devices } from "@playwright/test"

import { authenticate, expect, test } from "./fixtures"

// 192px app icon encoded as a primary-still HEIC fixture on macOS.
const phoneNativeHeic = Buffer.from(
  "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",
  "base64"
)

test("employee executes and resubmits while owner reviews in the URL-controlled surfaces", async ({
  browser,
}, testInfo) => {
  test.setTimeout(180_000)
  test.skip(
    testInfo.project.name !== "chromium",
    "The journey creates its own Pixel 7 employee context."
  )
  const title = `S05 journey ${Date.now()}`
  const ownerContext = await browser.newContext({
    ...devices["Desktop Chrome"],
  })
  await authenticate(ownerContext, "owner@example.test")
  const ownerPage = await ownerContext.newPage()

  await ownerPage.goto("/dashboard/jobs")
  await ownerPage.getByRole("button", { name: "Create job" }).click()
  const createDialog = ownerPage.getByRole("dialog")
  await createDialog.getByLabel("Title").fill(title)
  await createDialog
    .getByLabel("Description")
    .fill("Complete and photograph this test job.")
  await createDialog.getByLabel("Assignee").click()
  await ownerPage.getByRole("option", { name: "Alex Employee" }).click()
  await createDialog.getByLabel("Minimum completion photos").fill("1")
  await createDialog
    .getByRole("checkbox", { name: "Require a completion note" })
    .check()
  await createDialog.getByRole("button", { name: "Create job" }).click()
  await expect(createDialog).not.toBeVisible()
  const jobUrl = await ownerPage
    .getByRole("article")
    .filter({ hasText: title })
    .locator('a[href^="/dashboard/jobs?job="]')
    .getAttribute("href")
  expect(jobUrl).toMatch(/^\/dashboard\/jobs\?job=\d+$/)
  await ownerPage.goto("about:blank")

  const employeeContext = await browser.newContext({
    ...devices["Pixel 7"],
  })
  await authenticate(employeeContext, "employee@example.test")
  const employeePage = await employeeContext.newPage()
  await employeePage.goto(jobUrl!)
  await expect(employeePage).toHaveURL(/\/dashboard\/jobs\?job=\d+$/)
  await expect(employeePage.locator('[data-slot="drawer-popup"]')).toBeVisible()
  await expect(employeePage.getByText("Owner feedback")).toHaveCount(0)

  await employeePage.getByRole("button", { name: "Start job" }).click()
  await employeePage.getByLabel("Work note").fill("Completed safely.")
  await employeePage.getByRole("button", { name: "Add note" }).click()
  const largeJpegDataUrl = await employeePage.evaluate(() => {
    const canvas = document.createElement("canvas")
    canvas.width = 2400
    canvas.height = 1800
    const context = canvas.getContext("2d")!
    const pixels = context.createImageData(canvas.width, canvas.height)
    let value = 0x12345678
    for (let offset = 0; offset < pixels.data.length; offset += 4) {
      value = (value * 1664525 + 1013904223) >>> 0
      pixels.data[offset] = value & 0xff
      pixels.data[offset + 1] = (value >>> 8) & 0xff
      pixels.data[offset + 2] = (value >>> 16) & 0xff
      pixels.data[offset + 3] = 0xff
    }
    context.putImageData(pixels, 0, 0)
    return canvas.toDataURL("image/jpeg", 0.96)
  })
  const largeJpeg = Buffer.from(largeJpegDataUrl.split(",")[1]!, "base64")
  expect(largeJpeg.byteLength).toBeGreaterThan(1024 * 1024)
  const jpegUploadRequest = employeePage.waitForRequest(
    (request) =>
      request.method() === "POST" &&
      request.url().includes("/storage/v1/upload/resumable")
  )
  await employeePage.getByLabel("Completion photos").setInputFiles({
    buffer: largeJpeg,
    mimeType: "image/jpeg",
    name: "android-photo.jpg",
  })
  const jpegUpload = await jpegUploadRequest
  expect(Number(jpegUpload.headers()["upload-length"])).toBeLessThanOrEqual(
    largeJpeg.byteLength / 2
  )
  expect(jpegUpload.headers()["upload-metadata"]).toContain(
    Buffer.from("image/webp").toString("base64")
  )
  await expect(employeePage.getByText("Photo added.")).toBeVisible({
    timeout: 20_000,
  })
  await expect(employeePage.getByLabel("Completion photos")).toBeEnabled()

  const heicUploadRequest = employeePage.waitForRequest(
    (request) =>
      request.method() === "POST" &&
      request.url().includes("/storage/v1/upload/resumable")
  )
  await employeePage.getByLabel("Completion photos").setInputFiles({
    buffer: phoneNativeHeic,
    mimeType: "image/heic",
    name: "iphone-photo.HEIC",
  })
  const heicUpload = await heicUploadRequest
  expect(Number(heicUpload.headers()["upload-length"])).toBeLessThan(
    phoneNativeHeic.byteLength
  )
  expect(heicUpload.headers()["upload-metadata"]).toContain(
    Buffer.from("image/webp").toString("base64")
  )
  await expect(employeePage.getByText("Photo added.")).toBeVisible({
    timeout: 20_000,
  })
  await expect(
    employeePage.getByRole("button", { name: "Submit for review" })
  ).toBeEnabled()
  await employeePage.getByRole("button", { name: "Submit for review" }).click()
  await expect(
    employeePage.getByText("Job submitted for review.")
  ).toBeVisible()
  await expect(employeePage.getByLabel("Work note")).toHaveCount(0)
  await employeePage.goto("about:blank")

  await ownerPage.goto(jobUrl!)
  const ownerSheet = ownerPage.locator('[data-slot="sheet-content"]')
  await expect(ownerSheet).toBeVisible()
  const sheetBox = await ownerSheet.boundingBox()
  expect(sheetBox).not.toBeNull()
  expect(sheetBox!.width / ownerPage.viewportSize()!.width).toBeCloseTo(0.4, 1)
  await expect(ownerSheet).toContainText("owner@example.test")
  await expect(ownerSheet).toContainText("Submission email: sent")

  await ownerSheet.getByLabel("Add comment").fill("Reviewing now.")
  await ownerSheet.getByRole("button", { exact: true, name: "Comment" }).click()
  await ownerSheet.getByRole("button", { name: "Reopen job" }).click()
  const reopenDialog = ownerPage.getByRole("dialog", { name: "Reopen job" })
  await expect(
    reopenDialog.getByRole("button", { name: "Reopen job" })
  ).toBeDisabled()
  await reopenDialog
    .getByLabel("Feedback")
    .fill("Please photograph the final label.")
  await reopenDialog.getByLabel("Assign to").click()
  await ownerPage.getByRole("option", { name: "Alex Employee" }).click()
  await reopenDialog.getByRole("button", { name: "Reopen job" }).click()
  await expect(reopenDialog).not.toBeVisible()
  await ownerPage.goto("about:blank")

  await employeePage.goto(jobUrl!)
  await expect(employeePage.getByText("Owner feedback")).toBeVisible()
  await expect(
    employeePage.getByText("Please photograph the final label.").first()
  ).toBeVisible()
  await employeePage.getByRole("button", { name: "Start job" }).click()
  await employeePage.getByRole("button", { name: "Submit for review" }).click()
  await expect(
    employeePage.getByText("Job submitted for review.")
  ).toBeVisible()
  await employeePage.goto("about:blank")

  await ownerPage.goto(jobUrl!)
  await expect(ownerPage).toHaveURL(/\/dashboard\/jobs\?job=\d+$/)
  await ownerPage
    .locator('[data-slot="sheet-content"]')
    .getByRole("button", { name: "Approve and archive" })
    .click()
  await expect(ownerPage.getByText("Job approved and archived.")).toBeVisible()

  await employeePage.goto("/dashboard/jobs?job=1402")
  await expect(
    employeePage.getByText("This page could not be found.")
  ).toBeVisible()
  await employeeContext.close()
  await ownerContext.close()
})
