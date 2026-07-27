import { z } from "zod"

export const JOB_PRIORITIES = ["low", "normal", "high", "urgent"] as const

const optionalDateTime = z
  .string()
  .trim()
  .refine(
    (value) => value === "" || /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value),
    "Enter a valid date and time."
  )

export const jobSchema = z
  .object({
    assigneeMembershipId: z
      .string()
      .trim()
      .regex(/^$|^\d+$/, "Choose a valid assignee."),
    description: z
      .string()
      .trim()
      .max(5000, "Keep the description under 5,000 characters."),
    dueAt: optionalDateTime,
    location: z
      .string()
      .trim()
      .max(500, "Keep the location under 500 characters."),
    minimumCompletionPhotos: z.coerce
      .number()
      .int()
      .min(0, "Use between 0 and 10 photos.")
      .max(10, "Use between 0 and 10 photos."),
    priority: z.enum(JOB_PRIORITIES),
    requiresCompletionNote: z.boolean(),
    scheduledAt: optionalDateTime,
    title: z
      .string()
      .trim()
      .min(1, "Enter a job title.")
      .max(200, "Keep the title under 200 characters."),
  })
  .refine(
    ({ dueAt, scheduledAt }) => !dueAt || !scheduledAt || dueAt >= scheduledAt,
    {
      message: "Due time cannot precede scheduled time.",
      path: ["dueAt"],
    }
  )

export function localDateTimeToIso(value: string, timezone: string) {
  if (!value) return null

  const [datePart, timePart] = value.split("T")
  const [year, month, day] = datePart.split("-").map(Number)
  const [hour, minute] = timePart.split(":").map(Number)
  let candidate = Date.UTC(year, month - 1, day, hour, minute)

  for (let attempts = 0; attempts < 3; attempts += 1) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      day: "2-digit",
      hour: "2-digit",
      hour12: false,
      minute: "2-digit",
      month: "2-digit",
      timeZone: timezone,
      year: "numeric",
    }).formatToParts(new Date(candidate))
    const values = Object.fromEntries(
      parts.map((part) => [part.type, part.value])
    )
    const rendered = Date.UTC(
      Number(values.year),
      Number(values.month) - 1,
      Number(values.day),
      Number(values.hour) % 24,
      Number(values.minute)
    )
    const target = Date.UTC(year, month - 1, day, hour, minute)
    const difference = target - rendered
    candidate += difference
    if (difference === 0) break
  }

  return new Date(candidate).toISOString()
}

export function isoToLocalDateTime(
  value: string | null,
  timezone: string
): string {
  if (!value) return ""

  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    month: "2-digit",
    timeZone: timezone,
    year: "numeric",
  }).formatToParts(new Date(value))
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value])
  )

  return `${values.year}-${values.month}-${values.day}T${values.hour === "24" ? "00" : values.hour}:${values.minute}`
}
