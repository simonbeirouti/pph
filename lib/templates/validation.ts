import { z } from "zod"

const optionalMembershipId = z
  .string()
  .trim()
  .refine((value) => value === "" || /^[1-9]\d*$/u.test(value), {
    message: "Choose an active employee.",
  })

export const templateSchema = z.object({
  assigneeMembershipId: optionalMembershipId,
  description: z.string().trim().max(4000),
  location: z.string().trim().max(300),
  minimumCompletionPhotos: z.coerce.number().int().min(0).max(10),
  priority: z.enum(["low", "normal", "high", "urgent"]),
  requiresCompletionNote: z.boolean(),
  title: z.string().trim().min(1, "Enter a template title.").max(200),
})

export const scheduleSchema = z
  .object({
    assigneeMembershipId: optionalMembershipId,
    endsOn: z
      .string()
      .trim()
      .refine(
        (value) => value === "" || /^\d{4}-\d{2}-\d{2}$/u.test(value),
        "Choose a valid end date."
      ),
    isEnabled: z.boolean(),
    localTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/u, "Choose a valid local time."),
    recurrenceType: z.enum(["daily", "weekly"]),
    startsOn: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/u, "Choose a valid start date."),
    templateId: z.string().regex(/^[1-9]\d*$/u, "Choose an active template."),
    weekdays: z.array(z.coerce.number().int().min(1).max(7)),
  })
  .superRefine((value, context) => {
    if (
      value.recurrenceType === "weekly" &&
      new Set(value.weekdays).size === 0
    ) {
      context.addIssue({
        code: "custom",
        message: "Choose at least one weekday.",
        path: ["weekdays"],
      })
    }
    if (value.endsOn && value.endsOn < value.startsOn) {
      context.addIssue({
        code: "custom",
        message: "End date cannot precede start date.",
        path: ["endsOn"],
      })
    }
  })
