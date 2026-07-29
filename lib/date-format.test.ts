import { describe, expect, it } from "vitest"

import {
  formatMediumZonedDateTime,
  formatShortWeekdayZonedDate,
  formatShortZonedDate,
  formatShortZonedDateTime,
  formatZonedTime,
} from "@/lib/date-format"

describe("cross-engine date formatting", () => {
  it("assembles stable English labels from numeric timezone parts", () => {
    const value = "2030-07-27T00:00:00Z"
    const timezone = "Australia/Melbourne"

    expect(formatZonedTime(value, timezone)).toBe("10:00 am")
    expect(formatShortZonedDate(value, timezone)).toBe("27 Jul")
    expect(formatShortWeekdayZonedDate(value, timezone)).toBe("Sat, 27 Jul")
    expect(formatShortZonedDateTime(value, timezone)).toBe("27 Jul, 10:00 am")
    expect(formatMediumZonedDateTime(value, timezone)).toBe(
      "27 Jul 2030, 10:00 am"
    )
  })
})
