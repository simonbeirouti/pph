import { describe, expect, it } from "vitest"

import {
  isoToLocalDateTime,
  jobSchema,
  localDateTimeToIso,
} from "@/lib/jobs/validation"

const validJob = {
  assigneeMembershipId: "",
  description: "",
  dueAt: "",
  location: "",
  minimumCompletionPhotos: "0",
  priority: "normal",
  requiresCompletionNote: false,
  scheduledAt: "",
  title: "Inspect loading bay",
}

describe("job validation", () => {
  it("requires a title and a valid evidence range", () => {
    const result = jobSchema.safeParse({
      ...validJob,
      minimumCompletionPhotos: "11",
      title: " ",
    })

    expect(result.success).toBe(false)
    expect(result.error?.flatten().fieldErrors.title).toContain(
      "Enter a job title."
    )
    expect(
      result.error?.flatten().fieldErrors.minimumCompletionPhotos
    ).toContain("Use between 0 and 10 photos.")
  })

  it("rejects a due time before its scheduled time", () => {
    const result = jobSchema.safeParse({
      ...validJob,
      dueAt: "2026-07-27T08:30",
      scheduledAt: "2026-07-27T09:00",
    })

    expect(result.success).toBe(false)
    expect(result.error?.flatten().fieldErrors.dueAt).toContain(
      "Due time cannot precede scheduled time."
    )
  })

  it("converts organisation-local times to UTC", () => {
    expect(localDateTimeToIso("2026-07-27T09:00", "Australia/Melbourne")).toBe(
      "2026-07-26T23:00:00.000Z"
    )
    expect(
      isoToLocalDateTime("2026-07-26T23:00:00.000Z", "Australia/Melbourne")
    ).toBe("2026-07-27T09:00")
  })
})
