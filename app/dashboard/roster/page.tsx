import { RosterCalendar } from "@/components/roster-calendar"
import {
  getOwnerRosterCalendarData,
  getOwnerRosterContext,
} from "@/lib/roster/data"
import {
  assertIanaTimezone,
  localDateForInstant,
  localDateRange,
  mondayForLocalDate,
} from "@/lib/roster/time"

function validLocalDate(value: string | undefined) {
  if (!value?.match(/^\d{4}-\d{2}-\d{2}$/u)) return null
  const [year, month, day] = value.split("-").map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
    ? value
    : null
}

function validTimezone(value: string | undefined) {
  if (!value) return null
  try {
    return assertIanaTimezone(value)
  } catch {
    return null
  }
}

export default async function RosterPage({
  searchParams,
}: {
  searchParams: Promise<{
    date?: string
    employee?: string
    timezone?: string
    view?: string
  }>
}) {
  const params = await searchParams
  const mode = params.view === "week" ? "week" : "day"
  const context = await getOwnerRosterContext()
  const requestedTimezone = validTimezone(params.timezone)
  const timezone = requestedTimezone ?? context.timezone
  const now = new Date()
  const today = localDateForInstant(now, timezone)
  const selectedDate = validLocalDate(params.date) ?? today
  const weekStart = mondayForLocalDate(selectedDate)
  const range = localDateRange(weekStart, 7, timezone)
  const selectedValue = Number(params.employee)
  const selectedEmployee =
    context.employees.find(
      (employee) =>
        Number.isSafeInteger(selectedValue) &&
        employee.employeeMembershipId === selectedValue
    ) ?? context.employees[0]
  const calendar = await getOwnerRosterCalendarData({
    endUtc: range.endUtc,
    startUtc: range.startUtc,
  })

  return (
    <RosterCalendar
      dates={range.dates}
      employees={calendar.employees}
      mode={mode}
      now={now.toISOString()}
      selectedDate={selectedDate}
      selectedEmployeeId={
        mode === "week"
          ? (selectedEmployee?.employeeMembershipId ?? null)
          : null
      }
      shifts={calendar.shifts}
      timezone={timezone}
      timezoneExplicit={Boolean(requestedTimezone)}
      today={today}
    />
  )
}
