import { devices, type Locator, type Page } from "@playwright/test"

import { authenticate, expect, test } from "./fixtures"

async function chooseJobDateTime(
  page: Page,
  dialog: Locator,
  label: "Due" | "Scheduled",
  time: string
) {
  await dialog.getByLabel(label, { exact: true }).click()
  const popover = page.locator('[data-slot="popover-content"]').last()
  await popover.getByRole("button", { name: /Monday, July 27/ }).click()
  await popover.getByLabel(`${label} time`).fill(time)
  await page.keyboard.press("Escape")
}

async function dragWithPointer(page: Page, source: Locator, target: Locator) {
  const sourceBox = await source.boundingBox()
  const targetBox = await target.boundingBox()
  expect(sourceBox).not.toBeNull()
  expect(targetBox).not.toBeNull()

  const startX = sourceBox!.x + 20
  const startY = sourceBox!.y + sourceBox!.height * 0.65
  const endX = targetBox!.x + targetBox!.width / 2
  const endY = targetBox!.y + Math.min(targetBox!.height / 2, 180)

  await page.mouse.move(startX, startY)
  await page.mouse.down()
  await page.mouse.move(startX + 8, startY, { steps: 2 })
  await page.mouse.move(endX, endY, { steps: 12 })
  await page.mouse.up()
}

test("employee sees only their assigned jobs ranked by urgency", async ({
  employeePage,
}) => {
  const response = await employeePage.goto("/dashboard/jobs")
  expect(response?.status()).toBe(200)
  await expect(
    employeePage.getByRole("heading", { name: "Jobs", level: 1 })
  ).toBeVisible()

  const assignedJobs = employeePage.getByRole("region", {
    name: "Assigned jobs",
  })
  const cards = assignedJobs.getByRole("article")
  await expect(
    assignedJobs.getByRole("article", { name: "Job Inspect loading bay" })
  ).toBeVisible()
  await expect(
    assignedJobs.getByRole("article", {
      name: "Job Review submitted checklist",
    })
  ).toBeVisible()
  await expect(assignedJobs).not.toContainText("Restock first aid station")
  await expect(assignedJobs).not.toContainText("Historical equipment audit")
  const priorityRanks = await cards.evaluateAll((elements) =>
    elements.map((element) => {
      const priority = (element as HTMLElement).dataset.priority
      return { high: 2, low: 0, normal: 1, urgent: 3 }[
        priority as "high" | "low" | "normal" | "urgent"
      ]
    })
  )
  expect(priorityRanks).toEqual(priorityRanks.toSorted((a, b) => b - a))
  await expect(
    employeePage.getByRole("button", { name: "Create job" })
  ).toHaveCount(0)
  await expect(
    employeePage.getByRole("combobox", { name: "Assign to" })
  ).toHaveCount(0)
})

test("owner board confines vertical overflow to its columns", async ({
  ownerPage,
}) => {
  await ownerPage.goto("/dashboard/jobs")
  await expect(
    ownerPage.getByRole("heading", { name: "Jobs", level: 1 })
  ).toBeVisible()
  await expect(ownerPage.locator("[data-column]")).toHaveCount(3)

  await expect
    .poll(() =>
      ownerPage.evaluate(
        () => document.documentElement.scrollHeight - window.innerHeight
      )
    )
    .toBeLessThanOrEqual(1)

  const cardLists = await ownerPage
    .locator("[data-card-list]")
    .evaluateAll((lists) =>
      lists.map((list) => ({
        overflowY: window.getComputedStyle(list).overflowY,
      }))
    )
  expect(cardLists).toHaveLength(3)
  expect(cardLists.every(({ overflowY }) => overflowY === "auto")).toBe(true)
})

test("owner creates, filters, and reassigns a job", async ({
  browser,
  ownerPage,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium",
    "This journey creates its own Pixel 7 context after desktop verification."
  )
  const title = `S04 ${testInfo.project.name} ${Date.now()}`
  const pageErrors: Error[] = []
  ownerPage.on("pageerror", (error) => pageErrors.push(error))
  await ownerPage.goto("/dashboard/jobs")
  await expect(
    ownerPage.getByRole("heading", { name: "Jobs", level: 1 })
  ).toBeVisible()
  await expect(
    ownerPage.getByRole("region", { name: "Assigned jobs", exact: true })
  ).toBeVisible()
  await expect(ownerPage.locator("[data-column]")).toHaveCount(3)
  await expect
    .poll(() =>
      ownerPage.evaluate(
        () => document.documentElement.scrollHeight - window.innerHeight
      )
    )
    .toBeLessThanOrEqual(1)
  await expect(
    ownerPage.getByRole("region", { name: "To review jobs", exact: true })
  ).toContainText("Review submitted checklist")
  const desktopAssignedBox = await ownerPage
    .getByRole("region", { name: "Assigned jobs", exact: true })
    .boundingBox()
  expect(desktopAssignedBox).not.toBeNull()
  expect(
    ownerPage.viewportSize()!.height -
      (desktopAssignedBox!.y + desktopAssignedBox!.height)
  ).toBeLessThan(48)
  await ownerPage.waitForLoadState("networkidle")
  expect(pageErrors).toEqual([])
  await ownerPage.getByRole("tab", { name: "Archived" }).click()
  await expect(
    ownerPage.getByRole("region", { name: "Archived jobs", exact: true })
  ).toBeVisible()
  await ownerPage.getByRole("tab", { name: "Workflow" }).click()
  await expect(ownerPage.locator("[data-column]")).toHaveCount(3)

  await ownerPage.getByRole("button", { name: "Create job" }).click()
  const dialog = ownerPage.getByRole("dialog", { name: "Create job" })
  expect(pageErrors).toEqual([])
  await expect(dialog).toBeVisible()
  await dialog.getByLabel("Title").fill(title)
  await dialog
    .getByLabel("Description")
    .fill("Created through the owner board.")
  await dialog.getByLabel("Location").fill("Loading bay")
  await dialog.getByLabel("Priority").click()
  await ownerPage.getByRole("option", { name: "Urgent" }).click()
  await dialog.getByLabel("Assignee").click()
  await ownerPage.getByRole("option", { name: "Alex Employee" }).click()
  await expect(dialog.getByLabel("Assignee")).toContainText("Alex Employee")
  await chooseJobDateTime(ownerPage, dialog, "Scheduled", "09:00")
  await chooseJobDateTime(ownerPage, dialog, "Due", "08:00")
  await dialog.getByRole("button", { name: "Create job" }).click()
  await expect(
    dialog.getByText("Due time cannot precede scheduled time.")
  ).toBeVisible()
  await expect(dialog.getByLabel("Title")).toHaveValue(title)

  await dialog.getByLabel("Due", { exact: true }).click()
  await ownerPage.getByLabel("Due time").fill("10:00")
  await ownerPage.keyboard.press("Escape")
  await dialog.getByLabel("Minimum completion photos").fill("1")
  await dialog
    .getByRole("checkbox", { name: "Require a completion note" })
    .check()
  await dialog.getByRole("button", { name: "Create job" }).click()
  await expect(dialog).not.toBeVisible({ timeout: 15_000 })

  const card = ownerPage.getByRole("article", { name: `Job ${title}` })
  await expect(card).toBeVisible()
  await expect(
    ownerPage.getByRole("region", { name: "Assigned jobs", exact: true })
  ).toContainText(title)
  await expect(card).toContainText("Alex Employee")
  await expect(card.getByRole("combobox", { name: "Assign to" })).toContainText(
    "Alex Employee"
  )
  await expect(
    card.getByRole("combobox", { name: "Assign to" })
  ).not.toContainText("1103")
  await expect(card.getByText("Urgent")).toBeVisible()
  await expect(card.getByText("Completion note required")).toBeVisible()
  await expect(card.getByText("1 completion photo")).toBeVisible()

  await card.getByRole("button", { name: `Edit ${title}` }).click()
  const editDialog = ownerPage.getByRole("dialog", { name: "Edit job" })
  await expect(editDialog.getByLabel("Assignee")).toContainText("Alex Employee")
  await editDialog
    .getByLabel("Description")
    .fill("Updated through the owner board.")
  await editDialog.getByRole("button", { name: "Save changes" }).click()
  await expect(editDialog).not.toBeVisible()
  await expect(card.getByText("Updated through the owner board.")).toBeVisible()

  const unassignResponse = ownerPage.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().includes("/dashboard/jobs")
  )
  await card.getByRole("combobox", { name: "Assign to" }).click()
  await ownerPage.getByRole("option", { name: "Unassign" }).click()
  await unassignResponse
  const unassigned = ownerPage.getByRole("region", {
    name: "Unassigned jobs",
    exact: true,
  })
  await expect(
    unassigned.getByRole("article", { name: `Job ${title}` })
  ).toBeVisible()
  await expect(
    unassigned
      .getByRole("article", { name: `Job ${title}` })
      .getByRole("combobox", { name: "Assign to" })
  ).toContainText("Unassign")
  await expect(
    unassigned
      .getByRole("article", { name: `Job ${title}` })
      .getByLabel("Assign to")
  ).toBeEnabled()

  const fullCardDragSurface = unassigned.getByRole("button", {
    name: `Drag ${title}`,
  })
  const destination = ownerPage.getByRole("region", {
    name: "Assigned jobs",
    exact: true,
  })
  const assignmentDialog = ownerPage.getByRole("dialog", {
    name: `Assign ${title}`,
  })
  await expect(async () => {
    await dragWithPointer(ownerPage, fullCardDragSurface, destination)
    await expect(assignmentDialog).toBeVisible({ timeout: 2_000 })
  }).toPass({ timeout: 10_000 })
  await assignmentDialog.getByRole("button", { name: "Cancel" }).click()
  await expect(
    unassigned.getByRole("article", { name: `Job ${title}` })
  ).toBeVisible()

  await ownerPage.reload()
  await ownerPage.waitForLoadState("networkidle")
  await ownerPage.getByRole("tab", { name: "Archived" }).click()
  await expect(
    ownerPage.getByRole("region", { name: "Archived jobs", exact: true })
  ).toBeVisible()
  await ownerPage.getByRole("tab", { name: "Workflow" }).click()
  const keyboardFullCardDragSurface = ownerPage
    .getByRole("region", { name: "Unassigned jobs", exact: true })
    .getByRole("button", { name: `Drag ${title}` })
  await keyboardFullCardDragSurface.focus()
  await ownerPage.keyboard.press("Space")
  await ownerPage.keyboard.press("ArrowRight")
  await ownerPage.keyboard.press("Space")
  await expect(assignmentDialog).toBeVisible()
  await assignmentDialog.getByRole("combobox", { name: "Employee" }).click()
  await ownerPage.getByRole("option", { name: "Alex Employee" }).click()
  const dragResponse = ownerPage.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().includes("/dashboard/jobs")
  )
  await assignmentDialog.getByRole("button", { name: "Assign job" }).click()
  await dragResponse
  await expect(
    destination.getByRole("article", { name: `Job ${title}` })
  ).toBeVisible()
  await expect(
    destination.getByRole("article", { name: `Job ${title}` })
  ).toContainText("Alex Employee")

  await ownerPage.reload()
  await expect(
    ownerPage
      .getByRole("region", { name: "Assigned jobs", exact: true })
      .getByRole("article", { name: `Job ${title}` })
  ).toBeVisible()

  await ownerPage.getByRole("tab", { name: "Archived" }).click()
  await expect(ownerPage.locator("[data-column]")).toHaveCount(1)
  await expect(
    ownerPage
      .getByRole("region", { name: "Archived jobs", exact: true })
      .getByRole("article", { name: "Job Historical equipment audit" })
  ).toBeVisible()
  await expect(
    ownerPage.getByRole("article", { name: "Job Historical equipment audit" })
  ).toContainText("Casey Inactive")

  const mobileContext = await browser.newContext({ ...devices["Pixel 7"] })
  await authenticate(mobileContext, "owner@example.test")
  const mobilePage = await mobileContext.newPage()
  await mobilePage.goto("/dashboard/jobs")
  const mobileScroller = mobilePage.locator("[data-board-scroll]")
  const mobileUnassigned = mobilePage.getByRole("region", {
    name: "Unassigned jobs",
    exact: true,
  })
  const mobileAssigned = mobilePage.getByRole("region", {
    name: "Assigned jobs",
    exact: true,
  })
  const mobileSizes = await mobilePage.evaluate(() => {
    const scroller = document.querySelector<HTMLElement>("[data-board-scroll]")
    const unassigned = document.querySelector<HTMLElement>(
      '[data-column="unassigned"]'
    )
    const assigned = document.querySelector<HTMLElement>(
      '[data-column="assigned"]'
    )
    if (!scroller || !unassigned || !assigned) return null
    return {
      assignedWidth: assigned.getBoundingClientRect().width,
      columnBottom: assigned.getBoundingClientRect().bottom,
      scrollerWidth: scroller.clientWidth,
      snapType: getComputedStyle(scroller).scrollSnapType,
      unassignedWidth: unassigned.getBoundingClientRect().width,
    }
  })
  expect(mobileSizes).not.toBeNull()
  expect(mobileSizes!.snapType).toContain("x")
  expect(
    Math.abs(mobileSizes!.unassignedWidth - mobileSizes!.scrollerWidth)
  ).toBeLessThan(2)
  expect(
    Math.abs(mobileSizes!.assignedWidth - mobileSizes!.scrollerWidth)
  ).toBeLessThan(2)
  expect(
    mobilePage.viewportSize()!.height - mobileSizes!.columnBottom
  ).toBeLessThan(32)
  expect(
    await mobilePage.evaluate(
      () => document.documentElement.scrollHeight - window.innerHeight
    )
  ).toBeLessThanOrEqual(1)
  await mobileAssigned.evaluate((column) =>
    column.scrollIntoView({ behavior: "auto", inline: "start" })
  )
  await expect
    .poll(() => mobileScroller.evaluate((element) => element.scrollLeft))
    .toBeGreaterThan(0)
  const mobileCard = mobilePage.getByRole("article", { name: `Job ${title}` })
  await expect(mobileCard).toBeVisible()
  await expect(
    mobileCard.getByRole("combobox", { name: "Assign to" })
  ).toContainText("Alex Employee")
  const mobileUnassignResponse = mobilePage.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().includes("/dashboard/jobs")
  )
  await mobileCard.getByRole("combobox", { name: "Assign to" }).click()
  await mobilePage.getByRole("option", { name: "Unassign" }).click()
  await mobileUnassignResponse
  await expect(
    mobileUnassigned.getByRole("article", { name: `Job ${title}` })
  ).toBeVisible()
  await expect(
    mobilePage
      .getByRole("article", { name: `Job ${title}` })
      .getByLabel("Assign to")
  ).toBeEnabled()
  const mobileAssignResponse = mobilePage.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().includes("/dashboard/jobs")
  )
  await mobilePage
    .getByRole("article", { name: `Job ${title}` })
    .getByRole("combobox", { name: "Assign to" })
    .click()
  await mobilePage.getByRole("option", { name: "Alex Employee" }).click()
  await mobileAssignResponse
  await expect(
    mobilePage
      .getByRole("region", { name: "Assigned jobs", exact: true })
      .getByRole("article", { name: `Job ${title}` })
  ).toBeVisible()
  await mobileContext.close()
})
