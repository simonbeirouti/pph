// @vitest-environment node

import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { resolveOptimisticRedirect, updateSession } from "@/lib/supabase/proxy"

const { getUser } = vi.hoisted(() => ({ getUser: vi.fn() }))

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({ auth: { getUser } })),
}))
vi.mock("@/lib/supabase/public-env", () => ({
  getSupabasePublicConfig: () => ({
    publishableKey: "test-key",
    url: "http://127.0.0.1:54321",
  }),
}))

function request(pathname: string) {
  return new NextRequest(new URL(pathname, "http://127.0.0.1:4000"))
}

describe("resolveOptimisticRedirect", () => {
  beforeEach(() => vi.clearAllMocks())

  it("redirects a signed-out dashboard request to login", () => {
    expect(
      resolveOptimisticRedirect(request("/dashboard/jobs"), false)?.pathname
    ).toBe("/login")
  })

  it("redirects a revoked live-session check even while cookies remain", async () => {
    getUser.mockResolvedValue({
      data: { user: null },
      error: new Error("Session not found"),
    })

    const response = await updateSession(request("/dashboard/jobs"))

    expect(getUser).toHaveBeenCalledOnce()
    expect(new URL(response.headers.get("location")!).pathname).toBe("/login")
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
    expect(
      resolveOptimisticRedirect(request("/auth/confirm"), false)
    ).toBeNull()
    expect(resolveOptimisticRedirect(request("/set-password"), true)).toBeNull()
    expect(
      resolveOptimisticRedirect(request("/reset-password"), true)
    ).toBeNull()
    expect(
      resolveOptimisticRedirect(request("/login?reason=inactive"), true)
    ).toBeNull()
  })
})
