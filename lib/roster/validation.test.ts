import { describe, expect, it } from "vitest"

import {
  calendarRosterShiftSchema,
  employeeRosterShiftSchema,
  rosterShiftLocalValues,
} from "@/lib/roster/validation"

describe("employee roster shift validation", () => {
  it("accepts exact shift values to the minute", () => {
    expect(
      employeeRosterShiftSchema.safeParse({
        date: "2026-07-27",
        endTime: "17:13",
        notes: "Front desk",
        startTime: "09:07",
      }).success
    ).toBe(true)
  })

  it("rejects invalid dates and times", () => {
    const result = employeeRosterShiftSchema.safeParse({
      date: "2026-02-30",
      endTime: "24:10",
      notes: "",
      startTime: "9:07",
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.flatten().fieldErrors).toMatchObject({
        date: ["Choose a valid date."],
        endTime: ["Choose a valid time."],
        startTime: ["Choose a valid time."],
      })
    }
  })

  it("treats an earlier end time as an overnight shift", () => {
    expect(
      rosterShiftLocalValues({
        date: "2026-07-27",
        endTime: "06:00",
        startTime: "22:00",
      })
    ).toEqual({
      end: "2026-07-28T06:00",
      start: "2026-07-27T22:00",
    })
  })

  it("validates calendar employee, timezone, and distinct job choices", () => {
    const result = calendarRosterShiftSchema.safeParse({
      date: "2026-07-27",
      employeeMembershipId: "1103",
      endTime: "10:13",
      jobIds: ["1401", "1401", "1402"],
      notes: "",
      startTime: "09:07",
      timezone: "Australia/Melbourne",
    })

    expect(result.success).toBe(true)
    if (result.success) expect(result.data.jobIds).toEqual([1401, 1402])
  })
})
