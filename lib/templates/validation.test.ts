import { describe, expect, it } from "vitest"

import { scheduleSchema, templateSchema } from "@/lib/templates/validation"

describe("template validation", () => {
  it("accepts reusable defaults without scheduled timestamps", () => {
    expect(
      templateSchema.safeParse({
        assigneeMembershipId: "",
        description: "Inspect all exits",
        location: "Ground floor",
        minimumCompletionPhotos: "2",
        priority: "high",
        requiresCompletionNote: true,
        title: "Safety inspection",
      }).success
    ).toBe(true)
  })

  it("rejects evidence requirements outside the job contract", () => {
    const result = templateSchema.safeParse({
      assigneeMembershipId: "",
      description: "",
      location: "",
      minimumCompletionPhotos: "11",
      priority: "normal",
      requiresCompletionNote: false,
      title: "Invalid",
    })
    expect(result.success).toBe(false)
  })
})

describe("schedule validation", () => {
  const valid = {
    assigneeMembershipId: "1103",
    endsOn: "2030-01-31",
    isEnabled: true,
    localTime: "09:30",
    recurrenceType: "weekly",
    startsOn: "2030-01-01",
    templateId: "1401",
    weekdays: ["1", "3", "5"],
  }

  it("accepts ISO multi-weekday recurrence", () => {
    expect(scheduleSchema.safeParse(valid).success).toBe(true)
  })

  it("accepts an unassigned schedule", () => {
    expect(
      scheduleSchema.safeParse({ ...valid, assigneeMembershipId: "" }).success
    ).toBe(true)
  })

  it("requires a weekday and an inclusive forward date range", () => {
    const result = scheduleSchema.safeParse({
      ...valid,
      endsOn: "2029-12-31",
      weekdays: [],
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.weekdays).toBeDefined()
      expect(result.error.flatten().fieldErrors.endsOn).toBeDefined()
    }
  })
})
