"use client"

import { createBrowserClient } from "@supabase/ssr"

import type { Database } from "@/lib/supabase/database.types"
import { getSupabasePublicConfig } from "@/lib/supabase/public-env"

export function createClient() {
  const { publishableKey, url } = getSupabasePublicConfig()

  return createBrowserClient<Database>(url, publishableKey)
}
