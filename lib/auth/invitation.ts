import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

export async function getInvitedMembershipForCurrentUser() {
  const supabase = await createClient()
  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims()
  const userId = claimsData?.claims.sub
  if (claimsError || !userId) return null

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("memberships")
    .select("id, email")
    .eq("user_id", userId)
    .eq("role", "employee")
    .eq("status", "invited")
    .maybeSingle()
  if (error) throw new Error("Unable to resolve invitation")
  return data
}
