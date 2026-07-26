import { describe, expect, it } from "vitest"

import { toActiveEmployeeOption } from "@/lib/employees/data"

describe("active employee options", () => {
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
})
