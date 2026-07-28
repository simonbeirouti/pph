import { expect, test } from "./fixtures"

test("owner role editing keeps the selector with profile details and save above access actions", async ({
  ownerPage,
}) => {
  await ownerPage.goto("/dashboard/employees")
  await ownerPage
    .getByRole("row", { name: "Open Indie Invited details" })
    .click()

  const sheet = ownerPage.getByRole("dialog")
  const email = sheet.getByRole("button", { name: "Email" })
  const roleSelector = sheet.getByRole("combobox", {
    name: "Role for Indie Invited",
  })
  await expect(roleSelector).toContainText("Employee")
  await expect(
    sheet.getByRole("button", { name: "Save changes" })
  ).not.toBeVisible()

  const emailBox = await email.boundingBox()
  const roleBox = await roleSelector.boundingBox()
  expect(emailBox).not.toBeNull()
  expect(roleBox).not.toBeNull()
  expect(roleBox!.y).toBeGreaterThan(emailBox!.y + emailBox!.height)
  expect(roleBox!.width).toBeGreaterThan(emailBox!.width * 1.8)

  await roleSelector.click()
  await ownerPage.getByRole("option", { name: "Manager" }).click()
  await expect(roleSelector).toContainText("Manager")

  const saveChanges = sheet.getByRole("button", { name: "Save changes" })
  const deleteEmployee = sheet.getByRole("button", {
    name: "Delete employee",
  })
  await expect(saveChanges).toBeVisible()
  await expect(deleteEmployee).toBeVisible()
  const saveBox = await saveChanges.boundingBox()
  const deleteBox = await deleteEmployee.boundingBox()
  expect(saveBox).not.toBeNull()
  expect(deleteBox).not.toBeNull()
  expect(saveBox!.y).toBeLessThan(deleteBox!.y)
})

test("manager receives operations and personal assigned-work experiences", async ({
  managerPage,
}) => {
  await managerPage.goto("/dashboard")
  await expect(
    managerPage.getByRole("heading", { name: "Good day, Morgan Manager" })
  ).toBeVisible()
  await expect(
    managerPage.getByRole("button", { name: "View my work" })
  ).toBeVisible()

  const templatesLink = managerPage.getByRole("link", { name: "Templates" })
  if (!(await templatesLink.isVisible())) {
    await managerPage.getByRole("button", { name: "Toggle navigation" }).click()
  }
  await expect(templatesLink).toBeVisible()
  await expect(
    managerPage.getByRole("link", { name: "Employees" })
  ).toBeVisible()

  await managerPage.goto("/dashboard/jobs?mode=my-work")
  await expect(
    managerPage.getByRole("heading", { name: "Jobs" })
  ).toBeVisible()
  await expect(
    managerPage
      .getByRole("article", { name: "Job Manager personal work" })
      .first()
  ).toBeVisible()
  await expect(
    managerPage.getByRole("button", { name: "Team workflow" })
  ).toBeVisible()

  await managerPage.goto("/dashboard/employees")
  await managerPage.getByRole("button", { name: "Add employee" }).click()
  const dialog = managerPage.getByRole("dialog")
  await expect(dialog.getByLabel("Role")).toHaveValue("Employee")
  await expect(dialog.locator('input[name="role"]')).toHaveValue("employee")
  await dialog.getByRole("button", { name: "Close" }).click()

  await managerPage
    .getByRole("row", { name: "Open Olivia Owner details" })
    .click()
  const ownerSheet = managerPage.getByRole("dialog")
  await expect(
    ownerSheet.getByRole("combobox", { name: "Role for Olivia Owner" })
  ).not.toBeVisible()
  await expect(
    ownerSheet.getByRole("button", { name: "Deactivate access" })
  ).not.toBeVisible()
})
