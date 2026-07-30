import { createClient } from "@supabase/supabase-js"

import { expect, test } from "./fixtures"

test("owner manages a template and schedule", async ({
  ownerPage,
}, testInfo) => {
  const suffix = `${testInfo.project.name}-${Date.now()}`
  const title = `E2E template ${suffix}`

  await ownerPage.goto("/dashboard/templates")
  await expect(
    ownerPage.getByRole("heading", { name: "Templates & schedules" })
  ).toBeVisible()
  await ownerPage.getByRole("button", { name: "New template" }).click()
  const templateDialog = ownerPage.getByRole("dialog", {
    name: "New template",
  })
  if (testInfo.project.name.includes("mobile")) {
    await expect(
      templateDialog.locator('[data-slot="drawer-content"]')
    ).toBeVisible()
  }
  await templateDialog.getByLabel("Title").fill(title)
  await templateDialog.getByLabel("Description").fill("Reusable E2E defaults")
  await templateDialog.getByLabel("Location").fill("Front foyer")
  await expect(
    templateDialog.locator(
      '[data-template-form-row="location-priority"]'
    )
  ).toHaveClass(/grid-cols-2/)
  await expect(
    templateDialog.locator('[data-template-form-row="assignee-photos"]')
  ).toHaveClass(/grid-cols-2/)
  await templateDialog.getByRole("combobox", { name: "Priority" }).click()
  await ownerPage.getByRole("option", { name: "High" }).click()
  await templateDialog
    .getByRole("combobox", { name: "Default assignee" })
    .click()
  await ownerPage.getByRole("option", { name: "Alex Employee" }).click()
  await templateDialog
    .getByRole("combobox", { name: "Minimum completion photos" })
    .click()
  await ownerPage.getByRole("option", { name: "2", exact: true }).click()
  await templateDialog
    .getByRole("checkbox", { name: "Require a completion note" })
    .click()
  await templateDialog.getByRole("button", { name: "Save template" }).click()
  await expect(templateDialog).not.toBeVisible()

  const templateCard = ownerPage
    .locator('[data-slot="card"]')
    .filter({ hasText: title })
  await expect(templateCard).toContainText("Active")
  await templateCard
    .getByRole("button", { name: `Template actions for ${title}` })
    .click()
  await ownerPage.getByRole("menuitem", { name: "Edit" }).click()
  const editDialog = ownerPage.getByRole("dialog", { name: "Edit template" })
  await editDialog.getByLabel("Location").fill("Updated foyer")
  await editDialog.getByRole("button", { name: "Save template" }).click()
  await expect(templateCard).toContainText("Updated foyer")

  await ownerPage.getByRole("tab", { name: "Schedules" }).click()
  await ownerPage.getByRole("button", { name: "New schedule" }).click()
  const scheduleDialog = ownerPage.getByRole("dialog", {
    name: "New schedule",
  })
  for (const row of ["template-assignee", "repeat-time", "dates"]) {
    await expect(
      scheduleDialog.locator(`[data-schedule-form-row="${row}"]`)
    ).toHaveClass(/grid-cols-2/)
  }
  await scheduleDialog.getByRole("combobox", { name: "Template" }).click()
  await ownerPage.getByRole("option", { name: title }).click()
  await scheduleDialog.getByRole("combobox", { name: "Assignee" }).click()
  await ownerPage.getByRole("option", { name: "Alex Employee" }).click()
  await scheduleDialog.getByRole("combobox", { name: "Repeats" }).click()
  await ownerPage.getByRole("option", { name: "Daily" }).click()
  await scheduleDialog.getByLabel("Local time").fill("23:59")
  await scheduleDialog.getByRole("button", { name: "Save schedule" }).click()
  await expect(scheduleDialog).not.toBeVisible()

  const scheduleCard = ownerPage
    .locator('[data-slot="card"]')
    .filter({ hasText: title })
  await scheduleCard.getByRole("button", { name: "Schedule actions" }).click()
  await ownerPage.getByRole("menuitem", { name: "Pause" }).click()
  await expect(scheduleCard).toContainText("Paused")
  await scheduleCard.getByRole("button", { name: "Schedule actions" }).click()
  await ownerPage.getByRole("menuitem", { name: "Resume" }).click()
  await expect(scheduleCard).toContainText("Active")
  ownerPage.once("dialog", (dialog) => dialog.accept())
  await scheduleCard.getByRole("button", { name: "Schedule actions" }).click()
  await ownerPage.getByRole("menuitem", { name: "Delete" }).click()
  await expect(scheduleCard).toHaveCount(0)
})

test("employee is denied the templates workspace", async ({ employeePage }) => {
  await employeePage.goto("/dashboard/templates")
  await expect(
    employeePage.getByRole("heading", { name: "Templates & schedules" })
  ).toHaveCount(0)
  await expect(employeePage.getByText("Reusable work")).toHaveCount(0)
  await expect(
    employeePage.getByRole("link", { name: "Templates" })
  ).toHaveCount(0)
})

test("production generator is idempotent and renders one generated job", async ({
  ownerPage,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium",
    "The production generator proof only needs one deterministic browser."
  )
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
  const title = `Generated E2E ${Date.now()}`
  const { data: template, error: templateError } = await admin
    .from("job_templates")
    .insert({
      assignee_membership_id: 1103,
      created_by: 1101,
      organisation_id: 1001,
      priority: "urgent",
      title,
    })
    .select()
    .single()
  expect(templateError).toBeNull()

  const occurrenceAt = "2038-08-02T00:00:00.000Z"
  const { data: schedule, error: scheduleError } = await admin
    .from("job_schedules")
    .insert({
      assignee_membership_id: 1103,
      created_by: 1101,
      is_enabled: true,
      local_time: "10:00",
      next_occurrence_at: occurrenceAt,
      organisation_id: 1001,
      recurrence_type: "daily",
      starts_on: "2038-08-02",
      template_id: template!.id,
      timezone: "Australia/Melbourne",
      weekdays: [],
    })
    .select()
    .single()
  expect(scheduleError).toBeNull()

  for (let invocation = 0; invocation < 2; invocation += 1) {
    const { error } = await admin.rpc("run_due_job_schedules", {
      p_limit: 100,
      p_now: occurrenceAt,
    })
    expect(error).toBeNull()
  }

  const [{ count: jobCount }, { count: occurrenceCount }] = await Promise.all([
    admin
      .from("jobs")
      .select("*", { count: "exact", head: true })
      .eq("schedule_id", schedule!.id)
      .eq("scheduled_at", occurrenceAt),
    admin
      .from("job_schedule_occurrences")
      .select("*", { count: "exact", head: true })
      .eq("schedule_id", schedule!.id)
      .eq("occurrence_at", occurrenceAt),
  ])
  expect(jobCount).toBe(1)
  expect(occurrenceCount).toBe(1)

  await ownerPage.goto("/dashboard/jobs?priority=urgent")
  await expect(ownerPage.getByText("Dashboard filter applied.")).toBeVisible()
  await expect(ownerPage.getByText(title)).toHaveCount(1)
  await ownerPage
    .getByRole("button", { name: "Start job from template" })
    .click()
  await ownerPage.getByRole("menuitem", { name: title }).click()
  const createJob = ownerPage.getByRole("dialog", { name: "Create job" })
  await expect(createJob.getByLabel("Title")).toHaveValue(title)
  await expect(
    createJob.getByRole("combobox", { name: "Priority" })
  ).toContainText("Urgent")
  await createJob.getByRole("button", { name: "Close" }).click()
})

test("owner dashboard exposes operational links", async ({ ownerPage }) => {
  await ownerPage.goto("/dashboard")
  await expect(
    ownerPage.getByRole("link", { name: /Working now \d+/ })
  ).toBeVisible()
  await expect(
    ownerPage.getByRole("link", { name: /Outstanding \d+/ })
  ).toBeVisible()
  await expect(
    ownerPage.getByRole("link", { name: /Awaiting review \d+/ })
  ).toBeVisible()
  await expect(
    ownerPage.getByRole("link", { name: /Urgent \d+/ })
  ).toBeVisible()
  await expect(
    ownerPage.getByText("Today’s roster", { exact: true })
  ).toBeVisible()
  await ownerPage.getByRole("link", { name: /Outstanding \d+/ }).click()
  await expect(ownerPage).toHaveURL(/status=outstanding/)
  await expect(ownerPage.getByText("Dashboard filter applied.")).toBeVisible()
  await ownerPage.getByRole("link", { name: "Clear filter" }).click()
  await expect(ownerPage).toHaveURL(/\/dashboard\/jobs$/)

  await ownerPage.getByRole("combobox", { name: "Filter by urgency" }).click()
  await ownerPage.getByRole("option", { name: "Urgent" }).click()
  await expect(
    ownerPage.getByRole("combobox", { name: "Filter by urgency" })
  ).toContainText("Urgent")

  await ownerPage.getByRole("combobox", { name: "Filter by employee" }).click()
  await ownerPage.getByRole("option", { name: "Alex Employee" }).click()
  await expect(
    ownerPage.getByRole("combobox", { name: "Filter by employee" })
  ).toContainText("Alex Employee")
})

test("employee dashboard exposes an ordered actionable queue", async ({
  employeePage,
}) => {
  await employeePage.goto("/dashboard")
  await expect(
    employeePage.getByText("Assigned work", { exact: true })
  ).toBeVisible()
  await expect(employeePage.getByText("Next actionable")).toBeVisible()
  await expect(
    employeePage.getByRole("button", { name: "Start" }).first()
  ).toBeVisible()
  await expect(employeePage.getByText("Awaiting review")).toHaveCount(0)
  await expect(
    employeePage.getByRole("link", { name: "Templates" })
  ).toHaveCount(0)
})
