// @vitest-environment node

import { describe, expect, it } from "vitest"

import { mapMembershipContext } from "@/lib/auth/membership"

describe("mapMembershipContext", () => {
  it("maps an employee profile into the public session boundary", () => {
    expect(
      mapMembershipContext("user-id", {
        email: "employee@example.test",
        employee_profiles: [
          {
            avatar_path: null,
            first_name: "Alex",
            last_name: "Employee",
          },
        ],
        id: 1103,
        organisation_id: 1001,
        organisations: {
          id: 1001,
          name: "Harbour Operations",
          timezone: "Australia/Melbourne",
        },
        role: "employee",
        status: "active",
      })
    ).toEqual({
      avatarPath: null,
      displayName: "Alex Employee",
      email: "employee@example.test",
      membershipId: 1103,
      organisationId: 1001,
      organisationName: "Harbour Operations",
      role: "employee",
      status: "active",
      timezone: "Australia/Melbourne",
      userId: "user-id",
    })
  })

  it("uses the email prefix when a membership has no employee profile", () => {
    const context = mapMembershipContext("owner-id", {
      email: "owner@example.test",
      employee_profiles: [],
      id: 1101,
      organisation_id: 1001,
      organisations: [
        {
          id: 1001,
          name: "Harbour Operations",
          timezone: "Australia/Melbourne",
        },
      ],
      role: "owner",
      status: "active",
    })

    expect(context.displayName).toBe("owner")
  })
})
