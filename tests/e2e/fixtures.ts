import { createServerClient } from "@supabase/ssr"
import {
  test as base,
  expect,
  type BrowserContext,
  type Page,
} from "@playwright/test"

type RoleFixtures = {
  employeePage: Page
  inactivePage: Page
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
})

export { expect }
