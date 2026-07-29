"use client"

import { createBrowserClient } from "@supabase/ssr"

import type { Database } from "@/lib/supabase/database.types"
import { getBrowserSupabasePublicConfig } from "@/lib/supabase/public-env"

export function createClient() {
  const { publishableKey, url } = getBrowserSupabasePublicConfig()

  return createBrowserClient<Database>(url, publishableKey)
}
