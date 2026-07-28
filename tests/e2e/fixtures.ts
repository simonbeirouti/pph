import { createServerClient } from "@supabase/ssr"
import { createClient } from "@supabase/supabase-js"
import {
  test as base,
  expect,
  type BrowserContext,
  type Page,
} from "@playwright/test"

type RoleFixtures = {
  employeePage: Page
  inactivePage: Page
  managerPage: Page
  ownerPage: Page
}

const password = "Password123!"

export async function authenticate(
  context: BrowserContext,
  email: string
): Promise<void> {
  const cookies: { name: string; value: string }[] = []
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => cookies,
        setAll: (nextCookies) => {
          cookies.splice(
            0,
            cookies.length,
            ...nextCookies.map(({ name, value }) => ({ name, value }))
          )
        },
      },
    }
  )

  const { error } = await supabase.auth.signInWithPassword({ email, password })
  expect(error, `authenticate ${email}`).toBeNull()

  await context.addCookies(
    cookies.map(({ name, value }) => ({
      name,
      url: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:4000",
      value,
    }))
  )
}

export const test = base.extend<RoleFixtures>({
  ownerPage: async ({ context, page }, provide) => {
    await authenticate(context, "owner@example.test")
    await provide(page)
  },
  employeePage: async ({ context, page }, provide) => {
    await authenticate(context, "employee@example.test")
    await provide(page)
  },
  inactivePage: async ({ context, page }, provide) => {
    await authenticate(context, "inactive@example.test")
    await provide(page)
  },
  managerPage: async ({ context, page }, provide) => {
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )
    const email = `manager-${Date.now()}@example.test`
    const { data: authData, error: authError } =
      await admin.auth.admin.createUser({
        email,
        email_confirm: true,
        password,
      })
    expect(authError).toBeNull()
    const { data: membership, error: membershipError } = await admin
      .from("memberships")
      .insert({
        activated_at: new Date().toISOString(),
        email,
        organisation_id: 1001,
        role: "manager",
        status: "active",
        user_id: authData.user!.id,
      })
      .select("id")
      .single()
    expect(membershipError).toBeNull()
    const membershipId = membership!.id
    const { error: profileError } = await admin
      .from("employee_profiles")
      .insert({
        first_name: "Morgan",
        job_title: "Operations Manager",
        last_name: "Manager",
        membership_id: membershipId,
        organisation_id: 1001,
        phone: "0400 777 777",
      })
    expect(profileError).toBeNull()
    const { data: job, error: jobError } = await admin
      .from("jobs")
      .insert({
        assignee_membership_id: membershipId,
        created_by: 1101,
        organisation_id: 1001,
        status: "assigned",
        title: "Manager personal work",
      })
      .select("id")
      .single()
    expect(jobError).toBeNull()

    await authenticate(context, email)
    await provide(page)

    await admin.from("job_updates").delete().eq("job_id", job!.id)
    await admin.from("jobs").delete().eq("id", job!.id)
    await admin
      .from("employee_profiles")
      .delete()
      .eq("membership_id", membershipId)
    await admin.from("memberships").delete().eq("id", membershipId)
    await admin.auth.admin.deleteUser(authData.user!.id)
  },
})

export { expect }
