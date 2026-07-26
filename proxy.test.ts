// @vitest-environment node

import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server"
import { describe, expect, it } from "vitest"

import { config } from "@/proxy"

describe("root Proxy matcher", () => {
  it.each([
    "/_next/static/chunk.js",
    "/_next/image?url=%2Favatar.png",
    "/favicon.ico",
    "/avatar.webp",
    "/sw.js",
    "/manifest.webmanifest",
  ])("excludes %s", (url) => {
    expect(
      unstable_doesMiddlewareMatch({ config, nextConfig: {}, url })
    ).toBe(false)
  })

  it.each(["/", "/login", "/auth/confirm", "/set-password", "/dashboard"])(
    "includes %s",
    (url) => {
      expect(
        unstable_doesMiddlewareMatch({ config, nextConfig: {}, url })
      ).toBe(true)
    }
  )
})
