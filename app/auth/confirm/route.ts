import {
  createClient as createSupabaseClient,
  type EmailOtpType,
} from "@supabase/supabase-js"
import { createServerClient } from "@supabase/ssr"
import { type NextRequest, NextResponse } from "next/server"

import type { Database } from "@/lib/supabase/database.types"
import { getSupabasePublicConfig } from "@/lib/supabase/public-env"

const ACCEPTED_TYPES = new Set<EmailOtpType>(["invite"])

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash")
  const type = request.nextUrl.searchParams.get("type") as EmailOtpType | null
  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host")
  const protocol = request.headers.get("x-forwarded-proto") ?? "http"
  const requestOrigin = host ? `${protocol}://${host}` : request.nextUrl.origin
  const errorUrl = new URL("/auth/confirm/error", requestOrigin)

  if (!tokenHash || !type || !ACCEPTED_TYPES.has(type)) {
    errorUrl.searchParams.set("reason", "invalid")
    return NextResponse.redirect(errorUrl)
  }

  const { publishableKey, url } = getSupabasePublicConfig()
  let response = NextResponse.redirect(new URL("/set-password", requestOrigin))
  const supabase = createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        for (const { name, options, value } of cookiesToSet) {
          response.cookies.set(name, value, options)
        }
      },
    },
  })
  const { data: verification, error: verificationError } =
    await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    })
  if (verificationError || !verification.session) {
    errorUrl.searchParams.set("reason", "verification")
    return NextResponse.redirect(errorUrl)
  }

  const verifiedClient = createSupabaseClient<Database>(url, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: {
      headers: {
        Authorization: `Bearer ${verification.session.access_token}`,
      },
    },
  })
  const { error: linkingError } = await verifiedClient.rpc(
    "link_invited_membership"
  )
  if (linkingError) {
    errorUrl.searchParams.set("reason", "membership")
    response = NextResponse.redirect(errorUrl)
    await supabase.auth.signOut()
    return response
  }

  return response
}
