import { createServerClient } from "@supabase/ssr"
import { type NextRequest, NextResponse } from "next/server"

import type { Database } from "@/lib/supabase/database.types"
import { getSupabasePublicConfig } from "@/lib/supabase/public-env"

export const PROTECTED_ROUTE_PREFIX = "/dashboard"
export const INACTIVE_LOGIN_REASON = "inactive"

function copyResponseCookies(source: NextResponse, target: NextResponse) {
  for (const cookie of source.cookies.getAll()) {
    target.cookies.set(cookie)
  }

  return target
}

export function resolveOptimisticRedirect(
  request: NextRequest,
  isSignedIn: boolean
): URL | null {
  const { pathname, searchParams } = request.nextUrl
  const isInactiveRecovery =
    pathname === "/login" &&
    searchParams.get("reason") === INACTIVE_LOGIN_REASON

  if (!isSignedIn && pathname.startsWith(PROTECTED_ROUTE_PREFIX)) {
    return new URL("/login", request.url)
  }

  if (
    isSignedIn &&
    (pathname === "/" || (pathname === "/login" && !isInactiveRecovery))
  ) {
    return new URL("/dashboard", request.url)
  }

  return null
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })
  const { publishableKey, url } = getSupabasePublicConfig()

  const supabase = createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value)
        }

        response = NextResponse.next({ request })

        for (const { name, options, value } of cookiesToSet) {
          response.cookies.set(name, value, options)
        }
      },
    },
  })

  const { data, error } = await supabase.auth.getUser()
  const redirectUrl = resolveOptimisticRedirect(
    request,
    !error && Boolean(data.user)
  )

  if (!redirectUrl) return response

  return copyResponseCookies(response, NextResponse.redirect(redirectUrl))
}
