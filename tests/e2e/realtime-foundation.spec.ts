import { createClient } from "@supabase/supabase-js"
import { devices } from "@playwright/test"

import { authenticate, expect, test } from "./fixtures"

function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

test("job changes reach every permitted active session without reload", async ({
  browser,
  managerPage,
}, testInfo) => {
  test.setTimeout(120_000)
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
    const ownerDashboardPage = await ownerContext.newPage()
    const employeePage = await employeeContext.newPage()
    const employeeDashboardPage = await employeeContext.newPage()
    const mobileEmployeePage = await mobileEmployeeContext.newPage()
    const mobileEmployeeDashboardPage = await mobileEmployeeContext.newPage()
    await Promise.all([
      ownerPage.goto("/dashboard/jobs"),
      ownerDashboardPage.goto("/dashboard"),
      managerPage.goto("/dashboard/jobs"),
      employeePage.goto("/dashboard/jobs"),
      employeeDashboardPage.goto("/dashboard"),
      mobileEmployeePage.goto("/dashboard/jobs"),
      mobileEmployeeDashboardPage.goto("/dashboard"),
    ])
    await Promise.all(
      [
        ownerPage,
        ownerDashboardPage,
        managerPage,
        employeePage,
        employeeDashboardPage,
        mobileEmployeePage,
        mobileEmployeeDashboardPage,
      ].map((page) =>
        expect(
          page.locator('[data-realtime-status="connected"]')
        ).toBeAttached()
      )
    )
    const ownerOutstanding = ownerDashboardPage.getByRole("link", {
      name: /Outstanding/,
    })
    const initialOutstanding = Number(
      await ownerOutstanding.locator("p").last().textContent()
    )
    expect(initialOutstanding).toBeGreaterThanOrEqual(0)

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
    const managerJob = managerPage.getByRole("article", {
      name: `Job ${title}`,
    })
    await expect(employeeJob).toBeVisible()
    await expect(mobileEmployeeJob).toBeVisible()
    await expect(managerJob).toBeVisible()
    await expect(
      employeeDashboardPage.getByText(title, { exact: true })
    ).toBeVisible()
    await expect(
      mobileEmployeeDashboardPage.getByText(title, { exact: true })
    ).toBeVisible()
    await expect(
      ownerOutstanding.getByText(String(initialOutstanding + 1), {
        exact: true,
      })
    ).toBeVisible()

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
    await expect(
      managerPage.getByRole("article", {
        name: `Job ${updatedTitle}`,
      })
    ).toBeVisible()
    await expect(
      employeeDashboardPage.getByText(updatedTitle, { exact: true })
    ).toBeVisible()
    await expect(
      mobileEmployeeDashboardPage.getByText(updatedTitle, { exact: true })
    ).toBeVisible()

    const updatedOwnerJob = ownerPage.getByRole("article", {
      name: `Job ${updatedTitle}`,
    })
    await updatedOwnerJob.getByRole("combobox", { name: "Assign to" }).click()
    await ownerPage
      .getByRole("option", { name: "Unassign", exact: true })
      .click()
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
    await expect(
      employeeDashboardPage.getByText(updatedTitle, { exact: true })
    ).toHaveCount(0)
    await expect(
      mobileEmployeeDashboardPage.getByText(updatedTitle, { exact: true })
    ).toHaveCount(0)
    await expect(
      managerPage.getByRole("article", {
        name: `Job ${updatedTitle}`,
      })
    ).toBeVisible()
  } finally {
    await Promise.all([
      ownerContext.close(),
      employeeContext.close(),
      mobileEmployeeContext.close(),
    ])
  }
})

test("roster changes refresh active dashboards and roster pages without reload", async ({
  browser,
  managerPage,
}, testInfo) => {
  test.setTimeout(120_000)
  test.skip(
    testInfo.project.name !== "chromium",
    "This journey creates desktop and mobile contexts explicitly."
  )
  const note = `Realtime roster ${Date.now()}`
  const ownerContext = await browser.newContext({
    ...devices["Desktop Chrome"],
  })
  const employeeContext = await browser.newContext({
    ...devices["Desktop Chrome"],
  })
  const mobileEmployeeContext = await browser.newContext({
    ...devices["Pixel 7"],
  })
  const admin = createAdminClient()
  let shiftId: number | null = null

  try {
    await Promise.all([
      authenticate(ownerContext, "owner@example.test"),
      authenticate(employeeContext, "employee@example.test"),
      authenticate(mobileEmployeeContext, "employee@example.test"),
    ])
    const ownerDashboardPage = await ownerContext.newPage()
    const ownerRosterPage = await ownerContext.newPage()
    const employeeDashboardPage = await employeeContext.newPage()
    const employeeRosterPage = await employeeContext.newPage()
    const mobileEmployeeRosterPage = await mobileEmployeeContext.newPage()
    const managerDashboardPage = managerPage
    const managerRosterPage = await managerPage.context().newPage()

    await Promise.all([
      ownerDashboardPage.goto("/dashboard"),
      ownerRosterPage.goto("/dashboard/roster"),
      employeeDashboardPage.goto("/dashboard"),
      employeeRosterPage.goto("/dashboard/roster"),
      mobileEmployeeRosterPage.goto("/dashboard/roster"),
      managerDashboardPage.goto("/dashboard"),
      managerRosterPage.goto("/dashboard/roster"),
    ])
    const pages = [
      ownerDashboardPage,
      ownerRosterPage,
      employeeDashboardPage,
      employeeRosterPage,
      mobileEmployeeRosterPage,
      managerDashboardPage,
      managerRosterPage,
    ]
    await Promise.all(
      pages.map((page) =>
        expect(
          page.locator('[data-realtime-status="connected"]')
        ).toBeAttached()
      )
    )

    const ownerAlexShifts = ownerDashboardPage.getByRole("link", {
      name: /Alex Employee/,
    })
    const managerAlexShifts = managerDashboardPage.getByRole("link", {
      name: /Alex Employee/,
    })
    const ownerShiftCount = await ownerAlexShifts.count()
    const managerShiftCount = await managerAlexShifts.count()
    expect(ownerShiftCount).toBeGreaterThan(0)
    expect(managerShiftCount).toBeGreaterThan(0)

    const { error: archiveSeedError } = await admin
      .from("roster_shifts")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", 1301)
    expect(archiveSeedError).toBeNull()
    await expect(ownerAlexShifts).toHaveCount(ownerShiftCount - 1)
    await expect(managerAlexShifts).toHaveCount(managerShiftCount - 1)
    await expect(ownerRosterPage.locator('[data-shift-id="1301"]')).toHaveCount(
      0
    )
    await expect(
      employeeRosterPage.locator('[data-shift-id="1301"]')
    ).toHaveCount(0)
    await expect(
      managerRosterPage.locator('[data-shift-id="1301"]')
    ).toHaveCount(0)
    await expect(
      mobileEmployeeRosterPage.locator('[data-shift-id="1301"]')
    ).toHaveCount(0)

    const { data: shift, error: shiftError } = await admin
      .from("roster_shifts")
      .insert({
        created_by: 1101,
        employee_membership_id: 1103,
        ends_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        notes: note,
        organisation_id: 1001,
        starts_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      })
      .select("id")
      .single()
    expect(shiftError).toBeNull()
    shiftId = shift!.id

    await expect(
      employeeDashboardPage.getByText(note, { exact: true })
    ).toBeVisible()
    await expect(ownerAlexShifts).toHaveCount(ownerShiftCount)
    await expect(managerAlexShifts).toHaveCount(managerShiftCount)
    await Promise.all(
      [
        ownerRosterPage,
        managerRosterPage,
        employeeRosterPage,
        mobileEmployeeRosterPage,
      ].map((page) =>
        expect(page.locator(`[data-shift-id="${shiftId}"]`)).toBeAttached()
      )
    )

    const { error: archiveError } = await admin
      .from("roster_shifts")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", shiftId)
    expect(archiveError).toBeNull()
    await expect(
      employeeDashboardPage.getByText(note, { exact: true })
    ).toHaveCount(0)
    await expect(ownerAlexShifts).toHaveCount(ownerShiftCount - 1)
    await expect(managerAlexShifts).toHaveCount(managerShiftCount - 1)
    await Promise.all(
      [
        ownerRosterPage,
        managerRosterPage,
        employeeRosterPage,
        mobileEmployeeRosterPage,
      ].map((page) =>
        expect(page.locator(`[data-shift-id="${shiftId}"]`)).toHaveCount(0)
      )
    )
  } finally {
    if (shiftId) {
      await admin.from("roster_shifts").delete().eq("id", shiftId)
    }
    await admin
      .from("roster_shifts")
      .update({ archived_at: null })
      .eq("id", 1301)
    await Promise.all([
      ownerContext.close(),
      employeeContext.close(),
      mobileEmployeeContext.close(),
    ])
  }
})
