// @vitest-environment node

import { describe, expect, it } from "vitest"

import {
  parseSupabasePublicConfig,
  resolveBrowserSupabaseUrl,
} from "@/lib/supabase/public-env"

describe("parseSupabasePublicConfig", () => {
  it("returns a valid public configuration", () => {
    expect(
      parseSupabasePublicConfig({
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
      })
    ).toEqual({
      publishableKey: "sb_publishable_test",
      url: "http://127.0.0.1:54321",
    })
  })

  it("fails without exposing provided values", () => {
    expect(() =>
      parseSupabasePublicConfig({
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sensitive-value",
        NEXT_PUBLIC_SUPABASE_URL: "not-a-url",
      })
    ).toThrow("Invalid public Supabase configuration")

    try {
      parseSupabasePublicConfig({
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sensitive-value",
        NEXT_PUBLIC_SUPABASE_URL: "not-a-url",
      })
    } catch (error) {
      expect(String(error)).not.toContain("sensitive-value")
    }
  })
})

describe("resolveBrowserSupabaseUrl", () => {
  it("uses the page host for a loopback Supabase URL during LAN development", () => {
    expect(
      resolveBrowserSupabaseUrl(
        "http://127.0.0.1:54321",
        "172.16.11.247",
        "development"
      )
    ).toBe("http://172.16.11.247:54321")
  })

  it("does not rewrite production or already remote Supabase URLs", () => {
    expect(
      resolveBrowserSupabaseUrl(
        "https://project.supabase.co",
        "172.16.11.247",
        "development"
      )
    ).toBe("https://project.supabase.co")
    expect(
      resolveBrowserSupabaseUrl(
        "http://127.0.0.1:54321",
        "app.example.com",
        "production"
      )
    ).toBe("http://127.0.0.1:54321")
  })
})
