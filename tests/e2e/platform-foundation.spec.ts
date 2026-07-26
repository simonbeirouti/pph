import { test, expect } from "./fixtures"

test("signed-out dashboard requests redirect to login", async ({ page }) => {
  await page.goto("/dashboard")

  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible()
})

test("owner receives the owner application shell", async ({ ownerPage }) => {
  await ownerPage.goto("/dashboard")

  await expect(
    ownerPage.getByRole("heading", { name: "Welcome, owner" })
  ).toBeVisible()
  await expect(ownerPage.getByText("Harbour Operations").first()).toBeVisible()
  const dashboardLink = ownerPage.getByRole("link", { name: "Dashboard" })
  if (!(await dashboardLink.isVisible())) {
    await ownerPage.getByRole("button", { name: "Toggle navigation" }).click()
  }
  await expect(dashboardLink).toBeVisible()
})

test("employee receives only their application shell", async ({
  employeePage,
}) => {
  await employeePage.goto("/dashboard")

  await expect(
    employeePage.getByRole("heading", { name: "Welcome, Alex Employee" })
  ).toBeVisible()
  await expect(employeePage.getByText("employee", { exact: true }).first()).toBeVisible()
  await expect(
    employeePage.getByRole("link", { name: "Employees" })
  ).toHaveCount(0)
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
