import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

import type { Database } from "@/lib/supabase/database.types"
import { getSupabasePublicConfig } from "@/lib/supabase/public-env"

export async function createClient() {
  const { publishableKey, url } = getSupabasePublicConfig()
  const cookieStore = await cookies()

  return createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, options, value } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        } catch {
          // Server Components cannot set response cookies. Proxy refreshes them.
        }
      },
    },
  })
}
