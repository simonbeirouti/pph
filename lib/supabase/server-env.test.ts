// @vitest-environment node

import { describe, expect, it } from "vitest"

import { parseSupabaseSecretKey } from "@/lib/supabase/server-env"

describe("parseSupabaseSecretKey", () => {
  it("returns a configured server-only key", () => {
    expect(
      parseSupabaseSecretKey({ SUPABASE_SECRET_KEY: "sb_secret_test" })
    ).toBe("sb_secret_test")
  })

  it("uses a non-secret error when the key is absent", () => {
    expect(() => parseSupabaseSecretKey({})).toThrow(
      "Invalid server Supabase configuration: secret key is missing"
    )
  })
})
