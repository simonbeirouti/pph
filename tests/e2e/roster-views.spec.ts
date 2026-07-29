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

async function createAssignableJob(title: string) {
  const supabase = createAdminClient()
  const { data: job, error } = await supabase
    .from("jobs")
    .insert({
      created_by: 1101,
      organisation_id: 1001,
      status: "assigned",
      title,
    })
    .select("id")
    .single()
  expect(error).toBeNull()

  return {
    id: job!.id,
    async cleanup() {
      await supabase.from("job_updates").delete().eq("job_id", job!.id)
      await supabase.from("jobs").delete().eq("id", job!.id)
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

test("owner roster defaults to a layered Team week", async ({
  ownerPage,
}, testInfo) => {
  const fixture = await createRosteredEmployee()
  try {
    const response = await ownerPage.goto("/dashboard/roster")
    expect(response?.status()).toBe(200)
    await expect(
      ownerPage.getByRole("heading", { name: "Roster", level: 1 })
    ).toBeVisible()
    const employeeFilter = ownerPage.getByRole("combobox", {
      name: "Filter employee",
    })
    await expect(employeeFilter).toContainText("All team")
    await expect(
      ownerPage.getByText("Employee week", { exact: true })
    ).toHaveCount(0)
    const browserTimezone = await ownerPage.evaluate(
      () => Intl.DateTimeFormat().resolvedOptions().timeZone
    )
    expect(new URL(ownerPage.url()).searchParams.has("timezone")).toBe(false)
    await expect(
      ownerPage.getByText(`Times shown in ${browserTimezone}`, { exact: true })
    ).toHaveCount(0)
    await expect(
      ownerPage.getByRole("timer", { name: /Current time/ })
    ).toBeVisible()
    const calendar = ownerPage
      .getByRole("region", { name: "Roster grid" })
      .first()
    const dayCanvases = calendar.locator("[data-roster-day-canvas]")
    await expect(dayCanvases).toHaveCount(7)
    await expect(dayCanvases.first()).toHaveCSS("border-right-style", "solid")
    const overlappingShift = calendar.getByRole("button", {
      name: /Morgan Roster.+E2E second employee/,
    })
    await expect(overlappingShift.locator("..")).toHaveAttribute(
      "data-stack-layer"
    )
    if (testInfo.project.name === "chromium") {
      const shiftBox = await overlappingShift.boundingBox()
      expect(shiftBox).not.toBeNull()
      await ownerPage.keyboard.down("Alt")
      await ownerPage.mouse.move(
        shiftBox!.x + shiftBox!.width / 2,
        shiftBox!.y + shiftBox!.height / 3
      )
      await ownerPage.mouse.down()
      await ownerPage.mouse.move(
        shiftBox!.x + shiftBox!.width / 2,
        shiftBox!.y + (shiftBox!.height * 2) / 3
      )
      await ownerPage.mouse.up()
      await ownerPage.keyboard.up("Alt")
      const createDialog = ownerPage.getByRole("dialog", {
        name: "Add roster shift",
      })
      await expect(createDialog).toBeVisible()
      await expect(
        createDialog.getByRole("combobox", { name: "Employee" })
      ).toContainText("Choose employee")
      await ownerPage.keyboard.press("Escape")
      await expect(createDialog).not.toBeVisible()
    }

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

    await employeeFilter.click()
    await ownerPage.getByRole("option", { name: "Alex Employee" }).click()
    await expect(employeeFilter).toContainText("Alex Employee")
    await expect(ownerPage).toHaveURL(/employee=1103/)
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
    await expect(ownerPage).toHaveURL(/view=team/)
    await expect(ownerPage).toHaveURL(/employee=1103/)

    if (testInfo.project.name === "mobile-chrome") {
      const calendar = ownerPage.getByRole("region", {
        name: "Roster grid",
      })
      await expect(calendar.locator("[data-roster-day-header]")).toHaveCount(7)
      const dayWidths = await calendar
        .locator("[data-roster-day-canvas]")
        .evaluateAll((elements) =>
          elements.map((element) => element.getBoundingClientRect().width)
        )
      expect(dayWidths).toHaveLength(7)
      expect(new Set(dayWidths.map((width) => Math.round(width))).size).toBe(1)
      expect(dayWidths[0]).toBeCloseTo(ownerPage.viewportSize()!.width - 96, 0)
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
    const sheet = ownerPage.getByRole("dialog", { name: "Alex Employee" })
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
    const createButton = createDialog.getByRole("button", {
      name: "Create shift",
    })
    await createButton.click()

    const createdShift = await expect
      .poll(
        async () => {
          const { data } = await supabase
            .from("roster_shifts")
            .select("id")
            .eq("organisation_id", 1001)
            .eq("notes", note)
            .maybeSingle()
          return data
        },
        { timeout: 15_000 }
      )
      .not.toBeNull()
      .then(async () => {
        const { data } = await supabase
          .from("roster_shifts")
          .select("id")
          .eq("organisation_id", 1001)
          .eq("notes", note)
          .single()
        return data
      })
    expect(createdShift).not.toBeNull()
    await expect(createDialog).not.toBeVisible({ timeout: 15_000 })
    await sheet.getByRole("button", { name: "Close" }).click()
    await ownerPage.reload()
    await ownerPage
      .getByRole("row", { name: "Open Alex Employee details" })
      .getByRole("cell", { name: "Operator" })
      .click()
    const refreshedSheet = ownerPage.getByRole("dialog", {
      name: "Alex Employee",
    })
    await refreshedSheet.locator(`[data-shift-id="${createdShift!.id}"]`).click()
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

test("owner creates a shift with a scheduled job from the roster calendar", async ({
  ownerPage,
}, testInfo) => {
  const supabase = createAdminClient()
  const title = `Calendar job ${testInfo.project.name} ${Date.now()}`
  const note = `Calendar shift ${testInfo.project.name} ${Date.now()}`
  const job = await createAssignableJob(title)
  const target = new Date(Date.now() + 12 * 24 * 60 * 60 * 1000)
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
  const mobile = testInfo.project.name === "mobile-chrome"
  const expectedStart = mobile ? "14:07" : "08:00"
  const expectedEnd = mobile ? "15:13" : "10:00"

  try {
    await ownerPage.goto(
      `/dashboard/roster?date=${targetDate}&view=team&employee=1103`
    )
    await expect(
      ownerPage.getByRole("heading", { name: "Roster", level: 1 })
    ).toBeVisible()
    await expect(
      ownerPage.getByRole("combobox", { name: "Filter employee" })
    ).toContainText("Alex Employee")
    await ownerPage
      .getByRole("combobox", { name: "Filter employee" })
      .click()
    await expect(
      ownerPage.getByRole("option", { name: "Alex Employee" })
    ).toBeVisible()
    await ownerPage.keyboard.press("Escape")
    expect(new URL(ownerPage.url()).searchParams.has("timezone")).toBe(false)
    if (!mobile) {
      await ownerPage.getByRole("button", { name: "Add shift" }).click()
      const readinessDialog = ownerPage.getByRole("dialog", {
        name: "Add roster shift",
      })
      await expect(readinessDialog).toBeVisible()
      await ownerPage.keyboard.press("Escape")
      await expect(readinessDialog).not.toBeVisible()
    }

    const lane = ownerPage
      .locator(`[data-roster-date="${targetDate}"] [data-team-shift-canvas]`)
      .nth(mobile ? 1 : 0)
    await expect(lane).toBeVisible()
    const box = await lane.boundingBox()
    expect(box).not.toBeNull()
    const x = box!.x + box!.width / 2

    if (mobile) {
      await lane.tap({
        position: {
          x: box!.width / 2,
          y: box!.height * (14 / 24),
        },
      })
    } else {
      await lane.hover({
        position: {
          x: box!.width / 2,
          y: box!.height * (8 / 24),
        },
      })
      await ownerPage.mouse.down()
      await ownerPage.mouse.move(x, box!.y + box!.height * (10 / 24), {
        steps: 4,
      })
      await expect(
        ownerPage.getByTestId("roster-range-selection")
      ).toBeVisible()
      await ownerPage.mouse.up()
    }

    const dialog = ownerPage.getByRole("dialog", {
      name: "Add roster shift",
    })
    await expect(dialog).toBeVisible()
    await expect(dialog).toHaveAttribute(
      "data-slot",
      mobile ? "drawer-popup" : "dialog-content"
    )
    await expect(dialog.getByLabel("Date", { exact: true })).toHaveValue(
      targetDate
    )
    await expect(
      dialog.getByRole("combobox", { name: "Employee" })
    ).toContainText("Alex Employee")
    if (mobile) {
      await expect(dialog.getByLabel("Start", { exact: true })).toHaveValue(
        "14:00"
      )
      await expect(dialog.getByLabel("End", { exact: true })).toHaveValue(
        "15:00"
      )
      await dialog.getByLabel("Start", { exact: true }).fill(expectedStart)
      await expect(dialog.getByLabel("End", { exact: true })).toHaveValue(
        "15:07"
      )
      await dialog.getByLabel("End", { exact: true }).fill(expectedEnd)
    } else {
      await expect(dialog.getByLabel("Start", { exact: true })).toHaveValue(
        expectedStart
      )
      await expect(dialog.getByLabel("End", { exact: true })).toHaveValue(
        expectedEnd
      )
    }
    await dialog.getByLabel("Notes", { exact: true }).fill(note)
    await dialog.getByRole("checkbox", { name: `Assign ${title}` }).click()
    await dialog.getByRole("button", { name: "Create shift" }).click()
    await expect(dialog).not.toBeVisible()

    await expect
      .poll(async () => {
        const [{ data: shift }, { data: scheduledJob }] = await Promise.all([
          supabase
            .from("roster_shifts")
            .select("employee_membership_id, starts_at, ends_at")
            .eq("organisation_id", 1001)
            .eq("notes", note)
            .maybeSingle(),
          supabase
            .from("jobs")
            .select("assignee_membership_id, scheduled_at, due_at")
            .eq("id", job.id)
            .maybeSingle(),
        ])
        if (!shift || !scheduledJob) return null
        const localTimes = [shift.starts_at, shift.ends_at].map((instant) =>
          new Intl.DateTimeFormat("en-AU", {
            hour: "2-digit",
            hour12: false,
            minute: "2-digit",
            timeZone: "Australia/Melbourne",
          }).format(new Date(instant))
        )
        return {
          assignee: scheduledJob.assignee_membership_id,
          dueMatches: scheduledJob.due_at === shift.ends_at,
          employee: shift.employee_membership_id,
          scheduledMatches: scheduledJob.scheduled_at === shift.starts_at,
          times: localTimes,
        }
      })
      .toEqual({
        assignee: 1103,
        dueMatches: true,
        employee: 1103,
        scheduledMatches: true,
        times: [expectedStart, expectedEnd],
      })

    if (!mobile) {
      const readShiftTimes = async () => {
        const { data } = await supabase
          .from("roster_shifts")
          .select("starts_at, ends_at")
          .eq("organisation_id", 1001)
          .eq("notes", note)
          .maybeSingle()
        return data
          ? [data.starts_at, data.ends_at].map((instant) =>
              new Intl.DateTimeFormat("en-AU", {
                hour: "2-digit",
                hour12: false,
                minute: "2-digit",
                timeZone: "Australia/Melbourne",
              }).format(new Date(instant))
            )
          : null
      }

      await ownerPage.reload()
      const shiftButton = ownerPage
        .getByRole("button", { name: new RegExp(note) })
        .first()
      const dayCanvas = shiftButton
        .locator("xpath=ancestor::*[@data-team-shift-canvas][1]")
      const dayBox = await dayCanvas.boundingBox()
      expect(dayBox).not.toBeNull()
      const oneHour = dayBox!.height / 24
      const shiftBox = await shiftButton.boundingBox()
      expect(shiftBox).not.toBeNull()
      await ownerPage.mouse.move(
        shiftBox!.x + shiftBox!.width / 2,
        shiftBox!.y + shiftBox!.height / 2
      )
      await ownerPage.mouse.down()
      await ownerPage.mouse.move(
        shiftBox!.x + shiftBox!.width / 2,
        shiftBox!.y + shiftBox!.height / 2 + oneHour,
        { steps: 8 }
      )
      await ownerPage.mouse.up()
      await expect.poll(readShiftTimes).toEqual(["09:00", "11:00"])

      await ownerPage.reload()
      const startHandle = ownerPage.getByRole("button", {
        name: "Resize Alex Employee shift start",
      })
      const startBox = await startHandle.boundingBox()
      expect(startBox).not.toBeNull()
      await ownerPage.mouse.move(
        startBox!.x + startBox!.width / 2,
        startBox!.y + startBox!.height / 2
      )
      await ownerPage.mouse.down()
      await ownerPage.mouse.move(
        startBox!.x + startBox!.width / 2,
        startBox!.y + startBox!.height / 2 + oneHour,
        { steps: 8 }
      )
      await ownerPage.mouse.up()
      await expect.poll(readShiftTimes).toEqual(["10:00", "11:00"])

      await ownerPage.reload()
      const endHandle = ownerPage.getByRole("button", {
        name: "Resize Alex Employee shift end",
      })
      const endBox = await endHandle.boundingBox()
      expect(endBox).not.toBeNull()
      await ownerPage.mouse.move(
        endBox!.x + endBox!.width / 2,
        endBox!.y + endBox!.height / 2
      )
      await ownerPage.mouse.down()
      await ownerPage.mouse.move(
        endBox!.x + endBox!.width / 2,
        endBox!.y + endBox!.height / 2 + oneHour,
        { steps: 8 }
      )
      await ownerPage.mouse.up()
      await expect.poll(readShiftTimes).toEqual(["10:00", "12:00"])

      const { data: scheduledJob } = await supabase
        .from("jobs")
        .select("scheduled_at, due_at")
        .eq("id", job.id)
        .single()
      const jobTimes = [scheduledJob!.scheduled_at!, scheduledJob!.due_at!].map(
        (instant) =>
          new Intl.DateTimeFormat("en-AU", {
            hour: "2-digit",
            hour12: false,
            minute: "2-digit",
            timeZone: "Australia/Melbourne",
          }).format(new Date(instant))
      )
      expect(jobTimes).toEqual(["08:00", "10:00"])
      await expect(endHandle).toBeEnabled()

      let contextShift = ownerPage
        .getByRole("button", { name: new RegExp(note) })
        .first()
      await contextShift.click({ button: "right" })
      await ownerPage.getByRole("menuitem", { name: "Lock shift" }).click()
      await expect
        .poll(async () => {
          const { data } = await supabase
            .from("roster_shifts")
            .select("locked_at")
            .eq("organisation_id", 1001)
            .eq("notes", note)
            .single()
          return data?.locked_at
        })
        .not.toBeNull()

      await ownerPage.reload()
      await expect(
        ownerPage.getByRole("button", {
          name: "Resize Alex Employee shift start",
        })
      ).toHaveCount(0)
      contextShift = ownerPage
        .getByRole("button", { name: new RegExp(note) })
        .first()
      await contextShift.click({ button: "right" })
      await ownerPage.getByRole("menuitem", { name: "Unlock shift" }).click()
      await expect
        .poll(async () => {
          const { data } = await supabase
            .from("roster_shifts")
            .select("locked_at")
            .eq("organisation_id", 1001)
            .eq("notes", note)
            .single()
          return data?.locked_at
        })
        .toBeNull()

      await ownerPage.reload()
      contextShift = ownerPage
        .getByRole("button", { name: new RegExp(note) })
        .first()
      await contextShift.click({ button: "right" })
      await ownerPage.getByRole("menuitem", { name: "Duplicate" }).click()
      const duplicateDialog = ownerPage.getByRole("dialog", {
        name: "Add roster shift",
      })
      await expect(duplicateDialog.getByLabel("Notes")).toHaveValue(note)
      await expect(
        duplicateDialog.getByRole("combobox", { name: "Employee" })
      ).toContainText("Alex Employee")
      await ownerPage.keyboard.press("Escape")

      await contextShift.click({ button: "right" })
      await ownerPage.getByRole("menuitem", { name: "Edit" }).click()
      const contextEditDialog = ownerPage.getByRole("dialog", {
        name: "Edit roster shift",
      })
      await expect(
        contextEditDialog.getByRole("combobox", { name: "Employee" })
      ).toContainText("Alex Employee")
      const editDate = contextEditDialog.getByRole("textbox", {
        name: "Date",
      })
      await editDate.click()
      const calendarPopup = ownerPage.locator(
        '[data-slot="popover-content"]'
      )
      await expect(ownerPage.locator('[data-slot="calendar"]')).toBeVisible()
      await expect(calendarPopup).toHaveAttribute("data-side", "bottom")
      await editDate.fill(targetDate)
      await expect(editDate).toHaveValue(targetDate)
      await expect(
        contextEditDialog.getByLabel("Start", { exact: true })
      ).toHaveValue("10:00")
      await expect(
        contextEditDialog.getByLabel("End", { exact: true })
      ).toHaveValue("12:00")
      await contextEditDialog
        .getByLabel("Start", { exact: true })
        .fill("10:15")
      await expect(
        contextEditDialog.getByLabel("End", { exact: true })
      ).toHaveValue("12:15")
      await contextEditDialog
        .getByRole("button", { name: "Save shift" })
        .click()
      await expect(contextEditDialog).not.toBeVisible()
      await expect.poll(readShiftTimes).toEqual(["10:15", "12:15"])

      contextShift = ownerPage
        .getByRole("button", { name: new RegExp(note) })
        .first()
      await contextShift.click({ button: "right" })
      await ownerPage.getByRole("menuitem", { name: "Edit" }).click()
      const secondEditDialog = ownerPage.getByRole("dialog", {
        name: "Edit roster shift",
      })
      await secondEditDialog
        .getByLabel("End", { exact: true })
        .fill("12:30")
      await secondEditDialog
        .getByRole("button", { name: "Save shift" })
        .click()
      await expect(secondEditDialog).not.toBeVisible()
      await expect.poll(readShiftTimes).toEqual(["10:15", "12:30"])

      contextShift = ownerPage
        .getByRole("button", { name: new RegExp(note) })
        .first()
      await contextShift.click({ button: "right" })
      await ownerPage.getByRole("menuitem", { name: "Delete" }).click()
      const deleteDialog = ownerPage.getByRole("alertdialog", {
        name: "Delete roster shift?",
      })
      await deleteDialog.getByRole("button", { name: "Delete shift" }).click()
      await expect
        .poll(async () => {
          const { data } = await supabase
            .from("roster_shifts")
            .select("archived_at")
            .eq("organisation_id", 1001)
            .eq("notes", note)
            .single()
          return data?.archived_at
        })
        .not.toBeNull()
    }
  } finally {
    await supabase.from("roster_shifts").delete().eq("notes", note)
    await job.cleanup()
  }
})

test("employee sees a self-scoped read-only roster with allocated jobs", async ({
  employeePage,
}, testInfo) => {
  const supabase = createAdminClient()
  const allocatedTitle = `Employee roster job ${testInfo.project.name} ${Date.now()}`
  const shiftNote = `Employee roster shift ${testInfo.project.name} ${Date.now()}`
  const allocatedJob = await createAssignableJob(allocatedTitle)
  const startsAt = new Date(Date.now() - 30 * 60 * 1000).toISOString()
  const endsAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
  await supabase
    .from("roster_shifts")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", 1301)
  const { data: employeeShift, error: shiftError } = await supabase
    .from("roster_shifts")
    .insert({
      created_by: 1101,
      employee_membership_id: 1103,
      ends_at: endsAt,
      notes: shiftNote,
      organisation_id: 1001,
      starts_at: startsAt,
    })
    .select("id, starts_at, ends_at")
    .single()
  expect(shiftError).toBeNull()
  const { error: allocationError } = await supabase
    .from("jobs")
    .update({
      assignee_membership_id: 1103,
      due_at: employeeShift!.ends_at,
      scheduled_at: employeeShift!.starts_at,
    })
    .eq("id", allocatedJob.id)
  expect(allocationError).toBeNull()
  try {
    await employeePage.goto("/dashboard")
    await expect(
      employeePage.getByText("Your roster", { exact: true })
    ).toBeVisible()
    await expect(
      employeePage.getByText(shiftNote, { exact: true })
    ).toBeVisible()
    const mobile = testInfo.project.name === "mobile-chrome"
    if (mobile) {
      await employeePage
        .getByRole("button", { name: "Toggle navigation" })
        .click()
    }
    await expect(
      employeePage.getByRole("link", { name: "Roster" })
    ).toBeVisible()

    const response = await employeePage.goto(
      "/dashboard/roster?view=day&employee=1102"
    )
    expect(response?.status()).toBe(200)
    await expect(
      employeePage.getByText(
        "Your read-only weekly roster and allocated jobs.",
        { exact: true }
      ).first()
    ).toBeVisible()
    await expect(
      employeePage.getByRole("button", { name: "Add shift" })
    ).toHaveCount(0)
    await expect(
      employeePage.getByText("Team week", { exact: true })
    ).toHaveCount(0)
    await expect(
      employeePage.getByRole("combobox", { name: "Filter employee" })
    ).toHaveCount(0)
    if (mobile) {
      const dismissInstallGuidance = employeePage.getByRole("button", {
        name: "Dismiss install guidance",
      })
      await expect(dismissInstallGuidance).toBeVisible()
      await dismissInstallGuidance.click()
    }
    await expect(
      employeePage.getByLabel("Indie Invited shift lane")
    ).toHaveCount(0)

    const calendar = employeePage
      .getByRole("region", { name: "Roster grid" })
      .first()
    await calendar
      .getByRole("button", {
        name: new RegExp(`Alex Employee.+${shiftNote}`),
      })
      .first()
      .click()
    const shiftDialog = employeePage.getByRole("dialog", {
      name: "Alex Employee",
    })
    if (mobile) {
      await expect(shiftDialog).toHaveAttribute("data-slot", "drawer-popup")
    }
    await expect(
      shiftDialog.getByRole("link", { name: allocatedTitle })
    ).toHaveAttribute("href", `/dashboard/jobs?job=${allocatedJob.id}`)
  } finally {
    if (employeeShift) {
      await supabase.from("roster_shifts").delete().eq("id", employeeShift.id)
    }
    await allocatedJob.cleanup()
  }
})
