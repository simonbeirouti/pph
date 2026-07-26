// @vitest-environment node

import { NextRequest } from "next/server"
import { describe, expect, it } from "vitest"

import { resolveOptimisticRedirect } from "@/lib/supabase/proxy"

function request(pathname: string) {
  return new NextRequest(new URL(pathname, "http://127.0.0.1:3000"))
}

describe("resolveOptimisticRedirect", () => {
  it("redirects a signed-out dashboard request to login", () => {
    expect(
      resolveOptimisticRedirect(request("/dashboard/jobs"), false)?.pathname
    ).toBe("/login")
  })

  it("redirects signed-in root and login requests to the dashboard", () => {
    expect(resolveOptimisticRedirect(request("/"), true)?.pathname).toBe(
      "/dashboard"
    )
    expect(resolveOptimisticRedirect(request("/login"), true)?.pathname).toBe(
      "/dashboard"
    )
  })

  it("allows public Auth routes and inactive recovery through", () => {
    expect(resolveOptimisticRedirect(request("/auth/confirm"), false)).toBeNull()
    expect(resolveOptimisticRedirect(request("/set-password"), true)).toBeNull()
    expect(
      resolveOptimisticRedirect(request("/login?reason=inactive"), true)
    ).toBeNull()
  })
})
