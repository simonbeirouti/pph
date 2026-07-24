"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";
import { getSupabasePublicConfig } from "./env";

export function createClient() {
  const { publishableKey, url } = getSupabasePublicConfig();

  return createBrowserClient<Database>(url, publishableKey);
}
