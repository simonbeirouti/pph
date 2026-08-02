import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

export async function getInvitedMembershipForCurrentUser() {
  const supabase = await createClient()
  const { data: userData, error: userError } = await supabase.auth.getUser()
  const userId = userData.user?.id
  if (userError || !userId) return null

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("memberships")
    .select("id, email")
    .eq("user_id", userId)
    .eq("status", "invited")
    .maybeSingle()
  if (error) throw new Error("Unable to resolve invitation")
  return data
}
