import { getMembershipContext } from "@/lib/auth/membership"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

const PRIVATE_MEDIA_HEADERS = {
  "Cache-Control": "private, no-store",
  Vary: "Cookie",
  "X-Content-Type-Options": "nosniff",
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ membershipId: string }> }
) {
  const { membershipId: rawMembershipId } = await context.params
  const membershipId = Number(rawMembershipId)
  if (!Number.isSafeInteger(membershipId) || membershipId < 1) {
    return new Response(null, { headers: PRIVATE_MEDIA_HEADERS, status: 404 })
  }

  if (!(await getMembershipContext())) {
    return new Response(null, { headers: PRIVATE_MEDIA_HEADERS, status: 401 })
  }

  const supabase = await createClient()
  const { data: profile, error: profileError } = await supabase
    .from("employee_profiles")
    .select("avatar_path")
    .eq("membership_id", membershipId)
    .maybeSingle()

  if (profileError || !profile?.avatar_path) {
    return new Response(null, { headers: PRIVATE_MEDIA_HEADERS, status: 404 })
  }

  const { data: avatar, error: avatarError } = await supabase.storage
    .from("avatars")
    .download(profile.avatar_path)

  if (avatarError) {
    return new Response(null, { headers: PRIVATE_MEDIA_HEADERS, status: 404 })
  }

  return new Response(await avatar.arrayBuffer(), {
    headers: {
      ...PRIVATE_MEDIA_HEADERS,
      "Content-Length": String(avatar.size),
      "Content-Type": avatar.type || "application/octet-stream",
    },
  })
}
