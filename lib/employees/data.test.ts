import { describe, expect, it } from "vitest"

import { createAvatarUrl } from "@/lib/employees/avatar"
import {
  isRosterAssignableEmployee,
  toActiveEmployeeOption,
} from "@/lib/employees/data"

describe("active employee options", () => {
  it("uses a stable authenticated application URL for stored avatars", () => {
    expect(createAvatarUrl(1103, "1001/1103/avatar.png")).toBe(
      "/api/avatars/1103"
    )
    expect(createAvatarUrl(1103, null)).toBeNull()
  })

  it("publishes only the stable server-side option contract", () => {
    expect(
      toActiveEmployeeOption({
        avatarPath: "1001/1103/avatar.png",
        displayName: "Alex Employee",
        jobTitle: "Operator",
        membershipId: 1103,
      })
    ).toEqual({
      avatarPath: "1001/1103/avatar.png",
      displayName: "Alex Employee",
      employeeMembershipId: 1103,
      jobTitle: "Operator",
    })
  })

  it("only exposes employee-role members to roster assignment", () => {
    expect(isRosterAssignableEmployee({ role: "employee" })).toBe(true)
    expect(isRosterAssignableEmployee({ role: "manager" })).toBe(false)
    expect(isRosterAssignableEmployee({ role: "owner" })).toBe(false)
  })
})
