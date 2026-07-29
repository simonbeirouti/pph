const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const

const WEEKDAYS_SHORT = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
] as const

const formatterCache = new Map<string, Intl.DateTimeFormat>()

function formatterFor(timezone: string) {
  const cached = formatterCache.get(timezone)
  if (cached) return cached

  const formatter = new Intl.DateTimeFormat("en-AU-u-ca-gregory-nu-latn", {
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    month: "2-digit",
    timeZone: timezone,
    year: "numeric",
  })
  formatterCache.set(timezone, formatter)
  return formatter
}

function zonedParts(value: Date | string, timezone: string) {
  const date = typeof value === "string" ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return null

  const values = Object.fromEntries(
    formatterFor(timezone)
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)])
  )

  return {
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    month: values.month,
    year: values.year,
  }
}

function clockLabel(hour: number, minute: number) {
  const period = hour < 12 ? "am" : "pm"
  const displayHour = hour % 12 || 12
  return `${displayHour}:${String(minute).padStart(2, "0")} ${period}`
}

export function formatZonedTime(value: Date | string, timezone: string) {
  const parts = zonedParts(value, timezone)
  return parts ? clockLabel(parts.hour, parts.minute) : "Unknown time"
}

export function formatShortZonedDate(value: Date | string, timezone: string) {
  const parts = zonedParts(value, timezone)
  return parts
    ? `${parts.day} ${MONTHS_SHORT[parts.month - 1]}`
    : "Unknown date"
}

export function formatShortWeekdayZonedDate(
  value: Date | string,
  timezone: string
) {
  const parts = zonedParts(value, timezone)
  if (!parts) return "Unknown date"
  const weekday =
    WEEKDAYS_SHORT[
      new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay()
    ]
  return `${weekday}, ${parts.day} ${MONTHS_SHORT[parts.month - 1]}`
}

export function formatShortZonedDateTime(
  value: Date | string,
  timezone: string
) {
  const parts = zonedParts(value, timezone)
  return parts
    ? `${parts.day} ${MONTHS_SHORT[parts.month - 1]}, ${clockLabel(parts.hour, parts.minute)}`
    : "Unknown date"
}

export function formatMediumZonedDateTime(
  value: Date | string,
  timezone: string
) {
  const parts = zonedParts(value, timezone)
  return parts
    ? `${parts.day} ${MONTHS_SHORT[parts.month - 1]} ${parts.year}, ${clockLabel(parts.hour, parts.minute)}`
    : "Unknown date"
}
