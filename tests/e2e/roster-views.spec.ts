import { createClient } from "@supabase/supabase-js"
import type { Page } from "@playwright/test"

import { expect, test } from "./fixtures"

function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

async function createRosteredEmployee() {
  const supabase = createAdminClient()
  const email = `roster-${Date.now()}@example.test`
  const { data: authData, error: authError } =
    await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
      password: "Password123!",
    })
  expect(authError).toBeNull()
  const { data: membership, error: membershipError } = await supabase
    .from("memberships")
    .insert({
      activated_at: new Date().toISOString(),
      email,
      organisation_id: 1001,
      role: "employee",
      status: "active",
      user_id: authData.user!.id,
    })
    .select("id")
    .single()
  expect(membershipError).toBeNull()
  const membershipId = membership!.id
  const { error: profileError } = await supabase
    .from("employee_profiles")
    .insert({
      first_name: "Morgan",
      job_title: "Supervisor",
      last_name: "Roster",
      membership_id: membershipId,
      organisation_id: 1001,
      phone: "0400 555 010",
    })
  expect(profileError).toBeNull()
  const now = Date.now()
  const { error: shiftError } = await supabase.from("roster_shifts").insert({
    created_by: 1101,
    employee_membership_id: membershipId,
    ends_at: new Date(now + 60 * 60 * 1000).toISOString(),
    notes: "E2E second employee",
    organisation_id: 1001,
    starts_at: new Date(now - 60 * 60 * 1000).toISOString(),
  })
  expect(shiftError).toBeNull()

  return {
    async cleanup() {
      await supabase
        .from("roster_shifts")
        .delete()
        .eq("employee_membership_id", membershipId)
      await supabase
        .from("employee_profiles")
        .delete()
        .eq("membership_id", membershipId)
      await supabase.from("memberships").delete().eq("id", membershipId)
      await supabase.auth.admin.deleteUser(authData.user!.id)
    },
  }
}

async function computedPosition(page: Page, selector: string) {
  return page
    .locator(selector)
    .first()
    .evaluate((element) => {
      const style = window.getComputedStyle(element)
      return { left: style.left, position: style.position }
    })
}

test("owner roster defaults to Team today with responsive roster lanes", async ({
  ownerPage,
}, testInfo) => {
  const fixture = await createRosteredEmployee()
  try {
    const supabase = createAdminClient()
    const { count: activeEmployeeCount } = await supabase
      .from("memberships")
      .select("*", { count: "exact", head: true })
      .eq("organisation_id", 1001)
      .eq("role", "employee")
      .eq("status", "active")
    const response = await ownerPage.goto("/dashboard/roster")
    expect(response?.status()).toBe(200)
    await expect(
      ownerPage.getByRole("heading", { name: "Roster", level: 1 })
    ).toBeVisible()
    await expect(ownerPage.getByText("Team day", { exact: true })).toBeVisible()
    const browserTimezone = await ownerPage.evaluate(
      () => Intl.DateTimeFormat().resolvedOptions().timeZone
    )
    await expect
      .poll(() => new URL(ownerPage.url()).searchParams.get("timezone"))
      .toBe(browserTimezone)
    await expect(
      ownerPage.getByText(`Times shown in ${browserTimezone}`, { exact: true })
    ).toHaveCount(0)
    await expect(
      ownerPage.getByRole("timer", { name: /Current time/ })
    ).toBeVisible()
    const lanes = ownerPage.locator("[data-testid=employee-lanes]").first()
    await expect(lanes.locator("[data-employee-lane]")).toHaveCount(
      activeEmployeeCount!
    )
    const laneWidths = await lanes
      .locator("[data-employee-lane]")
      .evaluateAll((elements) =>
        elements.map((element) => element.getBoundingClientRect().width)
      )
    expect(laneWidths).toHaveLength(activeEmployeeCount!)
    expect(Math.abs(laneWidths[0] - laneWidths[1])).toBeLessThan(1)

    const railPosition = await computedPosition(
      ownerPage,
      "[data-testid=roster-time-rail]"
    )
    expect(railPosition.position).toBe("sticky")
    await expect(
      ownerPage.locator("[data-testid=roster-time-rail]").first()
    ).toHaveAttribute("data-start-hour", "0")
    await expect(
      ownerPage.locator("[data-testid=roster-time-rail]").first()
    ).toHaveAttribute("data-end-hour", "24")

    await ownerPage.getByText("Employee week", { exact: true }).click()
    await expect(
      ownerPage.getByRole("combobox", { name: "Choose employee" })
    ).toContainText("Alex Employee")
    await expect(ownerPage).toHaveURL(/view=week/)
    await expect
      .poll(() =>
        ownerPage.evaluate(
          () => document.documentElement.scrollHeight - window.innerHeight
        )
      )
      .toBeLessThanOrEqual(1)
    await expect
      .poll(() =>
        ownerPage.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth
        )
      )
      .toBeLessThanOrEqual(1)
    const rosterBox = await ownerPage
      .getByRole("region", { name: "Roster grid" })
      .boundingBox()
    expect(rosterBox).not.toBeNull()
    expect(rosterBox!.x + rosterBox!.width).toBeLessThanOrEqual(
      ownerPage.viewportSize()!.width + 1
    )
    await ownerPage.getByRole("button", { name: "Next week" }).click()
    await expect(ownerPage).toHaveURL(/view=week/)

    if (testInfo.project.name === "mobile-chrome") {
      const calendar = ownerPage.getByRole("region", {
        name: "Roster grid",
      })
      await expect(calendar.locator("[data-roster-day-header]")).toHaveCount(7)
      const initialUrl = ownerPage.url()
      await calendar.evaluate((element) => {
        element.scrollLeft += element.clientWidth
        element.dispatchEvent(new Event("scroll", { bubbles: true }))
      })
      await expect.poll(() => ownerPage.url()).not.toBe(initialUrl)
      expect(
        await computedPosition(ownerPage, "[data-testid=roster-time-rail]")
      ).toMatchObject({ position: "sticky" })
    }
  } finally {
    await fixture.cleanup()
  }
})

test("owner creates and exactly edits shifts from the employee sheet", async ({
  ownerPage,
}) => {
  const supabase = createAdminClient()
  const pageErrors: Error[] = []
  ownerPage.on("pageerror", (error) => pageErrors.push(error))
  const note = `Sheet roster ${Date.now()}`
  const target = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000)
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-AU", {
      day: "2-digit",
      month: "2-digit",
      timeZone: "Australia/Melbourne",
      year: "numeric",
    })
      .formatToParts(target)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  )
  const targetDate = `${parts.year}-${parts.month}-${parts.day}`

  try {
    await ownerPage.goto("/dashboard/employees")
    await ownerPage.waitForLoadState("networkidle")
    const alexRow = ownerPage.getByRole("row", {
      name: "Open Alex Employee details",
    })
    await alexRow.getByRole("cell", { name: "Operator" }).click()
    const sheet = ownerPage.getByRole("dialog")
    await expect
      .poll(async () => ({
        dialogs: await sheet.count(),
        errors: pageErrors.map((error) => error.message),
      }))
      .toEqual({ dialogs: 1, errors: [] })
    await expect(sheet.getByText("Shifts", { exact: true })).toBeVisible()
    await sheet.getByRole("button", { name: "Add shift" }).click()

    const createDialog = ownerPage.getByRole("dialog", { name: "Add shift" })
    await createDialog.getByLabel("Date").fill(targetDate)
    await createDialog.getByLabel("Start").fill("09:07")
    await createDialog.getByLabel("End").fill("10:13")
    await createDialog.getByLabel("Notes").fill(note)
    await expect(
      sheet.getByRole("button", { name: "Save profile" })
    ).toHaveCount(0)
    await createDialog.getByRole("button", { name: "Create shift" }).click()
    await expect(createDialog).not.toBeVisible()

    const { data: createdShift } = await supabase
      .from("roster_shifts")
      .select("id")
      .eq("organisation_id", 1001)
      .eq("notes", note)
      .single()
    expect(createdShift).not.toBeNull()
    await sheet.locator(`[data-shift-id="${createdShift!.id}"]`).click()
    const editDialog = ownerPage.getByRole("dialog", { name: "Edit shift" })
    await expect(editDialog.getByLabel("Date")).toHaveValue(targetDate)
    await expect(editDialog.getByLabel("Start")).toHaveValue("09:07")
    await expect(editDialog.getByLabel("End")).toHaveValue("10:13")
    await editDialog.getByLabel("End").fill("11:17")
    await editDialog.getByLabel("Notes").fill(`${note} edited`)
    await editDialog.getByRole("button", { name: "Save shift" }).click()
    await expect(editDialog).not.toBeVisible()

    await expect
      .poll(async () => {
        const { data } = await supabase
          .from("roster_shifts")
          .select("notes, starts_at, ends_at")
          .eq("organisation_id", 1001)
          .eq("notes", `${note} edited`)
          .maybeSingle()
        return data
          ? (new Date(data.ends_at).getTime() -
              new Date(data.starts_at).getTime()) /
              (60 * 1000)
          : null
      })
      .toBe(130)
  } finally {
    await supabase.from("roster_shifts").delete().like("notes", `${note}%`)
  }
})

test("employee sees their own roster summary but not the owner roster", async ({
  employeePage,
}) => {
  await employeePage.goto("/dashboard")
  await expect(
    employeePage.getByText("Your roster", { exact: true })
  ).toBeVisible()
  await expect(employeePage.getByText("Working now")).toBeVisible()
  await expect(employeePage.getByRole("link", { name: "Roster" })).toHaveCount(
    0
  )

  const response = await employeePage.goto("/dashboard/roster")
  expect(response?.status()).toBe(404)
})
