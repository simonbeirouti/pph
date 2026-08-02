import { test, expect } from "./fixtures"
import { SIDEBAR_COOKIE_NAME } from "@/lib/sidebar"

test("signed-out dashboard requests redirect to login", async ({ page }) => {
  await page.goto("/dashboard")

  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible()
})

test("owner receives the owner application shell", async ({ ownerPage }) => {
  await ownerPage.goto("/dashboard")

  await expect(
    ownerPage.getByRole("heading", { name: "Good day, Olivia Owner" })
  ).toBeVisible()
  await expect(ownerPage.getByText("Outstanding")).toBeVisible()
  await expect(ownerPage.getByText("Australia/Melbourne")).toBeVisible()
})

test("sidebar toggles and links to the current profile", async ({
  ownerPage,
}, testInfo) => {
  await ownerPage.goto("/dashboard")
  await ownerPage.waitForLoadState("networkidle")
  const sidebar = ownerPage.locator('[data-sidebar="sidebar"]')
  const dashboardLink = sidebar.getByRole("link", { name: "Dashboard" })
  const toggle = ownerPage.getByRole("button", { name: "Toggle navigation" })
  const mobile = testInfo.project.name.includes("mobile")

  await expect(dashboardLink).toBeVisible({ visible: !mobile })
  if (mobile) await toggle.tap()
  else await toggle.click()

  if (mobile) {
    await expect(
      ownerPage.locator('[data-sidebar="sidebar"][data-mobile="true"]')
    ).toBeVisible()
    await expect(dashboardLink).toBeVisible()
    await ownerPage.getByRole("button", { name: "Close navigation" }).click()
    await expect(dashboardLink).toBeHidden()
    await toggle.click()
    await sidebar.getByRole("link", { name: "Jobs" }).click()
    await expect(ownerPage).toHaveURL(/\/dashboard\/jobs$/)
    await expect(dashboardLink).toBeHidden()
    await ownerPage.goto("/dashboard")
    await toggle.click()
  } else {
    await expect(
      ownerPage.locator('[data-slot="sidebar"][data-state="collapsed"]')
    ).toBeAttached()
    await expect(dashboardLink).toBeVisible()
    await expect
      .poll(async () => {
        const cookies = await ownerPage.context().cookies()
        return cookies.find((cookie) => cookie.name === SIDEBAR_COOKIE_NAME)
          ?.value
      })
      .toBe("false")
    await ownerPage.reload()
    await expect(
      ownerPage.locator('[data-slot="sidebar"][data-state="collapsed"]')
    ).toBeAttached()
  }

  await ownerPage.getByRole("link", { name: /Olivia Owner/ }).press("Enter")
  await expect(ownerPage).toHaveURL(/\/dashboard\/profile$/)
  await expect(
    ownerPage.getByRole("heading", { name: "Olivia Owner" })
  ).toBeVisible()
})

test("mobile touch activates shared buttons, tabs, and selects", async ({
  ownerPage,
}, testInfo) => {
  test.skip(!testInfo.project.name.includes("mobile"))
  const runtimeErrors: string[] = []
  ownerPage.on("console", (message) => {
    if (
      message.type() === "error" &&
      /ChunkLoadError|Hydration failed|hydration mismatch/i.test(message.text())
    ) {
      runtimeErrors.push(message.text())
    }
  })
  ownerPage.on("pageerror", (error) => {
    if (
      /ChunkLoadError|Hydration failed|hydration mismatch/i.test(error.message)
    ) {
      runtimeErrors.push(error.message)
    }
  })
  await ownerPage.goto("/dashboard/jobs")

  await ownerPage.getByRole("button", { name: "Create job" }).tap()
  const dialog = ownerPage.getByRole("dialog", { name: "Create job" })
  await expect(dialog).toBeVisible()
  const drawerPopup = ownerPage.locator('[data-slot="drawer-popup"]')
  await expect(drawerPopup).toBeVisible()
  await expect
    .poll(async () => {
      const box = await drawerPopup.boundingBox()
      return box ? Math.ceil(box.y + box.height) : Number.POSITIVE_INFINITY
    })
    .toBeLessThanOrEqual(ownerPage.viewportSize()!.height)
  const drawerBox = await drawerPopup.boundingBox()
  expect(drawerBox).not.toBeNull()
  expect(drawerBox!.y).toBeGreaterThanOrEqual(0)
  const drawerContent = ownerPage.locator('[data-slot="drawer-content"]')
  await expect(drawerContent).toHaveClass(/overflow-y-auto/)
  await drawerContent.evaluate((element) => {
    element.scrollTop = element.scrollHeight
  })
  await expect(dialog.getByRole("button", { name: "Create job" })).toBeVisible()
  await ownerPage.keyboard.press("Escape")
  await expect(dialog).toBeHidden()

  const archived = ownerPage.getByRole("tab", { name: "Archived" })
  await archived.tap()
  await expect(archived).toHaveAttribute("aria-selected", "true")

  const urgency = ownerPage.getByRole("combobox", {
    name: "Filter by urgency",
  })
  await urgency.tap()
  await ownerPage.getByRole("option", { name: "Urgent", exact: true }).tap()
  await expect(urgency).toContainText("Urgent")

  await ownerPage.goto("/dashboard/employees")
  const employeeStatus = ownerPage.getByRole("combobox", {
    name: "Filter by status",
  })
  await expect(employeeStatus).toContainText("All statuses")
  await employeeStatus.tap()
  await ownerPage.getByRole("option", { name: "Active", exact: true }).tap()
  await expect(employeeStatus).toContainText("Active")
  await ownerPage.getByRole("button", { name: "Add employee" }).tap()
  const employeeDialog = ownerPage.getByRole("dialog", {
    name: "Add employee",
  })
  await expect(employeeDialog).toBeVisible()
  const employeeDrawer = ownerPage.locator('[data-slot="drawer-popup"]:visible')
  await expect
    .poll(async () => {
      const box = await employeeDrawer.boundingBox()
      return box ? Math.ceil(box.y + box.height) : Number.POSITIVE_INFINITY
    })
    .toBeLessThanOrEqual(ownerPage.viewportSize()!.height)
  const employeeDrawerBox = await employeeDrawer.boundingBox()
  expect(employeeDrawerBox).not.toBeNull()
  expect(employeeDrawerBox!.y).toBeGreaterThanOrEqual(0)
  const avatarButton = employeeDialog.getByRole("button", {
    name: "Upload profile photo",
  })
  await expect(avatarButton).toBeVisible()
  const avatarButtonBox = await avatarButton.boundingBox()
  expect(avatarButtonBox).not.toBeNull()
  expect(avatarButtonBox!.width).toBe(avatarButtonBox!.height)
  expect(avatarButtonBox!.width).toBeLessThanOrEqual(96)
  await employeeDialog
    .getByLabel("Profile photo", { exact: true })
    .setInputFiles({
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
        "base64"
      ),
      mimeType: "image/png",
      name: "avatar.png",
    })
  await expect(
    employeeDialog.getByRole("img", { name: "Selected profile preview" })
  ).toBeVisible()
  await expect(
    employeeDialog.getByRole("button", { name: "Create and invite" })
  ).toHaveClass(/w-full/)
  await ownerPage.keyboard.press("Escape")
  await expect(employeeDialog).toBeHidden()
  expect(runtimeErrors).toEqual([])
})

test("employee job drawer follows client-side query navigation", async ({
  employeePage,
}, testInfo) => {
  test.skip(!testInfo.project.name.includes("mobile"))
  await employeePage.goto("/dashboard/jobs")

  const jobs = employeePage.getByRole("article")
  await expect(jobs.first()).toBeVisible()
  await expect(jobs.nth(1)).toBeVisible()

  const firstTitle = (await jobs.first().getAttribute("aria-label"))?.replace(
    /^Job /,
    ""
  )
  const secondTitle = (await jobs.nth(1).getAttribute("aria-label"))?.replace(
    /^Job /,
    ""
  )
  expect(firstTitle).toBeTruthy()
  expect(secondTitle).toBeTruthy()

  await jobs.first().getByRole("button", { name: "Open job" }).tap()
  await expect(employeePage).toHaveURL(/\/dashboard\/jobs\?job=\d+$/)
  await expect(
    employeePage.getByRole("dialog", { name: firstTitle! })
  ).toBeVisible()

  await employeePage.keyboard.press("Escape")
  await expect(employeePage).toHaveURL(/\/dashboard\/jobs$/)
  await jobs.nth(1).getByRole("button", { name: "Open job" }).tap()
  await expect(
    employeePage.getByRole("dialog", { name: secondTitle! })
  ).toBeVisible()

  await employeePage.keyboard.press("Escape")
  await expect(employeePage).toHaveURL(/\/dashboard\/jobs$/)
  await jobs.first().getByRole("button", { name: "Open job" }).tap()
  await expect(
    employeePage.getByRole("dialog", { name: firstTitle! })
  ).toBeVisible()
})

test("sidebar and breadcrumb reflect the current page", async ({
  ownerPage,
}, testInfo) => {
  await ownerPage.goto("/dashboard/employees")
  await ownerPage.waitForLoadState("networkidle")

  if (testInfo.project.name.includes("mobile")) {
    await ownerPage.getByRole("button", { name: "Toggle navigation" }).click()
  }

  const sidebar = ownerPage.locator('[data-sidebar="sidebar"]')
  const dashboardLink = sidebar.getByRole("link", { name: "Dashboard" })
  const employeesLink = sidebar.getByRole("link", { name: "Employees" })
  await expect(employeesLink).toHaveAttribute("aria-current", "page")
  await expect(dashboardLink).not.toHaveAttribute("aria-current", "page")

  if (testInfo.project.name.includes("mobile")) {
    await ownerPage.getByRole("button", { name: "Close navigation" }).click()
  }

  const breadcrumb = ownerPage.getByRole("navigation", {
    name: "breadcrumb",
  })
  await expect(
    breadcrumb.getByRole("link", { name: "Dashboard" })
  ).toBeVisible()
  await expect(breadcrumb.getByText("Employees", { exact: true })).toBeVisible()
})

test("profile header contains logout", async ({ ownerPage }, testInfo) => {
  await ownerPage.goto("/dashboard")
  if (testInfo.project.name.includes("mobile")) {
    await ownerPage.getByRole("button", { name: "Toggle navigation" }).click()
  }
  await ownerPage.getByRole("link", { name: /Olivia Owner/ }).click()
  await ownerPage.getByRole("button", { name: "Log out" }).click()
  await expect(ownerPage).toHaveURL(/\/login$/)
})

test("sidebar theme toggle switches the active theme", async ({
  ownerPage,
}, testInfo) => {
  const hydrationErrors: string[] = []
  ownerPage.on("console", (message) => {
    if (
      message.type() === "error" &&
      /hydration|script tag while rendering React component/i.test(
        message.text()
      )
    ) {
      hydrationErrors.push(message.text())
    }
  })
  await ownerPage.goto("/dashboard")
  await ownerPage.waitForLoadState("networkidle")
  if (testInfo.project.name.includes("mobile")) {
    await ownerPage.getByRole("button", { name: "Toggle navigation" }).click()
  }
  const toggle = ownerPage.getByRole("button", { name: "Toggle theme" })
  await expect(toggle).toHaveClass(/shadow-/)
  const html = ownerPage.locator("html")
  const initiallyDark = await html.evaluate((element) =>
    element.classList.contains("dark")
  )
  await toggle.click()
  await expect
    .poll(() => html.evaluate((element) => element.classList.contains("dark")))
    .toBe(!initiallyDark)
  expect(hydrationErrors).toEqual([])
})

test("employee receives only their application shell", async ({
  employeePage,
}, testInfo) => {
  await employeePage.goto("/dashboard")

  await expect(
    employeePage.getByRole("heading", { name: "Hi, Alex Employee" })
  ).toBeVisible()
  await expect(employeePage.getByText("Assigned work")).toBeVisible()
  await expect(
    employeePage.getByRole("link", { name: "Employees" })
  ).toHaveCount(0)
  if (testInfo.project.name.includes("mobile")) {
    await employeePage
      .getByRole("button", { name: "Toggle navigation" })
      .click()
  }
  await expect(employeePage.getByRole("link", { name: "Jobs" })).toBeVisible()
})

test("signed-in users are redirected from root and login", async ({
  ownerPage,
}) => {
  await ownerPage.goto("/")
  await expect(ownerPage).toHaveURL(/\/dashboard$/)

  await ownerPage.goto("/login")
  await expect(ownerPage).toHaveURL(/\/dashboard$/)
})

test("inactive users receive a safe recovery screen", async ({
  inactivePage,
}) => {
  await inactivePage.goto("/dashboard")

  await expect(inactivePage).toHaveURL(/\/login\?reason=inactive$/)
  await expect(inactivePage.getByText(/access is unavailable/i)).toBeVisible()
})
