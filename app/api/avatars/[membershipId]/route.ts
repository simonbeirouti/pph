import { createHash } from "node:crypto"

import { getMembershipContext } from "@/lib/auth/membership"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

const PRIVATE_MEDIA_ERROR_HEADERS = {
  "Cache-Control": "private, no-store",
  Vary: "Cookie",
  "X-Content-Type-Options": "nosniff",
}

const PRIVATE_MEDIA_CACHE_CONTROL = "private, max-age=86400, must-revalidate"

function avatarEtag(avatarPath: string) {
  return `"${createHash("sha256").update(avatarPath).digest("base64url")}"`
}

export async function GET(
  request: Request,
  context: { params: Promise<{ membershipId: string }> }
) {
  const { membershipId: rawMembershipId } = await context.params
  const membershipId = Number(rawMembershipId)
  if (!Number.isSafeInteger(membershipId) || membershipId < 1) {
    return new Response(null, {
      headers: PRIVATE_MEDIA_ERROR_HEADERS,
      status: 404,
    })
  }

  if (!(await getMembershipContext())) {
    return new Response(null, {
      headers: PRIVATE_MEDIA_ERROR_HEADERS,
      status: 401,
    })
  }

  const supabase = await createClient()
  const { data: profile, error: profileError } = await supabase
    .from("employee_profiles")
    .select("avatar_path")
    .eq("membership_id", membershipId)
    .maybeSingle()

  if (profileError || !profile?.avatar_path) {
    return new Response(null, {
      headers: PRIVATE_MEDIA_ERROR_HEADERS,
      status: 404,
    })
  }

  const etag = avatarEtag(profile.avatar_path)
  const cachedHeaders = {
    "Cache-Control": PRIVATE_MEDIA_CACHE_CONTROL,
    ETag: etag,
    Vary: "Cookie",
    "X-Content-Type-Options": "nosniff",
  }
  if (request.headers.get("If-None-Match") === etag) {
    return new Response(null, { headers: cachedHeaders, status: 304 })
  }

  const { data: avatar, error: avatarError } = await supabase.storage
    .from("avatars")
    .download(profile.avatar_path)

  if (avatarError) {
    return new Response(null, {
      headers: PRIVATE_MEDIA_ERROR_HEADERS,
      status: 404,
    })
  }

  return new Response(await avatar.arrayBuffer(), {
    headers: {
      ...cachedHeaders,
      "Content-Length": String(avatar.size),
      "Content-Type": avatar.type || "application/octet-stream",
    },
  })
}
