import { describe, expect, it } from "vitest"

import {
  addMinutesToClockTime,
  clockTimeDurationMinutes,
} from "@/lib/roster/time"

describe("roster clock-time helpers", () => {
  it("calculates same-day and overnight durations", () => {
    expect(clockTimeDurationMinutes("09:07", "10:13")).toBe(66)
    expect(clockTimeDurationMinutes("20:00", "02:00")).toBe(360)
  })

  it("moves a clock time across midnight", () => {
    expect(addMinutesToClockTime("20:00", 360)).toBe("02:00")
    expect(addMinutesToClockTime("23:55", 15)).toBe("00:10")
  })
})
