import { describe, expect, it } from "vitest"

import {
  memberRealtimeTopic,
  organisationRealtimeTopic,
  parseRealtimeInvalidation,
  realtimeTopic,
} from "@/lib/realtime/events"

const validEvent = {
  action: "update",
  domain: "job",
  entityId: 1401,
  eventId: "7f879239-866d-4a34-837b-9ca0602c47b3",
  occurredAt: "2026-07-27T01:00:00.000Z",
  version: 1,
}

describe("realtime events", () => {
  it("builds role-scoped private topics", () => {
    expect(organisationRealtimeTopic(1001)).toBe("org:1001:operations")
    expect(memberRealtimeTopic(1103)).toBe("member:1103:work")
    expect(
      realtimeTopic({
        membershipId: 1101,
        organisationId: 1001,
        role: "owner",
      })
    ).toBe("org:1001:operations")
    expect(
      realtimeTopic({
        membershipId: 1103,
        organisationId: 1001,
        role: "employee",
      })
    ).toBe("member:1103:work")
  })

  it("accepts the versioned invalidation contract", () => {
    expect(parseRealtimeInvalidation(validEvent)).toEqual(validEvent)
  })

  it.each([
    { ...validEvent, version: 2 },
    { ...validEvent, domain: "private_note" },
    { ...validEvent, action: "assign" },
    { ...validEvent, entityId: 1.5 },
    { ...validEvent, occurredAt: "not-a-date" },
    null,
  ])("rejects unsupported or malformed events", (event) => {
    expect(parseRealtimeInvalidation(event)).toBeNull()
  })
})
