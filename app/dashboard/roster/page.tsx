import { RosterCalendar } from "@/components/roster/roster-calendar"
import { requireActiveMembership } from "@/lib/auth/membership"
import {
  getCurrentEmployee,
  toActiveEmployeeOption,
} from "@/lib/employees/data"
import { getEmployeeAssignedJobs } from "@/lib/jobs/data"
import {
  getEmployeeRosterCalendarData,
  getOwnerRosterCalendarData,
  getOwnerRosterContext,
} from "@/lib/roster/data"
import {
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

export default async function RosterPage({
  searchParams,
}: {
  searchParams: Promise<{
    date?: string
    employee?: string
    view?: string
  }>
}) {
  const params = await searchParams
  const membership = await requireActiveMembership()
  const mode = membership.role === "employee" ? "week" : "team"
  const timezone = membership.timezone
  const now = new Date()
  const today = localDateForInstant(now, timezone)
  const selectedDate = validLocalDate(params.date) ?? today
  const weekStart = mondayForLocalDate(selectedDate)
  const range = localDateRange(weekStart, 7, timezone)

  if (membership.role === "employee") {
    const [calendar, employee, assignedJobs] = await Promise.all([
      getEmployeeRosterCalendarData({
        endUtc: range.endUtc,
        startUtc: range.startUtc,
      }),
      getCurrentEmployee(),
      getEmployeeAssignedJobs(),
    ])
    const employeeOption = toActiveEmployeeOption(employee)

    return (
      <RosterCalendar
        dates={range.dates}
        employees={[employeeOption]}
        jobs={assignedJobs.map((job) => ({
          assigneeMembershipId: job.assigneeMembershipId,
          dueAt: job.dueAt,
          id: job.id,
          scheduledAt: job.scheduledAt,
          title: job.title,
        }))}
        mode="week"
        now={now.toISOString()}
        readOnly
        selectedDate={selectedDate}
        selectedEmployeeId={membership.membershipId}
        shifts={calendar.shifts}
        timezone={timezone}
        today={today}
      />
    )
  }

  const context = await getOwnerRosterContext()
  const selectedValue = Number(params.employee)
  const selectedEmployee =
    context.employees.find(
      (employee) =>
        Number.isSafeInteger(selectedValue) &&
        employee.employeeMembershipId === selectedValue
    ) ?? null
  const calendar = await getOwnerRosterCalendarData({
    endUtc: range.endUtc,
    startUtc: range.startUtc,
  })

  return (
    <RosterCalendar
      dates={range.dates}
      employees={calendar.employees}
      jobs={calendar.jobs}
      mode={mode}
      now={now.toISOString()}
      selectedDate={selectedDate}
      selectedEmployeeId={selectedEmployee?.employeeMembershipId ?? null}
      shifts={calendar.shifts}
      timezone={timezone}
      today={today}
    />
  )
}
