import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

describe("offline dashboard service worker", () => {
  const source = readFileSync(join(process.cwd(), "public/sw.js"), "utf8")

  it("falls back every dashboard navigation to the public shell", () => {
    expect(source).toContain('url.pathname === "/dashboard"')
    expect(source).toContain('url.pathname.startsWith("/dashboard/")')
    expect(source).toContain("cache.match(DASHBOARD_SHELL_URL")
  })

  it("does not cache authenticated API or Supabase responses", () => {
    expect(source).not.toMatch(/cache\.put\([^)]*api\//u)
    expect(source).not.toContain("/api/offline")
    expect(source).not.toContain("/rest/v1")
  })

  it("rotates the versioned dashboard shell cache", () => {
    expect(source).toContain('const SHELL_CACHE = "pph-dashboard-shell-v8"')
    expect(source).toContain('const DASHBOARD_SHELL_URL = "/offline"')
  })
})
