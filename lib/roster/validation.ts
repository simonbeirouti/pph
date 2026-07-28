import { z } from "zod"

import { addLocalDays, assertIanaTimezone } from "@/lib/roster/time"

const localDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/u, "Choose a valid date.")
  .refine((value) => {
    const [year, month, day] = value.split("-").map(Number)
    const date = new Date(Date.UTC(year, month - 1, day))
    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    )
  }, "Choose a valid date.")

const localTimeSchema = z
  .string()
  .regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/u, "Choose a valid time.")

export const employeeRosterShiftSchema = z.object({
  date: localDateSchema,
  endTime: localTimeSchema,
  notes: z.string().trim().max(500, "Notes must be 500 characters or fewer."),
  startTime: localTimeSchema,
  updatedAt: z
    .string()
    .refine((value) => Number.isFinite(Date.parse(value)), "Invalid version.")
    .optional(),
})

export const calendarRosterShiftSchema = employeeRosterShiftSchema
  .omit({ updatedAt: true })
  .extend({
    employeeMembershipId: z.coerce
      .number()
      .int()
      .positive("Choose an active employee."),
    jobIds: z
      .array(z.coerce.number().int().positive("Choose valid jobs."))
      .max(100, "Choose no more than 100 jobs.")
      .transform((values) => [...new Set(values)]),
    timezone: z.string().refine((value) => {
      try {
        assertIanaTimezone(value)
        return true
      } catch {
        return false
      }
    }, "Choose a valid timezone."),
  })

export function rosterShiftLocalValues(input: {
  date: string
  endTime: string
  startTime: string
}) {
  const endDate =
    input.endTime <= input.startTime ? addLocalDays(input.date, 1) : input.date
  return {
    end: `${endDate}T${input.endTime}`,
    start: `${input.date}T${input.startTime}`,
  }
}
