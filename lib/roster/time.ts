import { formatZonedTime } from "@/lib/date-format"
import type {
  RosterCalendarDate,
  RosterCalendarRange,
  RosterShift,
  RosterShiftPosition,
  VisibleHourRange,
} from "@/lib/roster/types"

const MINUTE_MS = 60_000
const DAY_MS = 24 * 60 * MINUTE_MS
const formatterCache = new Map<string, Intl.DateTimeFormat>()
const utcConversionCache = new Map<string, string>()

function pad(value: number) {
  return String(value).padStart(2, "0")
}

function dateParts(date: Date, timezone: string) {
  let formatter = formatterCache.get(timezone)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-AU-u-ca-gregory", {
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23",
      minute: "2-digit",
      month: "2-digit",
      second: "2-digit",
      timeZone: timezone,
      year: "numeric",
    })
    formatterCache.set(timezone, formatter)
  }
  const parts = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)])
  )
  return {
    day: parts.day ?? 1,
    hour: parts.hour ?? 0,
    minute: parts.minute ?? 0,
    month: parts.month ?? 1,
    second: parts.second ?? 0,
    year: parts.year ?? 1970,
  }
}

export function assertIanaTimezone(value: string) {
  const timezone = value.trim()
  try {
    new Intl.DateTimeFormat("en-AU", { timeZone: timezone }).format()
  } catch {
    throw new Error("Timezone must be a valid IANA timezone.")
  }
  return timezone
}

export function localDateForInstant(instant: Date | string, timezone: string) {
  const parts = dateParts(
    typeof instant === "string" ? new Date(instant) : instant,
    assertIanaTimezone(timezone)
  )
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`
}

export function addLocalDays(localDate: string, days: number) {
  const match = localDate.match(/^(\d{4})-(\d{2})-(\d{2})$/u)
  if (!match) throw new Error("Date must use YYYY-MM-DD.")
  const date = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  )
  date.setUTCDate(date.getUTCDate() + days)
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(
    date.getUTCDate()
  )}`
}

export function mondayForLocalDate(localDate: string) {
  const [year, month, day] = localDate.split("-").map(Number)
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  return addLocalDays(localDate, -((weekday + 6) % 7))
}

export function zonedLocalDateTimeToUtc(value: string, timezoneInput: string) {
  const timezone = assertIanaTimezone(timezoneInput)
  const cacheKey = `${timezone}:${value}`
  const cached = utcConversionCache.get(cacheKey)
  if (cached) return cached
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/u
  )
  if (!match) throw new Error("Date and time must use a local ISO value.")
  const target = {
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    month: Number(match[2]),
    second: Number(match[6] ?? 0),
    year: Number(match[1]),
  }
  const nominal = Date.UTC(
    target.year,
    target.month - 1,
    target.day,
    target.hour,
    target.minute,
    target.second
  )
  for (
    let valueMs = nominal - 18 * 60 * MINUTE_MS;
    valueMs <= nominal + 18 * 60 * MINUTE_MS;
    valueMs += MINUTE_MS
  ) {
    const candidate = new Date(valueMs)
    const local = dateParts(candidate, timezone)
    if (
      local.year === target.year &&
      local.month === target.month &&
      local.day === target.day &&
      local.hour === target.hour &&
      local.minute === target.minute
    ) {
      const result = candidate.toISOString()
      utcConversionCache.set(cacheKey, result)
      return result
    }
  }
  throw new Error("That local time does not exist in this timezone.")
}

export function localDateRange(
  startDate: string,
  dayCount: number,
  timezone: string
): RosterCalendarRange {
  const endDate = addLocalDays(startDate, dayCount)
  return {
    dates: Array.from({ length: dayCount }, (_, index) =>
      calendarDate(addLocalDays(startDate, index), timezone)
    ),
    endUtc: zonedLocalDateTimeToUtc(`${endDate}T00:00`, timezone),
    startUtc: zonedLocalDateTimeToUtc(`${startDate}T00:00`, timezone),
  }
}

export function calendarDate(
  localDate: string,
  timezone: string
): RosterCalendarDate {
  const midday = zonedLocalDateTimeToUtc(`${localDate}T12:00`, timezone)
  const value = new Date(midday)
  return {
    date: localDate,
    label: new Intl.DateTimeFormat("en-AU", {
      day: "numeric",
      month: "long",
      timeZone: timezone,
      weekday: "long",
    }).format(value),
    shortLabel: new Intl.DateTimeFormat("en-AU", {
      day: "numeric",
      month: "short",
      timeZone: timezone,
      weekday: "short",
    }).format(value),
  }
}

export function minutesInLocalDay(
  instant: Date | number | string,
  timezone: string
) {
  const parts = dateParts(
    instant instanceof Date ? instant : new Date(instant),
    timezone
  )
  return parts.hour * 60 + parts.minute + parts.second / 60
}

export function formatLocalTime(instant: string, timezone: string) {
  return formatZonedTime(instant, timezone)
}

export function localTimeInputForInstant(
  instant: Date | string,
  timezone: string
) {
  const parts = dateParts(
    typeof instant === "string" ? new Date(instant) : instant,
    timezone
  )
  return `${pad(parts.hour)}:${pad(parts.minute)}`
}

function clockMinutes(value: string) {
  const match = value.match(/^([01]\d|2[0-3]):([0-5]\d)$/u)
  return match ? Number(match[1]) * 60 + Number(match[2]) : null
}

export function clockTimeDurationMinutes(start: string, end: string) {
  const startMinutes = clockMinutes(start)
  const endMinutes = clockMinutes(end)
  if (startMinutes === null || endMinutes === null) return null
  const duration = endMinutes - startMinutes
  return duration > 0 ? duration : duration + 24 * 60
}

export function addMinutesToClockTime(value: string, minutes: number) {
  const startMinutes = clockMinutes(value)
  if (startMinutes === null || !Number.isFinite(minutes)) return value
  const dayMinutes = 24 * 60
  const result =
    (((startMinutes + Math.round(minutes)) % dayMinutes) + dayMinutes) %
    dayMinutes
  return `${pad(Math.floor(result / 60))}:${pad(result % 60)}`
}

export function clockTimeForDayMinutes(minutes: number) {
  const dayMinutes = 24 * 60
  const bounded = Math.max(0, Math.min(dayMinutes, Math.round(minutes)))
  const normalized = bounded === dayMinutes ? 0 : bounded
  return `${pad(Math.floor(normalized / 60))}:${pad(normalized % 60)}`
}

export function calendarMinutesForOffset(
  offset: number,
  height: number,
  snapMinutes = 15
) {
  if (!Number.isFinite(offset) || !Number.isFinite(height) || height <= 0) {
    return 0
  }
  const rawMinutes = (Math.max(0, Math.min(height, offset)) / height) * 24 * 60
  return Math.max(
    0,
    Math.min(24 * 60, Math.round(rawMinutes / snapMinutes) * snapMinutes)
  )
}

export function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  if (!hours) return `${remainder}m`
  if (!remainder) return `${hours}h`
  return `${hours}h ${remainder}m`
}

export function shiftDurationMinutes(
  shift: Pick<RosterShift, "endsAt" | "startsAt">
) {
  return Math.round(
    (new Date(shift.endsAt).getTime() - new Date(shift.startsAt).getTime()) /
      MINUTE_MS
  )
}

export function visibleHourRange(
  shifts: readonly Pick<RosterShift, "endsAt" | "startsAt">[],
  dates: readonly string[],
  timezone: string
): VisibleHourRange {
  let startHour = 6
  let endHour = 22
  const selected = new Set(dates)
  for (const shift of shifts) {
    for (const date of dates) {
      const dayStart = new Date(
        zonedLocalDateTimeToUtc(`${date}T00:00`, timezone)
      ).getTime()
      const dayEnd = new Date(
        zonedLocalDateTimeToUtc(`${addLocalDays(date, 1)}T00:00`, timezone)
      ).getTime()
      const start = Math.max(new Date(shift.startsAt).getTime(), dayStart)
      const end = Math.min(new Date(shift.endsAt).getTime(), dayEnd)
      if (end <= start || !selected.has(date)) continue
      startHour = Math.min(
        startHour,
        Math.floor(minutesInLocalDay(start, timezone) / 60)
      )
      const endMinutes =
        end === dayEnd ? 24 * 60 : minutesInLocalDay(end, timezone)
      endHour = Math.max(endHour, Math.ceil(endMinutes / 60))
    }
  }
  return { endHour: Math.min(24, endHour), startHour: Math.max(0, startHour) }
}

export function positionShiftOnDate(
  shift: Pick<RosterShift, "endsAt" | "startsAt">,
  date: string,
  timezone: string,
  visible: VisibleHourRange
): RosterShiftPosition | null {
  const dayStart = new Date(
    zonedLocalDateTimeToUtc(`${date}T00:00`, timezone)
  ).getTime()
  const dayEnd = new Date(
    zonedLocalDateTimeToUtc(`${addLocalDays(date, 1)}T00:00`, timezone)
  ).getTime()
  const rawStart = new Date(shift.startsAt).getTime()
  const rawEnd = new Date(shift.endsAt).getTime()
  const clippedStart = Math.max(rawStart, dayStart)
  const clippedEnd = Math.min(rawEnd, dayEnd)
  if (clippedEnd <= clippedStart) return null

  const visibleStart = visible.startHour * 60
  const visibleMinutes = (visible.endHour - visible.startHour) * 60
  const startMinutes =
    clippedStart === dayStart ? 0 : minutesInLocalDay(clippedStart, timezone)
  const endMinutes =
    clippedEnd === dayEnd ? 24 * 60 : minutesInLocalDay(clippedEnd, timezone)
  const boundedStart = Math.max(startMinutes, visibleStart)
  const boundedEnd = Math.min(endMinutes, visible.endHour * 60)
  if (boundedEnd <= boundedStart) return null

  return {
    clippedEndAt: new Date(clippedEnd).toISOString(),
    clippedStartAt: new Date(clippedStart).toISOString(),
    continuesFromPreviousDay: rawStart < dayStart,
    continuesIntoNextDay: rawEnd > dayEnd,
    heightPercent: ((boundedEnd - boundedStart) / visibleMinutes) * 100,
    topPercent: ((boundedStart - visibleStart) / visibleMinutes) * 100,
  }
}

export function snapToQuarterHour(minutes: number) {
  return Math.round(minutes / 15) * 15
}

export const ROSTER_DAY_MS = DAY_MS
