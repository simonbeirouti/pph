import { describe, expect, it } from "vitest"

import {
  addMinutesToClockTime,
  calendarMinutesForOffset,
  clockTimeForDayMinutes,
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

  it("maps calendar coordinates to quarter hours", () => {
    expect(calendarMinutesForOffset(250, 1_000)).toBe(360)
    expect(calendarMinutesForOffset(257, 1_000)).toBe(375)
    expect(calendarMinutesForOffset(-10, 1_000)).toBe(0)
    expect(calendarMinutesForOffset(1_100, 1_000)).toBe(1_440)
  })

  it("formats calendar minutes as a clock time", () => {
    expect(clockTimeForDayMinutes(375)).toBe("06:15")
    expect(clockTimeForDayMinutes(1_440)).toBe("00:00")
  })
})
