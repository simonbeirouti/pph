import { devices } from "@playwright/test"

import { authenticate, expect, test } from "./fixtures"

test("job changes reach active employee sessions without reload", async ({
  browser,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium",
    "This journey creates desktop and mobile contexts explicitly."
  )
  const title = `Realtime ${Date.now()}`
  const updatedTitle = `${title} updated`
  const ownerContext = await browser.newContext({
    ...devices["Desktop Chrome"],
  })
  const employeeContext = await browser.newContext({
    ...devices["Desktop Chrome"],
  })
  const mobileEmployeeContext = await browser.newContext({
    ...devices["Pixel 7"],
  })

  try {
    await Promise.all([
      authenticate(ownerContext, "owner@example.test"),
      authenticate(employeeContext, "employee@example.test"),
      authenticate(mobileEmployeeContext, "employee@example.test"),
    ])
    const ownerPage = await ownerContext.newPage()
    const employeePage = await employeeContext.newPage()
    const mobileEmployeePage = await mobileEmployeeContext.newPage()
    await Promise.all([
      ownerPage.goto("/dashboard/jobs"),
      employeePage.goto("/dashboard/jobs"),
      mobileEmployeePage.goto("/dashboard/jobs"),
    ])
    await Promise.all(
      [ownerPage, employeePage, mobileEmployeePage].map((page) =>
        expect(
          page.locator('[data-realtime-status="connected"]')
        ).toBeAttached()
      )
    )

    await ownerPage.getByRole("button", { name: "Create job" }).click()
    const createDialog = ownerPage.getByRole("dialog")
    await createDialog.getByLabel("Title").fill(title)
    await createDialog.getByLabel("Priority").click()
    await ownerPage.getByRole("option", { name: "Urgent" }).click()
    await createDialog.getByLabel("Assignee").click()
    await ownerPage.getByRole("option", { name: "Alex Employee" }).click()
    await createDialog.getByRole("button", { name: "Create job" }).click()

    const employeeJob = employeePage.getByRole("article", {
      name: `Job ${title}`,
    })
    const mobileEmployeeJob = mobileEmployeePage.getByRole("article", {
      name: `Job ${title}`,
    })
    await expect(employeeJob).toBeVisible()
    await expect(mobileEmployeeJob).toBeVisible()

    const ownerJob = ownerPage.getByRole("article", {
      name: `Job ${title}`,
    })
    await ownerJob.getByRole("button", { name: `Edit ${title}` }).click()
    const editDialog = ownerPage.getByRole("dialog")
    await editDialog.getByLabel("Title").fill(updatedTitle)
    await editDialog.getByRole("button", { name: "Save changes" }).click()
    await expect(
      employeePage.getByRole("article", {
        name: `Job ${updatedTitle}`,
      })
    ).toBeVisible()
    await expect(
      mobileEmployeePage.getByRole("article", {
        name: `Job ${updatedTitle}`,
      })
    ).toBeVisible()

    const updatedOwnerJob = ownerPage.getByRole("article", {
      name: `Job ${updatedTitle}`,
    })
    await updatedOwnerJob.getByRole("combobox", { name: "Assign to" }).click()
    await ownerPage.getByRole("option", { name: "Unassigned" }).click()
    await expect(
      employeePage.getByRole("article", {
        name: `Job ${updatedTitle}`,
      })
    ).toHaveCount(0)
    await expect(
      mobileEmployeePage.getByRole("article", {
        name: `Job ${updatedTitle}`,
      })
    ).toHaveCount(0)
  } finally {
    await Promise.all([
      ownerContext.close(),
      employeeContext.close(),
      mobileEmployeeContext.close(),
    ])
  }
})
