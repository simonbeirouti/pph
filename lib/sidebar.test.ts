import { describe, expect, it } from "vitest"

import { readSidebarOpenCookie, readSidebarOpenValue } from "@/lib/sidebar"

describe("readSidebarOpenCookie", () => {
  it("reads a collapsed sidebar preference among other cookies", () => {
    expect(
      readSidebarOpenCookie("session=abc; sidebar_state=false; theme=dark")
    ).toBe(false)
  })

  it("reads an expanded sidebar preference", () => {
    expect(readSidebarOpenCookie("sidebar_state=true")).toBe(true)
  })

  it("ignores missing and invalid preferences", () => {
    expect(readSidebarOpenCookie("session=abc")).toBeNull()
    expect(readSidebarOpenCookie("sidebar_state=invalid")).toBeNull()
  })

  it("reads the browser-storage representation", () => {
    expect(readSidebarOpenValue("false")).toBe(false)
    expect(readSidebarOpenValue("true")).toBe(true)
    expect(readSidebarOpenValue(null)).toBeNull()
  })
})
