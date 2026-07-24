import { z } from "zod";

export const ROSTER_CUSTOM_BRIEF_MAX_LENGTH = 4_000;
export const ROSTER_EMAIL_RECIPIENT_LIMIT = 12;

export const rosterFocusSchema = z.enum([
  "general_checkup",
  "work_items",
  "customers",
  "memory_hygiene",
  "sales",
  "marketing",
  "support",
  "finance",
  "custom",
]);

export const rosterTaskConfigSchema = z
  .object({
    version: z.literal(1),
    executor: z.literal("project_review.v1"),
    focus: rosterFocusSchema,
    brief: z.string().trim().min(1).max(ROSTER_CUSTOM_BRIEF_MAX_LENGTH).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.focus === "custom" && !value.brief) {
      ctx.addIssue({
        code: "custom",
        message: "A custom task brief is required.",
        path: ["brief"],
      });
    }

    if (value.focus !== "custom" && value.brief) {
      ctx.addIssue({
        code: "custom",
        message: "A custom brief is only allowed for the custom focus.",
        path: ["brief"],
      });
    }
  });

const localTimeSchema = z
  .string()
  .regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/u, "Time must use HH:mm format.");

export const rosterScheduleConfigSchema = z.discriminatedUnion("kind", [
  z
    .object({
      version: z.literal(1),
      kind: z.literal("once"),
      run_at: z.string().refine(
        (value) =>
          /(?:Z|[+-]\d{2}:\d{2})$/u.test(value) &&
          !Number.isNaN(Date.parse(value)),
        "Run time must be an ISO timestamp with an explicit UTC offset.",
      ),
    })
    .strict(),
  z
    .object({
      version: z.literal(1),
      kind: z.literal("daily"),
      local_time: localTimeSchema,
    })
    .strict(),
  z
    .object({
      version: z.literal(1),
      kind: z.literal("weekly"),
      day_of_week: z.number().int().min(0).max(6),
      local_time: localTimeSchema,
    })
    .strict(),
]);

const emailAddressSchema = z.string().trim().toLowerCase().email();

export const rosterDeliveryConfigSchema = z
  .object({
    version: z.literal(1),
    email: z.discriminatedUnion("enabled", [
      z.object({ enabled: z.literal(false) }).strict(),
      z
        .object({
          enabled: z.literal(true),
          recipients: z
            .array(emailAddressSchema)
            .min(1)
            .max(ROSTER_EMAIL_RECIPIENT_LIMIT),
        })
        .strict(),
    ]),
  })
  .strict()
  .transform((value) => {
    if (!value.email.enabled) return value;

    return {
      ...value,
      email: {
        ...value.email,
        recipients: [...new Set(value.email.recipients)],
      },
    };
  });

export const rosterResultSchema = z
  .object({
    version: z.literal(1),
    summary: z.string().trim().min(1).max(4_000),
    findings: z
      .array(
        z
          .object({
            category: z.enum([
              "risk",
              "opportunity",
              "missing_data",
              "observation",
            ]),
            text: z.string().trim().min(1).max(2_000),
          })
          .strict(),
      )
      .max(20),
    recommendations: z.array(z.string().trim().min(1).max(2_000)).max(20),
    artifacts: z
      .array(
        z
          .object({
            type: z.enum(["proposal", "work_item_suggestion", "reference"]),
            title: z.string().trim().min(1).max(300),
            body: z.string().trim().max(4_000).optional(),
            resource_id: z.string().trim().max(200).optional(),
            resource_type: z.string().trim().max(100).optional(),
          })
          .strict(),
      )
      .max(20),
  })
  .strict();

export type RosterDeliveryConfig = z.infer<typeof rosterDeliveryConfigSchema>;
export type RosterFocus = z.infer<typeof rosterFocusSchema>;
export type RosterResult = z.infer<typeof rosterResultSchema>;
export type RosterScheduleConfig = z.infer<typeof rosterScheduleConfigSchema>;
export type RosterTaskConfig = z.infer<typeof rosterTaskConfigSchema>;

export function assertIanaTimezone(value: string) {
  const timezone = value.trim();

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format();
  } catch {
    throw new Error("Timezone must be a valid IANA timezone.");
  }

  return timezone;
}

const localFormatterCache = new Map<string, Intl.DateTimeFormat>();

function localFormatter(timezone: string) {
  const cached = localFormatterCache.get(timezone);
  if (cached) return cached;

  const formatter = new Intl.DateTimeFormat("en-US-u-ca-gregory", {
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    month: "2-digit",
    timeZone: timezone,
    year: "numeric",
  });
  localFormatterCache.set(timezone, formatter);
  return formatter;
}

function localParts(date: Date, timezone: string) {
  const formatter = localFormatter(timezone);
  const parts = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number.parseInt(part.value, 10)]),
  );

  return {
    day: parts.day ?? 1,
    hour: parts.hour ?? 0,
    minute: parts.minute ?? 0,
    month: parts.month ?? 1,
    year: parts.year ?? 1970,
  };
}

export function zonedLocalDateTimeToUtc(value: string, timezoneInput: string) {
  const timezone = assertIanaTimezone(timezoneInput);
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/u,
  );

  if (!match) throw new Error("Run time must include a local date and time.");

  const [, yearText, monthText, dayText, hourText, minuteText] = match;
  const target = {
    year: Number.parseInt(yearText!, 10),
    month: Number.parseInt(monthText!, 10),
    day: Number.parseInt(dayText!, 10),
    hour: Number.parseInt(hourText!, 10),
    minute: Number.parseInt(minuteText!, 10),
  };
  const nominal = Date.UTC(
    target.year,
    target.month - 1,
    target.day,
    target.hour,
    target.minute,
  );

  for (
    let instant = nominal - 18 * 60 * 60 * 1_000;
    instant <= nominal + 18 * 60 * 60 * 1_000;
    instant += 60_000
  ) {
    const candidate = new Date(instant);
    const local = localParts(candidate, timezone);
    if (
      local.year === target.year &&
      local.month === target.month &&
      local.day === target.day &&
      local.hour === target.hour &&
      local.minute === target.minute
    ) {
      return candidate.toISOString();
    }
  }

  throw new Error("That local time does not exist in the selected timezone.");
}

function sameLocalDate(
  value: ReturnType<typeof localParts>,
  target: { day: number; month: number; year: number },
) {
  return (
    value.year === target.year &&
    value.month === target.month &&
    value.day === target.day
  );
}

export function nextRosterOccurrence(
  scheduleInput: unknown,
  timezoneInput: string,
  afterInput: Date | string = new Date(),
) {
  const schedule = rosterScheduleConfigSchema.parse(scheduleInput);
  const timezone = assertIanaTimezone(timezoneInput);
  const after = afterInput instanceof Date ? afterInput : new Date(afterInput);

  if (Number.isNaN(after.getTime())) {
    throw new Error("The recurrence starting instant is invalid.");
  }

  if (schedule.kind === "once") {
    const runAt = new Date(schedule.run_at);
    return runAt.getTime() > after.getTime() ? runAt.toISOString() : null;
  }

  const [targetHour, targetMinute] = schedule.local_time
    .split(":")
    .map((part) => Number.parseInt(part, 10));
  const localAfter = localParts(after, timezone);
  const localStart = new Date(
    Date.UTC(localAfter.year, localAfter.month - 1, localAfter.day),
  );

  for (let dayOffset = 0; dayOffset <= 8; dayOffset += 1) {
    const candidateDate = new Date(localStart);
    candidateDate.setUTCDate(candidateDate.getUTCDate() + dayOffset);

    if (
      schedule.kind === "weekly" &&
      candidateDate.getUTCDay() !== schedule.day_of_week
    ) {
      continue;
    }

    const targetDate = {
      day: candidateDate.getUTCDate(),
      month: candidateDate.getUTCMonth() + 1,
      year: candidateDate.getUTCFullYear(),
    };
    const nominalUtc = Date.UTC(
      targetDate.year,
      targetDate.month - 1,
      targetDate.day,
      targetHour,
      targetMinute,
    );
    const scanStart = nominalUtc - 18 * 60 * 60 * 1_000;
    const scanEnd = nominalUtc + 42 * 60 * 60 * 1_000;
    let exactExists = false;
    let fallback: Date | null = null;

    for (let instant = scanStart; instant <= scanEnd; instant += 60_000) {
      const candidate = new Date(instant);
      const local = localParts(candidate, timezone);

      if (!sameLocalDate(local, targetDate)) continue;

      if (local.hour === targetHour && local.minute === targetMinute) {
        exactExists = true;
        if (instant > after.getTime()) return candidate.toISOString();
      } else if (
        !fallback &&
        instant > after.getTime() &&
        local.hour * 60 + local.minute > targetHour * 60 + targetMinute
      ) {
        fallback = candidate;
      }
    }

    if (!exactExists && fallback) return fallback.toISOString();
  }

  throw new Error("Could not calculate the next roster occurrence.");
}

export function normalizeRosterDefinition(input: {
  deliveryConfig: unknown;
  enabled?: boolean;
  now?: Date | string;
  scheduleConfig: unknown;
  taskConfig: unknown;
  timezone: string;
  title: string;
}) {
  const title = input.title.trim();

  if (!title || title.length > 120) {
    throw new Error("Roster task title must be between 1 and 120 characters.");
  }

  const taskConfig = rosterTaskConfigSchema.parse(input.taskConfig);
  const scheduleConfig = rosterScheduleConfigSchema.parse(input.scheduleConfig);
  const deliveryConfig = rosterDeliveryConfigSchema.parse(input.deliveryConfig);
  const timezone = assertIanaTimezone(input.timezone);
  const now = input.now ?? new Date();
  const nextRunAt = nextRosterOccurrence(scheduleConfig, timezone, now);

  if (scheduleConfig.kind === "once" && !nextRunAt) {
    throw new Error("A one-time roster task must be scheduled in the future.");
  }

  return {
    deliveryConfig,
    enabled: input.enabled ?? true,
    nextRunAt,
    scheduleConfig,
    taskConfig,
    timezone,
    title,
  };
}
