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

export function rosterLocalParts(date: Date, timezone: string) {
  const parts = Object.fromEntries(
    localFormatter(timezone)
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
    const local = rosterLocalParts(candidate, timezone);
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

export function sameRosterLocalDate(
  value: ReturnType<typeof rosterLocalParts>,
  target: { day: number; month: number; year: number },
) {
  return (
    value.year === target.year &&
    value.month === target.month &&
    value.day === target.day
  );
}
