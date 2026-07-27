import { describe, expect, it } from "vitest"

import {
  addLocalDays,
  formatDuration,
  localDateForInstant,
  localDateRange,
  mondayForLocalDate,
  positionShiftOnDate,
  snapToQuarterHour,
  visibleHourRange,
  zonedLocalDateTimeToUtc,
} from "@/lib/roster/time"

describe("roster time", () => {
  it("uses Monday-based local weeks and calendar-day navigation", () => {
    expect(mondayForLocalDate("2026-07-27")).toBe("2026-07-27")
    expect(mondayForLocalDate("2026-08-02")).toBe("2026-07-27")
    expect(addLocalDays("2026-12-31", 1)).toBe("2027-01-01")
  })

  it("builds DST-safe Melbourne ranges", () => {
    const autumn = localDateRange("2026-04-05", 1, "Australia/Melbourne")
    const spring = localDateRange("2026-10-04", 1, "Australia/Melbourne")

    expect(
      new Date(autumn.endUtc).getTime() - new Date(autumn.startUtc).getTime()
    ).toBe(25 * 60 * 60 * 1000)
    expect(
      new Date(spring.endUtc).getTime() - new Date(spring.startUtc).getTime()
    ).toBe(23 * 60 * 60 * 1000)
    expect(
      localDateForInstant("2026-07-26T14:30:00.000Z", "Australia/Melbourne")
    ).toBe("2026-07-27")
  })

  it("rejects a local time skipped by daylight saving", () => {
    expect(() =>
      zonedLocalDateTimeToUtc("2026-10-04T02:30", "Australia/Melbourne")
    ).toThrow("does not exist")
  })

  it("clips overnight shifts independently on both dates", () => {
    const shift = {
      startsAt: "2026-07-27T11:30:00.000Z",
      endsAt: "2026-07-27T23:30:00.000Z",
    }
    const visible = { endHour: 24, startHour: 0 }
    const first = positionShiftOnDate(
      shift,
      "2026-07-27",
      "Australia/Melbourne",
      visible
    )
    const second = positionShiftOnDate(
      shift,
      "2026-07-28",
      "Australia/Melbourne",
      visible
    )

    expect(first).toMatchObject({
      continuesFromPreviousDay: false,
      continuesIntoNextDay: true,
    })
    expect(second).toMatchObject({
      continuesFromPreviousDay: true,
      continuesIntoNextDay: false,
    })
  })

  it("expands visible hours and keeps 15-minute geometry", () => {
    const shifts = [
      {
        startsAt: "2026-07-26T18:15:00.000Z",
        endsAt: "2026-07-27T13:15:00.000Z",
      },
    ]
    expect(
      visibleHourRange(shifts, ["2026-07-27"], "Australia/Melbourne")
    ).toEqual({ endHour: 24, startHour: 4 })
    expect(snapToQuarterHour(37)).toBe(30)
    expect(formatDuration(135)).toBe("2h 15m")
  })
})
