import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { getSupabasePublicConfig, getSupabaseSecretKey } from "./env";

export function createAdminClient() {
  const secretKey = getSupabaseSecretKey();

  if (!secretKey) {
    return null;
  }

  const { url } = getSupabasePublicConfig();

  return createClient<Database>(url, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
