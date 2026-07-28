export const REALTIME_EVENT_VERSION = 1 as const

export const REALTIME_DOMAINS = [
  "membership",
  "employee_profile",
  "job",
  "job_update",
  "roster",
  "evidence",
  "review",
  "template",
  "schedule",
  "dashboard",
] as const

export type RealtimeDomain = (typeof REALTIME_DOMAINS)[number]
export type RealtimeAction = "delete" | "insert" | "update"

export type RealtimeInvalidation = {
  action: RealtimeAction
  domain: RealtimeDomain
  entityId: number
  eventId: string
  occurredAt: string
  version: typeof REALTIME_EVENT_VERSION
}

export type RealtimeConnectionStatus = "connecting" | "connected" | "degraded"

const DOMAIN_SET = new Set<string>(REALTIME_DOMAINS)
const ACTION_SET = new Set<string>(["delete", "insert", "update"])

export function organisationRealtimeTopic(organisationId: number) {
  return `org:${organisationId}:operations`
}

export function memberRealtimeTopic(membershipId: number) {
  return `member:${membershipId}:work`
}

export function realtimeTopic(input: {
  membershipId: number
  organisationId: number
  role: "employee" | "manager" | "owner"
}) {
  return input.role === "owner" || input.role === "manager"
    ? organisationRealtimeTopic(input.organisationId)
    : memberRealtimeTopic(input.membershipId)
}

export function parseRealtimeInvalidation(
  value: unknown
): RealtimeInvalidation | null {
  if (!value || typeof value !== "object") return null
  const event = value as Record<string, unknown>

  if (
    event.version !== REALTIME_EVENT_VERSION ||
    typeof event.eventId !== "string" ||
    !event.eventId ||
    typeof event.domain !== "string" ||
    !DOMAIN_SET.has(event.domain) ||
    typeof event.action !== "string" ||
    !ACTION_SET.has(event.action) ||
    typeof event.entityId !== "number" ||
    !Number.isSafeInteger(event.entityId) ||
    typeof event.occurredAt !== "string" ||
    Number.isNaN(Date.parse(event.occurredAt))
  ) {
    return null
  }

  return event as RealtimeInvalidation
}
