import "server-only"

import { createClient as createSupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/supabase/database.types"
import { getSupabasePublicConfig } from "@/lib/supabase/public-env"
import { getSupabaseSecretKey } from "@/lib/supabase/server-env"

export function createAdminClient() {
  const { url } = getSupabasePublicConfig()

  return createSupabaseClient<Database>(url, getSupabaseSecretKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
