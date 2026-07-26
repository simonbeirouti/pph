import { createClient } from "@supabase/supabase-js"
import type { APIRequestContext, Browser } from "@playwright/test"

import { expect, test } from "./fixtures"

type MailpitMessage = {
  ID: string
  To: Array<{ Address: string }>
}

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}

async function capturedInviteLink(
  request: APIRequestContext,
  email: string
): Promise<string> {
  let messageId: string | undefined
  await expect
    .poll(
      async () => {
        const response = await request.get(
          "http://127.0.0.1:54324/api/v1/messages"
        )
        const body = (await response.json()) as {
          messages: MailpitMessage[]
        }
        messageId = body.messages.find((message) =>
          message.To.some(
            (recipient) => recipient.Address.toLowerCase() === email
          )
        )?.ID
        return Boolean(messageId)
      },
      { timeout: 15_000 }
    )
    .toBe(true)

  const response = await request.get(
    `http://127.0.0.1:54324/api/v1/message/${messageId}`
  )
  const message = (await response.json()) as { HTML: string }
  const match = message.HTML.match(/href="([^"]+)"/)
  if (!match) throw new Error(`Captured invitation for ${email} had no link`)
  return match[1].replaceAll("&amp;", "&")
}

async function cleanupEmployee(email: string) {
  const admin = adminClient()
  const { data: membership } = await admin
    .from("memberships")
    .select("id, employee_profiles(id, avatar_path)")
    .eq("email", email)
    .maybeSingle()

  if (membership) {
    const profiles = membership.employee_profiles ?? []
    const avatarPaths = profiles
      .map((profile) => profile.avatar_path)
      .filter((path): path is string => Boolean(path))
    if (avatarPaths.length) {
      await admin.storage.from("avatars").remove(avatarPaths)
    }
    await admin
      .from("employee_profiles")
      .delete()
      .eq("membership_id", membership.id)
    await admin.from("memberships").delete().eq("id", membership.id)
  }

  const {
    data: { users },
  } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const user = users.find((candidate) => candidate.email === email)
  if (user) await admin.auth.admin.deleteUser(user.id)
}

async function signIn(browser: Browser, email: string, password: string) {
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.goto("/login")
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password").fill(password)
  await page.getByRole("button", { name: "Sign in" }).click()
  return { context, page }
}

test("credential login succeeds and failures remain generic", async ({
  page,
}) => {
  await page.goto("/login")
  await page.getByLabel("Email").fill("owner@example.test")
  await page.getByLabel("Password").fill("wrong-password")
  await page.getByRole("button", { name: "Sign in" }).click()
  await expect(
    page.getByText("Unable to sign in with those credentials.")
  ).toBeVisible()

  await page.getByLabel("Password").fill("Password123!")
  await page.getByRole("button", { name: "Sign in" }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
})

test("employee cannot access the owner directory", async ({ employeePage }) => {
  const response = await employeePage.goto("/dashboard/employees")
  expect(response?.status()).toBe(404)
})

test("owner opens employee details in a sheet without navigation", async ({
  ownerPage,
}) => {
  await ownerPage.goto("/dashboard/employees")
  await ownerPage.waitForLoadState("networkidle")
  const alexRow = ownerPage.getByRole("row", {
    name: "Open Alex Employee details",
  })
  await alexRow.getByRole("cell", { name: "Operator" }).click()

  await expect(ownerPage).toHaveURL(/\/dashboard\/employees$/)
  const sheet = ownerPage.getByRole("dialog")
  await expect(sheet).toBeVisible()
  await expect(sheet.getByText("Alex Employee", { exact: true })).toBeVisible()
  await expect(
    sheet.getByRole("button", {
      name: "Change Alex Employee profile photo",
    })
  ).toBeVisible()
  await expect(sheet.getByRole("link", { name: "Email" })).toHaveAttribute(
    "href",
    "mailto:employee@example.test"
  )
  await expect(sheet.getByRole("link", { name: "Call" })).toHaveAttribute(
    "href",
    "tel:0400000002"
  )
  await expect(
    sheet.getByRole("button", { name: "Deactivate access" })
  ).toBeVisible()
  await expect(
    sheet.getByRole("button", { name: "Save profile" })
  ).not.toBeVisible()
  const fileChooserPromise = ownerPage.waitForEvent("filechooser")
  await sheet
    .getByRole("button", { name: "Change Alex Employee profile photo" })
    .click()
  const fileChooser = await fileChooserPromise
  await fileChooser.setFiles({
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      "base64"
    ),
    mimeType: "image/png",
    name: "alex.png",
  })
  await expect(sheet.getByRole("button", { name: "Save profile" })).toBeVisible()
  await expect(
    sheet.getByRole("img", { name: "Alex Employee profile photo" })
  ).toBeVisible()
  await expect(
    sheet.getByRole("button", { name: "Deactivate access" })
  ).toHaveClass(/w-full/)
  await sheet.getByRole("button", { name: "Deactivate access" }).click()
  const deactivateDialog = ownerPage.getByRole("alertdialog")
  await expect(
    deactivateDialog.getByText("Deactivate Alex Employee?", { exact: true })
  ).toBeVisible()
  await deactivateDialog.getByRole("button", { name: "Cancel" }).click()

  await sheet.getByRole("button", { name: "Close" }).click()
  await ownerPage
    .getByRole("row", { name: "Open Indie Invited details" })
    .click()
  const invitedSheet = ownerPage.getByRole("dialog")
  await expect(
    invitedSheet.getByRole("button", { name: "Resend invitation" })
  ).toBeVisible()
  await expect(
    invitedSheet.getByRole("button", { name: "Delete employee" })
  ).toBeVisible()
  await invitedSheet.getByRole("button", { name: "Delete employee" }).click()
  const deleteDialog = ownerPage.getByRole("alertdialog")
  await expect(
    deleteDialog.getByText("Delete Indie Invited?", { exact: true })
  ).toBeVisible()
  await deleteDialog.getByRole("button", { name: "Cancel" }).click()
})

test("employee opens their own editable profile from the sidebar", async ({
  employeePage,
}) => {
  await employeePage.goto("/dashboard/profile")
  await expect(
    employeePage.getByRole("heading", { name: "Alex Employee" })
  ).toBeVisible()
  await expect(employeePage.getByLabel("First name")).toHaveValue("Alex")
  await expect(
    employeePage.getByRole("button", { name: "Save profile" })
  ).toBeVisible()
})

test("owner can edit their own profile", async ({ ownerPage }) => {
  await ownerPage.goto("/dashboard/profile")
  await expect(ownerPage.getByLabel("First name")).toHaveValue("Olivia")
  await expect(ownerPage.getByLabel("Job title")).toHaveValue("Owner")
  await expect(
    ownerPage.getByRole("button", { name: "Save profile" })
  ).toBeVisible()
})

test("employee form preserves values after server validation", async ({
  ownerPage,
}) => {
  await ownerPage.goto("/dashboard/employees")
  await ownerPage.getByRole("button", { name: "Add employee" }).click()
  await ownerPage.getByLabel("First name").fill("Preserved")
  await ownerPage.getByLabel("Last name").fill("Values")
  await ownerPage.getByLabel("Email").fill("preserved@example.test")
  await ownerPage.getByLabel("Phone").fill(" ")
  await ownerPage.getByLabel("Job title").fill("Operator")
  await ownerPage.getByRole("button", { name: "Create and invite" }).click()

  await expect(ownerPage.getByText("Enter a phone number.")).toBeVisible()
  await expect(ownerPage.getByLabel("First name")).toHaveValue("Preserved")
  await expect(ownerPage.getByLabel("Email")).toHaveValue(
    "preserved@example.test"
  )
})

test("owner completes invitation, avatar, activation, and access lifecycle", async ({
  browser,
  ownerPage,
  request,
}, testInfo) => {
  test.setTimeout(90_000)

  const suffix = `${testInfo.project.name.replaceAll(/[^a-z0-9]/gi, "-")}-${Date.now()}`
  const email = `s02-${suffix}@example.test`
  const password = "Activated123!"

  try {
    await ownerPage.goto("/dashboard/employees")
    await ownerPage.getByRole("button", { name: "Add employee" }).click()
    await ownerPage.getByLabel("First name").fill("Jamie")
    await ownerPage.getByLabel("Last name").fill("Lifecycle")
    await ownerPage.getByLabel("Email").fill(email)
    await ownerPage.getByLabel("Phone").fill("0400 555 010")
    await ownerPage.getByLabel("Job title").fill("Operations Assistant")
    await ownerPage.getByLabel("Profile photo").setInputFiles({
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
        "base64"
      ),
      mimeType: "image/png",
      name: "avatar.png",
    })
    await ownerPage.getByRole("button", { name: "Create and invite" }).click()
    await expect(
      ownerPage.getByText("Employee created and invitation sent.")
    ).toBeVisible()

    const inviteLink = await capturedInviteLink(request, email)
    expect(inviteLink).toContain("/auth/confirm")
    expect(inviteLink).toContain("type=invite")

    const inviteContext = await browser.newContext()
    const invitePage = await inviteContext.newPage()
    await invitePage.goto(inviteLink)
    await expect(invitePage).toHaveURL(/\/set-password$/)
    await expect(
      invitePage.getByRole("heading", { name: "Set your password" })
    ).toBeVisible()

    await invitePage.getByLabel("Password", { exact: true }).fill(password)
    await invitePage.getByLabel("Confirm password").fill("Different123!")
    await invitePage.getByRole("button", { name: "Activate account" }).click()
    await expect(invitePage.getByText("Passwords do not match.")).toBeVisible()

    await invitePage.getByLabel("Password", { exact: true }).fill(password)
    await invitePage.getByLabel("Confirm password").fill(password)
    await invitePage.getByRole("button", { name: "Activate account" }).click()
    await expect(invitePage).toHaveURL(/\/dashboard$/)
    await expect(
      invitePage.getByRole("heading", { name: "Welcome, Jamie Lifecycle" })
    ).toBeVisible()

    await ownerPage.getByRole("button", { name: "Close" }).click()
    await ownerPage.reload()
    await ownerPage
      .getByRole("row", { name: "Open Jamie Lifecycle details" })
      .click()
    await expect(
      ownerPage.getByRole("dialog").getByText("Jamie Lifecycle", { exact: true })
    ).toBeVisible()
    await expect(
      ownerPage.getByRole("img", {
        name: "Jamie Lifecycle profile photo",
      })
    ).toBeVisible()
    await ownerPage
      .getByRole("dialog")
      .getByRole("button", { name: "Deactivate access" })
      .click()
    await expect(
      ownerPage
        .getByRole("dialog")
        .getByRole("button", { name: "Reactivate access" })
    ).toBeVisible()

    await invitePage.goto("/dashboard")
    await expect(invitePage).toHaveURL(/\/login\?reason=inactive$/)

    await ownerPage
      .getByRole("dialog")
      .getByRole("button", { name: "Reactivate access" })
      .click()
    await expect(
      ownerPage
        .getByRole("dialog")
        .getByRole("button", { name: "Deactivate access" })
    ).toBeVisible()

    const relogin = await signIn(browser, email, password)
    await expect(relogin.page).toHaveURL(/\/dashboard$/)
    await relogin.context.close()
    await inviteContext.close()
  } finally {
    await cleanupEmployee(email)
  }
})
