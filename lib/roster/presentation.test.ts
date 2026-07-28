import { describe, expect, it } from "vitest"

import {
  buildEmployeeRosterLanes,
  colourForEmployee,
} from "@/lib/roster/presentation"
import type { RosterShift } from "@/lib/roster/types"

const shift = (
  id: number,
  employeeMembershipId: number,
  startsAt: string
): RosterShift => ({
  archivedAt: null,
  createdAt: startsAt,
  createdByMembershipId: 1,
  employeeMembershipId,
  endsAt: new Date(new Date(startsAt).getTime() + 60 * 60 * 1000).toISOString(),
  id,
  lockedAt: null,
  lockedByMembershipId: null,
  notes: "",
  organisationId: 1,
  startsAt,
  updatedAt: startsAt,
})

describe("roster presentation", () => {
  const employees = [
    {
      avatarPath: null,
      displayName: "Zoe Worker",
      employeeMembershipId: 12,
      jobTitle: "Operator",
    },
    {
      avatarPath: null,
      displayName: "Alex Worker",
      employeeMembershipId: 11,
      jobTitle: "Operator",
    },
  ]

  it("orders rostered employees by first shift and then name", () => {
    const lanes = buildEmployeeRosterLanes(employees, [
      shift(1, 12, "2026-07-27T09:00:00.000Z"),
      shift(2, 11, "2026-07-27T08:00:00.000Z"),
      shift(3, 11, "2026-07-27T12:00:00.000Z"),
    ])

    expect(lanes.map((lane) => lane.displayName)).toEqual([
      "Alex Worker",
      "Zoe Worker",
    ])
    expect(lanes[0].shifts).toHaveLength(2)
  })

  it("keeps active employees visible when they have no shift on the day", () => {
    const lanes = buildEmployeeRosterLanes(
      employees,
      [shift(1, 11, "2026-07-27T08:00:00.000Z")],
      true
    )

    expect(lanes.map((lane) => lane.displayName)).toEqual([
      "Alex Worker",
      "Zoe Worker",
    ])
    expect(lanes[1].shifts).toEqual([])
  })

  it("assigns a stable employee colour", () => {
    expect(colourForEmployee(11)).toBe(colourForEmployee(11))
    expect(colourForEmployee(11)).not.toBe(colourForEmployee(12))
  })
})
